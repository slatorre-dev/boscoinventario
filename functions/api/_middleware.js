// ── Hashing de contraseñas (PBKDF2 vía Web Crypto, nativo del runtime de
// Workers — bcrypt no funciona aquí, no es Node). Duplicado en cada
// functions/api/*.js que toca contraseñas, mismo patrón de duplicación ya
// usado en el proyecto para GENERIC_DEPT/escHtml/etc. Ver docs/SECURITY.md.
function _pwBytesToHex(bytes){ return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function _pwHexToBytes(hex){ const b=new Uint8Array(hex.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(hex.substr(i*2,2),16); return b; }
function _pwTimingSafeEqual(a,b){ if(a.length!==b.length) return false; let r=0; for(let i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }

async function hashPassword(password){
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256' }, keyMaterial, 256);
  return `pbkdf2$100000$${_pwBytesToHex(saltBytes)}$${_pwBytesToHex(new Uint8Array(bits))}`;
}

// Acepta también contraseñas viejas sin hashear todavía (migración
// perezosa: se rehashean solas la próxima vez que alguien inicia sesión
// con éxito — ver más abajo). Devuelve true si coincide en cualquiera de
// los dos formatos.
async function verifyPassword(password, stored){
  if(!stored) return false;
  if(!stored.startsWith('pbkdf2$')) return password === stored;
  const [, iterStr, saltHex, hashHex] = stored.split('$');
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:_pwHexToBytes(saltHex), iterations:parseInt(iterStr,10), hash:'SHA-256' }, keyMaterial, 256);
  return _pwTimingSafeEqual(_pwBytesToHex(new Uint8Array(bits)), hashHex);
}

export async function onRequest({ request, env, next, data }) {
  const url = new URL(request.url);

  // Rutas públicas
  if (url.pathname.startsWith('/api/auth')) return next();
  if (url.pathname.startsWith('/api/oauth')) return next(); // Incluye callback, start, login-google
  if (url.pathname.startsWith('/api/backup')) return next();

  const u = url.searchParams.get('u') || '';
  const p = url.searchParams.get('p') || '';
  const t = url.searchParams.get('t') || ''; // session_token (para Google OAuth)

  // Validar autenticación
  let user = null;

  if (u && p) {
    // Método 1: Username + Password (login tradicional)
    const row = await env.DB.prepare(
      'SELECT usuario, nombre, rol, email, departamento, password FROM usuarios WHERE usuario=?'
    ).bind(u.trim()).first();
    if (row && await verifyPassword(p, row.password)) {
      const storedPassword = row.password;
      delete row.password; // nunca debe llegar más allá del middleware
      user = row;
      // Migración perezosa: si la cuenta aún tenía la contraseña en claro,
      // se rehashea ahora que se acaba de comprobar que es correcta —
      // ningún usuario tiene que hacer nada para que esto ocurra.
      if (!String(storedPassword || '').startsWith('pbkdf2$')) {
        await env.DB.prepare('UPDATE usuarios SET password=? WHERE usuario=?')
          .bind(await hashPassword(p), user.usuario).run();
      }
    }
  } else if (u && t) {
    // Método 2: Username + Session Token (Google OAuth)
    user = await env.DB.prepare(
      'SELECT usuario, nombre, rol, email, departamento FROM usuarios WHERE usuario=? AND session_token=?'
    ).bind(u.trim(), t).first();
  }

  if (!user) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  // Pasar user via data (Request es inmutable)
  data.user = user;
  data.departamento = user.departamento || '';
  request.user = user; // compatibilidad
  request.departamento = user.departamento || ''; // compatibilidad
  return next();
}

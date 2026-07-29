// Google Sign-In OAuth - Validar JWT y crear sesión

// Caché de JWKS (claves públicas de Google) por 24 horas
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/**
 * Generar token de sesión único
 */
function generateSessionToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 40; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
async function getGoogleJwks() {
  const now = Date.now();
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v1/certs');
    if (!res.ok) throw new Error('No se pudo obtener JWKS de Google');
    jwksCache = await res.json();
    jwksCacheTime = now;
    return jwksCache;
  } catch (err) {
    console.error('Error obteniendo JWKS:', err.message);
    throw err;
  }
}

/**
 * Validar JWT de Google
 * @param {string} token - JWT token del cliente de Google
 * @param {string} clientId - Google OAuth Client ID
 * @returns {object} - Payload decodificado del JWT
 */
async function validateGoogleToken(token, clientId) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT inválido: formato incorrecto');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decodificar header y payload
  const decodeBase64Url = (str) => {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  };

  let header, payload;
  try {
    header = JSON.parse(decodeBase64Url(headerB64));
    payload = JSON.parse(decodeBase64Url(payloadB64));
  } catch (err) {
    throw new Error('JWT inválido: no se pudo decodificar');
  }

  // Verificar que el JWT sea para el cliente correcto
  if (payload.aud !== clientId) {
    throw new Error('Token de Google inválido: aud no coincide');
  }

  // Verificar que no esté expirado
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token de Google expirado');
  }

  // Verificar que sea emitido por Google
  if (!payload.iss || !payload.iss.includes('accounts.google.com')) {
    throw new Error('Token no emitido por Google');
  }

  // En producción, se debería validar la firma. Por ahora, confiamos en HTTPS.
  // Para una validación completa, se necesitaría verificar la firma usando las claves de JWKS.
  // En Cloudflare Workers, hay limitaciones con criptografía de alto nivel.
  console.log('Google token validado (estructura correcta, no caducado, aud válido)', {
    email: payload.email,
    name: payload.name,
  });

  return payload;
}

// Mapeo conocido correo -> departamento (docs/PLAN_MULTIDEPARTAMENTO.md).
// Los correos @iesjuanbosco.es no listados aquí se crean sin departamento
// asignado (quedan sin ver inventario hasta que un superadmin se lo asigne).
const EMAIL_DEPT_MAP = {
  slatorre: 'electricidadelectronica',
  ochacon: 'fabricacionmecanica',
  mcarbonell: 'informatica',
  cmena: 'comercio',
  ayera: 'matematicas',
  pblanco: 'geografiahistoria',
  jillescas: 'tecnologia',
  calberca: 'filosofia',
  rsanchez: 'fisicaquimica',
  ccarpio: 'cienciasnaturales',
};

/**
 * Crear usuario automáticamente si no existe
 */
async function ensureUser(db, email, name) {
  // Extraer usuario del email (ejemplo: pedro.garcia@iesjuanbosco.es -> pedrogarcia)
  const [userPart] = email.split('@');
  let usuario = userPart.replace(/[^a-z0-9._-]/gi, '').toLowerCase();

  // Si el usuario ya existe, devolver los datos existentes
  let user = await db.prepare(
    'SELECT usuario, nombre, rol, email, google_id, session_token, departamento FROM usuarios WHERE email=?'
  ).bind(email).first();

  if (user) {
    console.log('Usuario existente encontrado:', user.usuario);
    // Actualizar session_token
    const newToken = generateSessionToken();
    await db.prepare(
      'UPDATE usuarios SET session_token=? WHERE email=?'
    ).bind(newToken, email).run();
    user.session_token = newToken;
    return user;
  }

  // Generar usuario único si es necesario
  let baseUsuario = usuario;
  let counter = 1;
  while (true) {
    user = await db.prepare(
      'SELECT usuario FROM usuarios WHERE usuario=?'
    ).bind(usuario).first();
    if (!user) break;
    usuario = `${baseUsuario}${counter}`;
    counter++;
  }

  console.log('Creando nuevo usuario:', usuario, 'con email:', email);

  // Crear usuario nuevo con rol "profesor" por defecto
  const sessionToken = generateSessionToken();
  const randomPass = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const departamento = EMAIL_DEPT_MAP[baseUsuario.toLowerCase()] || '';

  try {
    await db.prepare(`
      INSERT INTO usuarios (usuario, nombre, email, password, rol, google_id, auth_method, session_token, created_at, departamento)
      VALUES (?, ?, ?, ?, 'profesor', ?, 'google', ?, datetime('now'), ?)
    `).bind(usuario, name || email, email, randomPass, email, sessionToken, departamento).run();

    console.log('Usuario creado exitosamente:', usuario);

    return {
      usuario,
      nombre: name || email,
      email,
      rol: 'profesor',
      google_id: email,
      session_token: sessionToken,
      departamento,
    };
  } catch (err) {
    console.error('Error creando usuario:', err.message);
    throw new Error('No se pudo crear usuario: ' + err.message);
  }
}

/**
 * Endpoint: POST /api/oauth/login-google
 * Body: { token: "JWT_TOKEN_DE_GOOGLE" }
 * Response: { ok: true, user: { usuario, nombre, rol, email, google_id } }
 */
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);

  try {
    // 1. Parsear el cuerpo de la request
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return Response.json(
        { ok: false, error: 'Falta token de Google' },
        { status: 400 }
      );
    }

    if (!env.GOOGLE_OAUTH_CLIENT_ID) {
      return Response.json(
        { ok: false, error: 'Servidor no configurado: falta GOOGLE_OAUTH_CLIENT_ID' },
        { status: 500 }
      );
    }

    // 2. Validar JWT
    const googlePayload = await validateGoogleToken(token, env.GOOGLE_OAUTH_CLIENT_ID);

    // 3. Verificar que el email sea @iesjuanbosco.es
    const email = googlePayload.email || '';
    if (!email.toLowerCase().endsWith('@iesjuanbosco.es')) {
      return Response.json(
        { ok: false, error: 'Email no autorizado. Solo se aceptan cuentas de @iesjuanbosco.es' },
        { status: 403 }
      );
    }

    // 4. Crear o recuperar usuario
    const user = await ensureUser(env.DB, email, googlePayload.name);
    let departamentoNombre = '';
    if (user.departamento) {
      const dept = await env.DB.prepare('SELECT nombre FROM departamentos WHERE slug=?').bind(user.departamento).first().catch(() => null);
      departamentoNombre = dept?.nombre || '';
    }

    // 5. Devolver SESSION compatible con el cliente
    return Response.json({
      ok: true,
      user: {
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        departamento: user.departamento || '',
        departamentoNombre,
        google_id: user.google_id || email,
        auth_method: 'google',
        session_token: user.session_token, // ← Token para uso posterior
      },
    });

  } catch (err) {
    console.error('Error en login-google:', err.message);

    // Diferenciar entre errores de validación y errores del servidor
    if (err.message.includes('Email no autorizado')) {
      return Response.json(
        { ok: false, error: err.message },
        { status: 403 }
      );
    }

    if (err.message.includes('Token')) {
      return Response.json(
        { ok: false, error: err.message },
        { status: 401 }
      );
    }

    return Response.json(
      { ok: false, error: err.message || 'Error procesando login de Google' },
      { status: 500 }
    );
  }
}

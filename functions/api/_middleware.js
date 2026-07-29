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
    user = await env.DB.prepare(
      'SELECT usuario, nombre, rol, email, departamento FROM usuarios WHERE usuario=? AND password=?'
    ).bind(u.trim(), p).first();
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

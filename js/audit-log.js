// Logging simple para historial de acciones
// Solo registra en el servidor, sin acceder a variables globales no inicializadas

async function logHistorial(accion, que, nombre = null, detalles = null) {
  if (!SESSION || !SESSION.usuario) return; // solo si hay sesión activa

  try {
    await fetch(urlWithAuth('historial'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: SESSION.usuario,
        accion,
        que,
        nombre,
        detalles
      })
    });
  } catch (err) {
    console.warn('[audit-log] Error logging:', err);
  }
}

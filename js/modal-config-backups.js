// ═════════════════════════════════════════════════════════
// VERSIONES ANTERIORES DE AULAS/CATEGORÍAS/CICLOS
// ═════════════════════════════════════════════════════════
// Cada aulasSync/catsSync/ciclosSync guarda un snapshot automático antes
// de borrar-e-insertar (ver functions/api/config.js). Este modal lista
// esos snapshots y permite restaurar el más reciente si algo se guardó
// mal o vacío por error.

let _configBackupsTabla = null;

const TABLA_LABEL = { aulas: 'Aulas', categorias: 'Categorías', ciclos: 'Ciclos/asignaturas' };

async function openConfigBackups(tabla){
  _configBackupsTabla = tabla;
  document.getElementById('configBackupsList').innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center">Cargando...</p>';
  document.getElementById('mConfigBackups').classList.add('open');
  try {
    const res = await apiPost({ action:'configBackupsList', tabla });
    if(!res.ok) throw new Error(res.error);
    _renderConfigBackups(res.backups || []);
  } catch(e){
    document.getElementById('configBackupsList').innerHTML = `<p style="color:var(--red);font-size:13px">${escHtml(e.message)}</p>`;
  }
}

function closeConfigBackups(){
  document.getElementById('mConfigBackups').classList.remove('open');
}

function _renderConfigBackups(backups){
  const el = document.getElementById('configBackupsList');
  if(!backups.length){
    el.innerHTML = `<div class="empty" style="padding:20px"><div class="et" style="font-size:13px">Sin copias guardadas todavía para ${escHtml(TABLA_LABEL[_configBackupsTabla]||_configBackupsTabla)}. Se creará una automáticamente la próxima vez que guardes cambios.</div></div>`;
    return;
  }
  el.innerHTML = backups.map(b => {
    const kb = Math.max(1, Math.round((b.tam||0)/1024));
    return `<div class="usr-row" style="align-items:center">
      <div style="flex:1">
        <strong style="font-size:13px">${escHtml(b.fecha)}</strong>
        <div style="font-size:11px;color:var(--muted)">por ${escHtml(b.usuario||'—')} · ~${kb} KB</div>
      </div>
      <button class="btn btn-sm" onclick="restoreConfigBackup(${b.id})">↩️ Restaurar</button>
    </div>`;
  }).join('');
}

async function restoreConfigBackup(id){
  const ok = await confirmDialog({
    title: 'Restaurar versión anterior',
    message: `Esto reemplazará ${TABLA_LABEL[_configBackupsTabla]||_configBackupsTabla} actual por esta copia. Se guardará otra copia del estado actual antes, por si acaso.`,
    confirmText: 'Restaurar',
    danger: true,
  });
  if(!ok) return;
  try {
    const res = await apiPost({ action:'configBackupsRestore', id });
    if(!res.ok) throw new Error(res.error);
    toast(`Restaurado (${res.restored} filas). Recarga para ver los cambios.`, 'ok');
    closeConfigBackups();
    // Recarga los datos base para reflejar el cambio sin recargar la página entera
    if(typeof loadData === 'function') loadData();
  } catch(e){
    toast('Error al restaurar: '+e.message, 'err');
  }
}

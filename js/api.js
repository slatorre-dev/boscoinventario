// ═════════════════════════════════════════════════════════
// API — Cloudflare Workers
// ═════════════════════════════════════════════════════════

const ENDPOINT_MAP = {
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item',
  prestar:'prestar', devolver:'prestar', prestarCaja:'prestar', notificarVencidos:'prestar',
  profAdd:'profesores', profUpdate:'profesores', profDelete:'profesores',
  aulasSync:'config', catsSync:'config', normalizeCategoriesTags:'config', normalizeTagsCanonical:'config', renameTag:'config', deleteTag:'config', ciclosSync:'config', ubicacionesSync:'config',
  updateProfile:'perfil', changePassword:'perfil',
  getUsers:'usuarios', userAdd:'usuarios', userUpdate:'usuarios',
  userDelete:'usuarios', userResetPassword:'usuarios', userAssignModulos:'usuarios',
  getDocs:'docs', uploadDoc:'docs', deleteDoc:'docs',
  notificarPedido:'pedidos',
};

function urlWithAuth(endpoint, params={}){
  const u = encodeURIComponent(SESSION?.usuario||'');
  // Si es Google OAuth, usar session_token; si no, usar password
  const auth = SESSION?.session_token 
    ? `t=${encodeURIComponent(SESSION.session_token)}`
    : `p=${encodeURIComponent(SESSION?.password||'')}`;
  let url = `/api/${endpoint}?u=${u}&${auth}`;
  for (const [key, val] of Object.entries(params)) {
    if (val != null) url += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
  }
  return url;
}

async function apiGet(endpoint, params={}){
  if (typeof endpoint === 'object') {
    const obj = endpoint;
    endpoint = obj.action || 'list';
    params = {...obj};
    delete params.action;
  }
  const r = await fetch(urlWithAuth(endpoint, params));
  let data = null;
  try { data = await r.json(); } catch(e) {}
  if(!r.ok) throw new Error(data?.error || 'HTTP '+r.status);
  return data;
}

async function apiPost(payload){
  if(payload?.action && typeof canAction === 'function' && !canAction(payload.action)){
    return {ok:false, error:'No tienes permisos para realizar esta acción'};
  }
  const endpoint = ENDPOINT_MAP[payload.action] || payload.action;
  const url = urlWithAuth(endpoint);
  const r = await fetch(url, {
    method:'POST',
    body: JSON.stringify(payload),
    headers: {'Content-Type':'application/json'},
  });
  let data = null;
  try { data = await r.json(); } catch(e) {}
  if(!r.ok) throw new Error(data?.error || data?.message || 'HTTP '+r.status);
  return data || {};
}

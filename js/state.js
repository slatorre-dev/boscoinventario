// ═════════════════════════════════════════════════════════
// ESTADO
// ═════════════════════════════════════════════════════════
// Backend: Cloudflare Workers (mismo origen, no necesita URL externa)
let SESSION = JSON.parse(localStorage.getItem('inv_session') || 'null');
let items = [];
let profesores = [];
let prestamos = [];
let reservas = [];
let UBICACIONES = [];
let cf = null;
let currentCiclo = null;
let view = localStorage.getItem('inv_view') || 'table';
let _groupView = localStorage.getItem('inv_group_view') !== 'false';
let sk = 'item', sa = true;
let eid = null;
let currentPresTab = 'activos';
let currentPresGroupBy = localStorage.getItem('pres_group_by') || '';
let currentPresOnlyVencidos = false;
let currentPresShowReservas = false;
let prestarItemId = null;
let devolverPresId = null;
let itemsLoaded = false;
let _subFilter = null;

function setConn(state, txt){
  const el = document.getElementById('connStatus');
  el.className = 'conn-status ' + state;
  el.title = txt;
  const bar = document.getElementById('connBar');
  if(bar){
    bar.className = state;
    if(state === 'ok') setTimeout(()=>{ bar.className = ''; }, 700);
  }
}

function animateCount(el, target, duration=600){
  const start = performance.now();
  const from = 0;
  function step(now){
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * ease).toLocaleString('es-ES');
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function materialType(item){
  const raw = String(item?.tipo_material || item?.tipoMaterial || '').trim().toLowerCase();
  if(raw === 'inventariable') return 'inventariable';
  if(raw === 'consumible') return 'consumible';
  if(item?.es_contenedor == 1 || item?.es_contenedor === true) return 'inventariable';
  return 'inventariable';
}

function isConsumible(item){
  return materialType(item) === 'consumible';
}

function isLowStock(item){
  return isConsumible(item) && Number(item?.qty) <= Number(item?.min);
}

function show(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const fab=document.getElementById('fabNuevo');
  if(fab && id!=='pS') fab.style.display='none';
}

function needsMaintenance(item){
  const status = String(item?.mantEstado || '').trim().toLowerCase();
  if(status === 'resuelto' || status === 'reparado') return false;
  return item?.mant === true || item?.mant === 1 || String(item?.mant || '').trim() === '1' || item?.est === 'Avería';
}

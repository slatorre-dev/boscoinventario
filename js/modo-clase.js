// ═════════════════════════════════════════════════════════
// MODO CLASE — vista móvil reducida para el profesorado: botones grandes
// para los momentos reales de una clase (escanear, preparar práctica,
// devolver, solicitar material) + un resumen de lo propio. No sustituye
// Inicio/Inventario/Préstamos, es un acceso adicional.
// ═════════════════════════════════════════════════════════

function _mcProfesorPropio(){
  return (typeof loanTeacherOptions === 'function' ? loanTeacherOptions() : [])
    .find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim()) || null;
}

function _misPrestamosActivosModoClase(){
  const propio = _mcProfesorPropio();
  if(!propio) return [];
  return (typeof prestamos !== 'undefined' ? prestamos : [])
    .filter(p => (p.estado==='Activo'||p.estado==='Parcial') && String(p.profesorId)===String(propio.id));
}

function _misReservasProximasModoClase(){
  const propio = _mcProfesorPropio();
  if(!propio) return [];
  return (typeof reservas !== 'undefined' ? reservas : [])
    .filter(r => r.estado==='pendiente' && String(r.profesorId)===String(propio.id))
    .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
}

function goModoClase(){
  if(!requirePerm('loans.write')) return;
  _push({page:'modoclase'}, '#modoclase');
  cf = null; currentCiclo = null;
  document.getElementById('btnN').style.display = 'none';
  document.getElementById('btnE').style.display = 'none';
  _hideHomeButtons();
  if(typeof applyRoleUI === 'function') applyRoleUI();
  document.getElementById('bc').innerHTML = `<span class="bc-link" onclick="goHome()">Inicio</span><span class="sep">›</span><strong>🎒 Modo clase</strong>`;
  show('pModoClase');
  renderModoClase();
}

function renderModoClase(){
  const misPrestamos = _misPrestamosActivosModoClase();
  const misReservas = _misReservasProximasModoClase();
  const misSolicitudes = typeof _misSolicitudesPendientes === 'function' ? _misSolicitudesPendientes() : [];

  const prestamosHtml = misPrestamos.length
    ? misPrestamos.map(p => {
        const venc = typeof isVencido === 'function' && isVencido(p);
        const pendiente = Number(p.cantidad) - Number(p.cantidadDevuelta||0);
        return `<div class="mc-row">
          <div class="mc-row-info">
            <strong>${escHtml(p.itemNombre)}</strong>
            <span class="${venc?'venc':''}">${pendiente} ud. · ${p.fechaPrevista ? 'devolver: '+escHtml(p.fechaPrevista) : 'sin fecha prevista'}${venc?' ⚠ Vencido':''}</span>
          </div>
          <button class="btn btn-sm btn-return" onclick="openDevolver(${Number(p.id)})">📥 Devolver</button>
        </div>`;
      }).join('')
    : `<div class="mc-empty">Sin préstamos activos a tu nombre.</div>`;

  const reservasHtml = misReservas.length
    ? misReservas.slice(0,5).map(r => {
        const aulaNombre = (typeof AULAS!=='undefined' ? AULAS.find(a=>a.id===r.aulaDestino) : null)?.name || r.aulaDestino || '—';
        return `<div class="mc-row">
          <div class="mc-row-info">
            <strong>${escHtml(r.moduloNombre || 'Práctica')}</strong>
            <span>📅 ${escHtml(r.fecha)}${r.franja?' · '+escHtml(r.franja):''} · 🏫 ${escHtml(aulaNombre)}</span>
          </div>
        </div>`;
      }).join('')
    : `<div class="mc-empty">Sin prácticas planificadas próximamente.</div>`;

  const solicitudesHtml = misSolicitudes.length
    ? misSolicitudes.map(s => `<div class="mc-row">
        <div class="mc-row-info"><strong>${escHtml(s.nombre)}</strong><span>🟡 Pendiente de respuesta</span></div>
      </div>`).join('')
    : `<div class="mc-empty">Sin solicitudes pendientes.</div>`;

  const resumenEl = document.getElementById('mcResumen');
  if(!resumenEl) return;
  resumenEl.innerHTML = `
    <div class="mc-card">
      <div class="mc-card-title">⌛ Tus préstamos activos</div>
      ${prestamosHtml}
    </div>
    <div class="mc-card">
      <div class="mc-card-title">📅 Tus próximas prácticas</div>
      ${reservasHtml}
    </div>
    <div class="mc-card">
      <div class="mc-card-title">🧰 Tus solicitudes pendientes</div>
      ${solicitudesHtml}
    </div>`;
}

// Botón "Devolver material": lleva al resumen de préstamos propios de esta
// misma página, donde cada línea ya tiene su botón de devolución directa
// (openDevolver, mismo flujo validado que el resto de la app).
function mcDevolverFoco(){
  const el = document.getElementById('mcResumen');
  if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}

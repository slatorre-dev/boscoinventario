// ══ AUDITORÍA DE DATOS ══

const CAMPOS_CRITICOS = [
  { key: 'cat',  label: 'Categoría' },
  { key: 'mod',  label: 'Módulo/Ciclo' },
  { key: 'aula', label: 'Aula' },
];

const CAMPOS_SECUNDARIOS = [
  { key: 'ref',       label: 'Referencia' },
  { key: 'loc',       label: 'Ubicación' },
  { key: 'proveedor', label: 'Proveedor' },
];

const TODOS_LOS_CAMPOS = [...CAMPOS_CRITICOS, ...CAMPOS_SECUNDARIOS];

let auditoriaData = [];
let auditoriaFiltroActual = 'all';
let auditoriaSeleccionados = new Set();
let auditoriaAgrupar = 'none';
let gruposColapsados = new Set();

function openAuditoriaModal() {
  if (!can('config.manage')) {
    toast('Sin permisos para acceder a auditoría', 'err');
    return;
  }

  const modal = document.getElementById('mAuditoria');
  modal.style.display = 'flex';
  modal.classList.add('open');

  cargarAuditoria();
}

function closeAuditoriaModal() {
  const modal = document.getElementById('mAuditoria');
  modal.classList.remove('open');
  modal.style.display = 'none';
}

function cargarAuditoria() {
  const empty = document.getElementById('auditoriaEmpty');
  empty.style.display = 'none';
  auditoriaSeleccionados.clear();

  // Usar items ya cargado en memoria
  if (!items || items.length === 0) {
    empty.textContent = 'Cargando...';
    empty.style.display = 'block';
    document.getElementById('audSelAll').style.display = 'none';
    document.getElementById('audEditMult').style.display = 'none';
    return;
  }

  // Analizar cada item y encontrar campos faltantes
  const conProblemas = items.map(item => ({
    ...item,
    problemas: getItemProblemas(item)
  })).filter(item => item.problemas.length > 0);

  // Duplicados (mismo nombre + aula) — criterio aparte de "campos faltantes"
  const duplicadosIds = new Set(getDuplicados().map(i => i.id));
  const yaIncluidos = new Set(conProblemas.map(i => i.id));
  const soloDuplicados = items
    .filter(i => duplicadosIds.has(i.id) && !yaIncluidos.has(i.id))
    .map(item => ({ ...item, problemas: [] }));

  auditoriaData = [...conProblemas, ...soloDuplicados];
  auditoriaData.forEach(item => {
    if (duplicadosIds.has(item.id)) item.esDuplicado = true;
  });

  // Mostrar controles de selección si hay items
  const hasItems = auditoriaData.length > 0;
  document.getElementById('audSelAll').style.display = hasItems ? 'block' : 'none';
  document.getElementById('audEditMult').style.display = hasItems && auditoriaSeleccionados.size > 0 ? 'block' : 'none';

  // Renderizar con filtro actual
  renderAuditoria(auditoriaFiltroActual);

  // Actualizar botones de filtro con contadores
  updateFiltroButtons();
}

function getItemProblemas(item) {
  return TODOS_LOS_CAMPOS
    .filter(c => !item[c.key] || item[c.key].toString().trim() === '')
    .map(c => c.label);
}

function normalizeDup(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Duplicados: mismo nombre normalizado + misma aula, entre items no-contenedor
// (contenedores/hijos de SET-/CONT- no cuentan como "el mismo item repetido").
function getDuplicados() {
  const grupos = new Map();
  items.forEach(item => {
    if (item.es_contenedor || item.parent_id) return;
    const key = normalizeDup(item.item) + '||' + normalizeDup(item.aula);
    if (!key.trim().replace('||', '')) return;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(item);
  });
  const dupIds = new Set();
  grupos.forEach(grupo => {
    if (grupo.length > 1) grupo.forEach(i => dupIds.add(i.id));
  });
  return items.filter(i => dupIds.has(i.id));
}

function renderAuditoria(filtro) {
  const tbody = document.getElementById('auditoriaTbody');
  const empty = document.getElementById('auditoriaEmpty');
  const info = document.getElementById('auditoriaInfo');

  tbody.innerHTML = '';

  // Filtrar items según el tipo de problema
  let items = auditoriaData;
  if (filtro === 'dup') {
    items = auditoriaData.filter(item => item.esDuplicado);
  } else if (filtro !== 'all') {
    const field = TODOS_LOS_CAMPOS.find(f => f.key === filtro);
    if (field) {
      items = auditoriaData.filter(item =>
        item.problemas.includes(field.label)
      );
    }
  }

  // Actualizar información
  const total = auditoriaData.length;
  const mostrados = items.length;
  const seleccionados = auditoriaSeleccionados.size;

  let infoText = '';
  if (filtro === 'all') {
    infoText = `<strong>${total} items con campos faltantes o duplicados</strong>`;
  } else if (filtro === 'dup') {
    infoText = `<strong>${mostrados} items duplicados</strong> (mismo nombre + aula)`;
  } else {
    const fieldName = TODOS_LOS_CAMPOS.find(f => f.key === filtro)?.label || filtro;
    infoText = `<strong>${mostrados} items sin ${fieldName}</strong> (de ${total} total)`;
  }
  if (seleccionados > 0) {
    infoText += ` · <strong style="color:var(--blue)">${seleccionados} seleccionados</strong>`;
  }
  info.innerHTML = infoText;

  if (items.length === 0) {
    empty.textContent = filtro === 'all'
      ? 'No hay items con campos faltantes ✓'
      : 'No se encontraron items con ese problema ✓';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  // Renderizar agrupado o normal
  if (auditoriaAgrupar === 'none') {
    renderAuditoriaFilas(items);
  } else {
    renderAuditoriaAgrupada(items);
  }
}

function renderAuditoriaFilas(items) {
  const tbody = document.getElementById('auditoriaTbody');

  items.forEach(item => {
    const tr = document.createElement('tr');
    const problemasStr = item.problemas.length
      ? item.problemas.join(', ')
      : (item.esDuplicado ? 'Duplicado' : '');
    const isChecked = auditoriaSeleccionados.has(item.id);

    tr.innerHTML = `
      <td style="width:32px;text-align:center">
        <input type="checkbox" class="audit-item-check" data-id="${item.id}" ${isChecked ? 'checked' : ''}
               onchange="toggleAuditoriaItem(${item.id})">
      </td>
      <td class="ref-cell">${escapeHtml(item.ref || '—')}</td>
      <td class="name-cell">${escapeHtml(item.item || '—')}</td>
      <td class="aula-cell">${escapeHtml(item.aula || '—')}</td>
      <td class="cat-cell">${escapeHtml(item.cat || '—')}</td>
      <td class="problemas-cell">
        <span class="problemas-badge">${escapeHtml(problemasStr)}</span>
      </td>
      <td class="action-cell">
        <button class="mini-btn" onclick="abrirItemParaEditar(${item.id})">✏️ Editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAuditoriaAgrupada(items) {
  const tbody = document.getElementById('auditoriaTbody');
  const grupos = getGrupos(items);

  grupos.forEach(([grupoKey, grupoItems]) => {
    const grpKey = CSS.escape(grupoKey);
    const isGroupCollapsed = gruposColapsados.has(grupoKey);
    const groupCheckboxId = `grp-chk-${grpKey}`;

    // Cabecera del grupo
    const headerTr = document.createElement('tr');
    headerTr.className = 'auditoria-group-header';
    headerTr.style.cssText = 'background:var(--surface2);cursor:pointer;font-weight:600;padding:12px 8px';
    headerTr.onclick = () => toggleGrupoAuditoria(grupoKey);

    const groupSelectedCount = grupoItems.filter(i => auditoriaSeleccionados.has(i.id)).length;
    const groupChecked = groupSelectedCount === grupoItems.length && grupoItems.length > 0;
    const groupIndeterminate = groupSelectedCount > 0 && groupSelectedCount < grupoItems.length;

    headerTr.innerHTML = `
      <td colspan="7" style="display:flex;align-items:center;gap:12px;padding:8px 12px">
        <input type="checkbox" id="${groupCheckboxId}" ${groupChecked ? 'checked' : ''}
               onchange="seleccionarGrupo('${grupoKey}', this.checked)"
               onclick="event.stopPropagation()"
               style="cursor:pointer;width:16px;height:16px">
        <strong style="min-width:200px">${escapeHtml(grupoKey)}</strong>
        <span style="color:var(--muted);font-size:12px">${grupoItems.length} items</span>
        <span class="group-toggle" id="grp-toggle-${grpKey}" style="margin-left:auto;font-size:12px;color:var(--muted)">${isGroupCollapsed ? '▶' : '▼'}</span>
      </td>
    </tr>`;
    tbody.appendChild(headerTr);

    // Filas del grupo
    grupoItems.forEach(item => {
      const rowTr = document.createElement('tr');
      rowTr.className = 'auditoria-group-row';
      rowTr.setAttribute('data-group', grupoKey);
      rowTr.style.display = isGroupCollapsed ? 'none' : '';

      const problemasStr = item.problemas.length
      ? item.problemas.join(', ')
      : (item.esDuplicado ? 'Duplicado' : '');
      const isChecked = auditoriaSeleccionados.has(item.id);

      rowTr.innerHTML = `
        <td style="width:32px;text-align:center;padding:6px">
          <input type="checkbox" class="audit-item-check" data-id="${item.id}" ${isChecked ? 'checked' : ''}
                 onchange="toggleAuditoriaItem(${item.id})" style="cursor:pointer">
        </td>
        <td class="ref-cell">${escapeHtml(item.ref || '—')}</td>
        <td class="name-cell">${escapeHtml(item.item || '—')}</td>
        <td class="aula-cell">${escapeHtml(item.aula || '—')}</td>
        <td class="cat-cell">${escapeHtml(item.cat || '—')}</td>
        <td class="problemas-cell">
          <span class="problemas-badge">${escapeHtml(problemasStr)}</span>
        </td>
        <td class="action-cell">
          <button class="mini-btn" onclick="abrirItemParaEditar(${item.id})">✏️ Editar</button>
        </td>
      `;
      tbody.appendChild(rowTr);
    });
  });
}

function filtrarAuditoria(filtro) {
  auditoriaFiltroActual = filtro;

  // Actualizar botones activos
  document.querySelectorAll('#auditoriaFiltros .abtn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = Array.from(document.querySelectorAll('#auditoriaFiltros .abtn'))
    .find(btn => {
      const onclick = btn.getAttribute('onclick');
      return onclick && onclick.includes(`'${filtro}'`);
    });
  if (activeBtn) activeBtn.classList.add('active');

  renderAuditoria(filtro);
}

function updateFiltroButtons() {
  // Contar items con cada tipo de problema
  const counts = {};
  TODOS_LOS_CAMPOS.forEach(field => {
    counts[field.key] = auditoriaData.filter(item =>
      item.problemas.includes(field.label)
    ).length;
  });
  const dupCount = auditoriaData.filter(item => item.esDuplicado).length;

  // Actualizar texto de botones
  const botones = document.querySelectorAll('#auditoriaFiltros .abtn');
  botones.forEach(btn => {
    const onclick = btn.getAttribute('onclick');

    if (onclick.includes("'all'")) {
      btn.innerHTML = `Todos (${auditoriaData.length})`;
    } else if (onclick.includes("'dup'")) {
      btn.innerHTML = `Duplicados (${dupCount})`;
    } else {
      TODOS_LOS_CAMPOS.forEach(field => {
        if (onclick.includes(`'${field.key}'`)) {
          btn.innerHTML = `Sin ${field.key === 'aula' ? 'aula' : field.label.toLowerCase()} (${counts[field.key]})`;
        }
      });
    }
  });
}

function toggleAuditoriaItem(itemId) {
  if (auditoriaSeleccionados.has(itemId)) {
    auditoriaSeleccionados.delete(itemId);
  } else {
    auditoriaSeleccionados.add(itemId);
  }
  // Mostrar/ocultar botón de edición en lote
  const btnEdit = document.getElementById('audEditMult');
  btnEdit.style.display = auditoriaSeleccionados.size > 0 ? 'block' : 'none';

  renderAuditoria(auditoriaFiltroActual);
}

function abrirItemParaEditar(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) {
    toast('Item no encontrado', 'err');
    return;
  }

  // Aumentar z-index del modal de auditoría para que el modal de item esté delante
  const auditoriaModal = document.getElementById('mAuditoria').parentElement;
  if (auditoriaModal) auditoriaModal.style.zIndex = '500';

  // Abrir modal de edición (no cierra la auditoría)
  openModal(item.id);

  // Restaurar z-index después de cerrar el modal de item
  const originalClose = window.closeM;
  window.closeM = function() {
    originalClose?.call(this);
    if (auditoriaModal) auditoriaModal.style.zIndex = '501';
  };
}

function editarSeleccionados() {
  if (auditoriaSeleccionados.size === 0) {
    toast('Selecciona al menos un item', 'warn');
    return;
  }

  // Llenar bulkSelected con los IDs (el sistema de bulk edit de inventory.js)
  if (typeof bulkSelected !== 'undefined') {
    bulkSelected.clear();
    auditoriaSeleccionados.forEach(id => {
      bulkSelected.add(String(id));
    });

    // Cerrar auditoría
    closeAuditoriaModal();

    // Mostrar barra de bulk actions
    if (typeof renderBulkBar === 'function') {
      renderBulkBar();
    }

    toast(`${auditoriaSeleccionados.size} items seleccionados para edición en lote`, 'ok');
  } else {
    toast('Sistema de edición en lote no disponible', 'err');
  }
}

function seleccionarTodos() {
  if (auditoriaSeleccionados.size === auditoriaData.length) {
    auditoriaSeleccionados.clear();
  } else {
    auditoriaData.forEach(item => auditoriaSeleccionados.add(item.id));
  }
  renderAuditoria(auditoriaFiltroActual);
}

function agruparAuditoria(modo) {
  auditoriaAgrupar = modo;
  gruposColapsados.clear();

  // Actualizar botones activos
  document.querySelectorAll('#auditoriaFiltros [id^="audGrp"]').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`audGrp${modo === 'none' ? 'None' : modo === 'cat' ? 'Cat' : 'Aula'}`).classList.add('active');

  renderAuditoria(auditoriaFiltroActual);
}

function getGrupos(items) {
  const grupos = new Map();
  const sinGrupo = [];

  items.forEach(item => {
    let key;
    if (auditoriaAgrupar === 'cat') {
      key = item.cat;
    } else {
      key = item.aula;
    }

    if (!key || key.toString().trim() === '') {
      sinGrupo.push(item);
    } else {
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(item);
    }
  });

  // Ordenar grupos con items de mayor a menor
  const resultado = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);

  // Agregar grupo "(Sin aula)" o "(Sin categoría)" al final
  if (sinGrupo.length > 0) {
    const sinGrupoLabel = auditoriaAgrupar === 'cat' ? '(Sin categoría)' : '(Sin aula)';
    resultado.push([sinGrupoLabel, sinGrupo]);
  }

  return resultado;
}

function toggleGrupoAuditoria(key) {
  if (gruposColapsados.has(key)) {
    gruposColapsados.delete(key);
  } else {
    gruposColapsados.add(key);
  }

  document.querySelectorAll(`[data-group="${CSS.escape(key)}"]`).forEach(row => {
    row.style.display = gruposColapsados.has(key) ? 'none' : '';
  });

  const toggle = document.getElementById(`grp-toggle-${CSS.escape(key)}`);
  if (toggle) toggle.textContent = gruposColapsados.has(key) ? '▶' : '▼';
}

function seleccionarGrupo(key, checked) {
  const itemsGrupo = auditoriaAgrupar === 'cat'
    ? auditoriaData.filter(i => (i.cat || '(Sin categoría)') === key)
    : auditoriaData.filter(i => (i.aula || '(Sin aula)') === key);

  itemsGrupo.forEach(i => {
    if (checked) auditoriaSeleccionados.add(i.id);
    else auditoriaSeleccionados.delete(i.id);
  });

  const btnEdit = document.getElementById('audEditMult');
  btnEdit.style.display = auditoriaSeleccionados.size > 0 ? 'block' : 'none';

  renderAuditoria(auditoriaFiltroActual);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

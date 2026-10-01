// ═════════════════════════════════════════════════════════
// DESPLEGABLES DE LA FICHA DE ÍTEM (aula, ciclo/módulo, categoría…)
// Extraído de js/modal-item.js (modularización oportunista, Pendiente #26
// de claude.md). Script CLÁSICO a propósito, no type="module": convertir
// modal-item.js a módulo sacaría del ámbito global las decenas de
// funciones que llaman otros 7 archivos y los onclick= del HTML. Se carga
// justo antes de modal-item.js y sus funciones siguen siendo globales:
//   renderAulaOptions(list?) — también la usan prestamos.js,
//     reservas-practica.js y multi-equipo.js
//   fillModalSelects(), updateModSelect(), syncCicloLabels()
// ═════════════════════════════════════════════════════════

// "Lo mío primero": las aulas/ciclos/módulos que el usuario eligió en
// "📌 Mis Cursos/Aulas" (MIS_AULAS / MIS_MODULOS, ver meta.js) van en un
// grupo propio arriba, y el resto debajo separado. Sin elección, igual
// que siempre. No se ocultan las demás: a veces hay que dar de alta o
// prestar material de otra aula.
function _misCiclosIds(){
  const mods = Array.isArray(MIS_MODULOS) ? MIS_MODULOS : [];
  return [...new Set(mods.map(id=>String(id).split('__')[0]))];
}

function renderAulaOptions(list){
  const rows = list || AULAS;
  const opt = a=>`<option value="${a.id}">${escHtml(a.name)}</option>`;
  const mias = Array.isArray(MIS_AULAS) ? MIS_AULAS : [];
  const rowsMias = rows.filter(a=>mias.includes(a.id));
  const resto = rows.filter(a=>!mias.includes(a.id));
  const globales = resto.filter(a=>!a.departamento);
  const propias = resto.filter(a=>a.departamento);
  const pre = rowsMias.length ? 'Otras aulas' : '';
  let html = rowsMias.length ? `<optgroup label="📌 Mis aulas">${rowsMias.map(opt).join('')}</optgroup>` : '';
  if(globales.length && propias.length){
    html += `<optgroup label="${pre ? pre+' del centro' : 'Aulas del centro'}">${globales.map(opt).join('')}</optgroup>`
          + `<optgroup label="${pre ? pre+' del departamento' : 'Aula del departamento'}">${propias.map(opt).join('')}</optgroup>`;
  } else if(resto.length){
    html += pre ? `<optgroup label="${pre}">${resto.map(opt).join('')}</optgroup>` : resto.map(opt).join('');
  }
  return html;
}

function fillModalSelects(){
  document.getElementById('f_aula').innerHTML=renderAulaOptions();
  const optCiclo = c=>`<option value="${c.id}" data-alias="${cicloAlias(c)}" data-full="${escHtml(c.icon+' '+c.name)}">${escHtml(c.icon+' '+c.name)}</option>`;
  const misCiclos = _misCiclosIds();
  const ciclosMios = CICLOS.filter(c=>misCiclos.includes(c.id));
  const ciclosResto = CICLOS.filter(c=>!misCiclos.includes(c.id));
  document.getElementById('f_ciclo').innerHTML='<option value="">Sin asignar</option>' + (ciclosMios.length
    ? `<optgroup label="📌 Mis ciclos/asignaturas">${ciclosMios.map(optCiclo).join('')}</optgroup>`
      + (ciclosResto.length ? `<optgroup label="Otros">${ciclosResto.map(optCiclo).join('')}</optgroup>` : '')
    : CICLOS.map(optCiclo).join(''));
  syncCicloLabels();
  document.getElementById('f_cat').innerHTML='<option value="">Sin categoría</option>' + sortedCatNames().map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('') + '<option value="__new_category__">＋ Añadir categoría...</option>';
  document.getElementById('f_mantPlanIntervalo').innerHTML = mantPlanIntervaloOptionsHtml('');
  fillLocationSuggestions();
  fillTagSuggestions();
}

function updateModSelect(){
  const cId = document.getElementById('f_ciclo').value;
  const sel = document.getElementById('f_mod');
  if(!cId){ sel.innerHTML='<option value="">Sin asignar</option>'; return; }
  const c = CICLOS.find(x=>x.id===cId);
  const opt = m=>`<option value="${cId}__${m.cod}">${m.name}</option>`;
  const mios = Array.isArray(MIS_MODULOS) ? MIS_MODULOS : [];
  const modsMios = c.modulos.filter(m=>mios.includes(`${cId}__${m.cod}`));
  const modsResto = c.modulos.filter(m=>!mios.includes(`${cId}__${m.cod}`));
  sel.innerHTML='<option value="">Sin asignar</option>' + (modsMios.length
    ? `<optgroup label="📌 Mis módulos/asignaturas">${modsMios.map(opt).join('')}</optgroup>`
      + (modsResto.length ? `<optgroup label="Otros">${modsResto.map(opt).join('')}</optgroup>` : '')
    : c.modulos.map(opt).join(''));
}

// Muestra el nombre completo en la lista desplegable, pero la abreviatura en el campo cerrado.
function syncCicloLabels(){
  const sel = document.getElementById('f_ciclo');
  if(!sel) return;
  const isMobile = () => window.innerWidth <= 600;
  const collapse = () => {
    Array.from(sel.options).forEach(o=>{ if(o.dataset.full) o.textContent = o.dataset.full; });
    if(isMobile()){
      const o = sel.selectedOptions[0];
      if(o && o.dataset.alias) o.textContent = o.dataset.alias;
    }
  };
  const expand = () => Array.from(sel.options).forEach(o=>{ if(o.dataset.full) o.textContent = o.dataset.full; });
  if(!sel._aliasBound){
    sel.addEventListener('mousedown', expand);
    sel.addEventListener('focus', expand);
    sel.addEventListener('blur', collapse);
    sel.addEventListener('change', collapse);
    sel._aliasBound = true;
  }
  collapse();
}

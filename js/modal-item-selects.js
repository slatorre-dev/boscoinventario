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

function renderAulaOptions(list){
  const rows = list || AULAS;
  const opt = a=>`<option value="${a.id}">${escHtml(a.name)}</option>`;
  const globales = rows.filter(a=>!a.departamento);
  const propias = rows.filter(a=>a.departamento);
  if(!globales.length || !propias.length) return rows.map(opt).join('');
  return `<optgroup label="Aulas del centro">${globales.map(opt).join('')}</optgroup>`
       + `<optgroup label="Aula del departamento">${propias.map(opt).join('')}</optgroup>`;
}

function fillModalSelects(){
  document.getElementById('f_aula').innerHTML=renderAulaOptions();
  document.getElementById('f_ciclo').innerHTML='<option value="">Sin asignar</option>'+CICLOS.map(c=>`<option value="${c.id}" data-alias="${cicloAlias(c)}" data-full="${escHtml(c.icon+' '+c.name)}">${escHtml(c.icon+' '+c.name)}</option>`).join('');
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
  sel.innerHTML='<option value="">Sin asignar</option>'+c.modulos.map(m=>`<option value="${cId}__${m.cod}">${m.name}</option>`).join('');
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

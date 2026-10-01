// ═════════════════════════════════════════════════════════
// TAGS DE LA FICHA DE ÍTEM: sugerencias, normalización y autocompletado
// Extraído de js/modal-item.js (modularización oportunista, Pendiente #26
// de claude.md). Script CLÁSICO, no type="module" — mismo motivo que
// js/modal-item-selects.js: modal-item.js no puede pasar a módulo sin
// romper sus globales. Funciones globales (las llaman modal-item.js,
// modal-item-selects.js y otros archivos):
//   fillTagSuggestions, cleanTag, findCanonicalTag, tagTrigramSimilarity,
//   initTagsAutocomplete, showTagsDropdown, hideTagsDropdown,
//   addTagFromDropdown (onclick= en el desplegable)
// ═════════════════════════════════════════════════════════

function fillTagSuggestions(){
  const list = document.getElementById('tagList');
  if(!list) return;
  const seen = new Set();
  const tags = [...(TAGS || []), ...(items || []).flatMap(itemTags)]
    .map(x => String(x || '').trim())
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(tagNameCompare);
  list.innerHTML = tags.map(tag => `<option value="${escHtml(tag)}"></option>`).join('');
}

function cleanTag(tag){
  return String(tag || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-áéíóúñàèìòù]/gi, '')
    .trim()
    .substring(0, 50);
}

function _normTag(s){
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
}

function _trigrams(s){
  const set = new Set();
  if(s.length < 3){ set.add(s); return set; }
  for(let i=0;i<s.length-2;i++) set.add(s.slice(i,i+3));
  return set;
}

function tagTrigramSimilarity(a, b){
  const ta = _trigrams(_normTag(a));
  const tb = _trigrams(_normTag(b));
  if(!ta.size || !tb.size) return 0;
  const inter = [...ta].filter(g => tb.has(g)).length;
  return inter / (ta.size + tb.size - inter);
}

function findCanonicalTag(typed){
  if(!typed || !TAGS.length) return null;
  const normTyped = _normTag(typed);
  const exact = TAGS.find(t => _normTag(t) === normTyped);
  if(exact && exact !== typed) return exact;
  let best = null, bestScore = 0;
  for(const candidate of TAGS){
    const score = tagTrigramSimilarity(typed, candidate);
    if(score > bestScore){ bestScore = score; best = candidate; }
  }
  return bestScore >= 0.65 && best !== typed ? best : null;
}

function initTagsAutocomplete(){
  const input = document.getElementById('f_tags');
  if(!input || input._tagsAutocompleteInit) return;
  input._tagsAutocompleteInit = true;
  input.addEventListener('input', () => {
    fillTagSuggestions();
    showTagsDropdown();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => hideTagsDropdown(), 150);
    const val = input.value.trim();
    if(val){
      const tags = val.split(',').map(cleanTag).filter(Boolean);
      const normalized = [];
      const changed = [];
      for(const t of tags){
        const canon = findCanonicalTag(t);
        if(canon){ normalized.push(canon); changed.push(`"${t}" → "${canon}"`); }
        else normalized.push(t);
      }
      const newTags = normalized.filter(t => !TAGS.includes(t) && t.length > 0);
      if(newTags.length){
        TAGS.push(...newTags);
        TAGS.sort(tagNameCompare);
        fillTagSuggestions();
      }
      input.value = normalized.join(', ');
      if(changed.length) toast(`Tag normalizado: ${changed.join(', ')}`, 'ok');
    }
  });
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') e.preventDefault();
  });
}

function showTagsDropdown(){
  const input = document.getElementById('f_tags');
  if(!input) return;
  const val = (input.value || '').split(',').pop().trim().toLowerCase();
  const dd = document.getElementById('tagsDropdown');
  if(!dd) return;

  const suggestions = val
    ? TAGS.filter(t => t.toLowerCase().includes(val)).slice(0, 8)
    : TAGS.slice(0, 8);

  if(!suggestions.length){
    dd.style.display = 'none';
    return;
  }

  dd.innerHTML = suggestions.map(tag => `
    <div class="dd-item" onclick="addTagFromDropdown('${tag.replace(/'/g, '\\\'')}')">
      ${escHtml(tag)}
    </div>
  `).join('');
  dd.style.display = 'block';
}

function hideTagsDropdown(){
  const dd = document.getElementById('tagsDropdown');
  if(dd) dd.style.display = 'none';
}

function addTagFromDropdown(tag){
  const input = document.getElementById('f_tags');
  if(!input) return;
  const parts = input.value.split(',');
  parts[parts.length - 1] = tag;
  input.value = parts.join(', ');
  input.focus();
  hideTagsDropdown();
}

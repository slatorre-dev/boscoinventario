// ═════════════════════════════════════════════════════════
// ALTA RÁPIDA DE ÍTEM
// En un alta nueva en blanco (openModal sin id ni src →
// _isBlankNewItemSession) la ficha muestra solo lo imprescindible: Nombre,
// Aula, Ubicación, Fotos y Cantidad/Mínimo/Tipo. El resto (ref, fecha,
// categoría, tags, estado, secciones plegables) queda tras
// "⚙️ Más detalles". Editar, duplicar o venir de la cámara con datos →
// ficha completa. Ocultar no borra valores: lo preseleccionado se guarda.
// ═════════════════════════════════════════════════════════
function aplicarModoRapido(activo){
  const modal = document.getElementById('mItem');
  if(!modal) return;
  modal.classList.toggle('rapido', !!activo);
  // Ciclo/Módulo: fuera solo si ya viene el módulo preseleccionado
  // (📌 Mis Cursos); si no, a la vista para poder elegirlo.
  const fila = modal.querySelector('.ciclo-mod-row');
  if(fila) fila.classList.toggle('mr-auto', !!document.getElementById('f_mod')?.value);
}

function mostrarFichaCompleta(){
  aplicarModoRapido(false);
  if(typeof updateModalCompletion === 'function') updateModalCompletion();
}

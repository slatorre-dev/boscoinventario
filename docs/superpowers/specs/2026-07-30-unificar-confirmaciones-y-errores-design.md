# Unificar confirmaciones, errores y validación de formulario — Diseño

**Fecha:** 30/07/2026
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Un análisis de usabilidad del frontend (vanilla JS, sin módulos, ~28 archivos
en `js/` cargados como `<script defer>` en orden manual desde `index.html`)
detectó tres problemas de consistencia que afectan directamente a usuarios
no técnicos (jefes de departamento, profesores):

1. **Confirmaciones inconsistentes**: 19 usos de `confirm()` nativo del
   navegador repartidos en 12 archivos (`inventory.js`, `modal-aulas.js`,
   `auth.js`, `modal-ciclos.js`, `modal-item.js`, `prestamos.js` ×3,
   `modal-ubicaciones.js`, `import.js`, `modal-cats.js` ×4, `docs.js` ×2) +
   1 `alert()` (`agente-widget.js:3825`), conviviendo con un modal propio
   `#mConf` (hoy cableado solo para "eliminar ítem", con IDs fijos
   `cTitle`/`cSub`/`cOk` reasignados cada vez) y con un diálogo custom de
   cuenta atrás de 5s para borrado masivo (`inventory.js`). Tres estilos
   visuales distintos para la misma acción de "confirmar antes de actuar".
2. **Mensajes de error técnicos sin traducir**: patrones como
   `toast('Error: '+err.message,'err')` exponen texto crudo de excepciones
   JS o códigos HTTP (401, etc.) a usuarios finales sin contexto técnico.
3. **Validación de formulario poco localizada**: en el modal de ítem
   (`modal-item.js`, `saveItem()`), solo 3 de 25+ campos se validan
   (nombre, ciclo/departamento, módulo/asignatura) y el único feedback es
   un `toast()` genérico abajo a la derecha — no señala qué campo concreto
   falló ni hace scroll/focus hacia él.

## Objetivo

Unificar estos tres patrones reutilizando la UI que la app ya tiene
(modal `#mConf` generalizado, sistema de `toast()` existente), sin
introducir dependencias nuevas ni frameworks. Alcance: reemplazar los 19
`confirm()` + 1 `alert()` existentes, traducir los mensajes de error más
frecuentes, y mejorar la validación inline del modal de ítem.

Fuera de alcance: no se añade validación nueva más allá de los 3 campos
actuales: solo se mejora cómo se comunica el fallo de esa validación
existente. No se toca el diálogo de cuenta atrás de borrado masivo
(`_bulkDelDialog`), que resuelve un caso distinto (segunda confirmación
reforzada) y ya está bien diferenciado a propósito.

## Diseño

### 1. `confirmDialog(options): Promise<boolean>`

Nuevo archivo `js/ui-helpers.js`, cargado en `index.html` justo después de
`js/state.js` (línea 1559) y antes de cualquier archivo que lo consuma —
todos los scripts son globales sin módulos ES, así que el orden de carga
importa.

Generaliza el modal `#mConf` ya existente en `index.html` (línea ~1316):
en vez de estar cableado a IDs fijos para un único caso ("eliminar ítem"),
`confirmDialog()` rellena esos mismos elementos dinámicamente y devuelve
una Promise:

```js
function confirmDialog({title, message, confirmText='Continuar', danger=false, icon}={}) {
  return new Promise(resolve => {
    document.getElementById('cTitle').textContent = title ?? (danger ? '¿Estás seguro?' : 'Confirmar');
    document.getElementById('cIcon').textContent = icon ?? (danger ? '🗑️' : '⚠️');
    document.getElementById('cSub').textContent = message;
    const okBtn = document.getElementById('cOk');
    okBtn.textContent = confirmText;
    okBtn.classList.toggle('btn-danger', danger);
    const cleanup = (result) => { closeConf(); resolve(result); };
    okBtn.onclick = () => cleanup(true);
    document.getElementById('mConf')._pendingResolve = cleanup;
    document.getElementById('mConf').classList.add('open');
  });
}
```

Notas de integración:
- El icono del modal (`🗑️` hardcodeado en el HTML como `<div>` sin id,
  línea ~1318) pasa a tener `id="cIcon"` para poder cambiarlo.
- El cierre existente por X/Escape/click-fuera (`closeConf()`) debe
  también invocar `_pendingResolve(false)` si existe, y limpiarlo después
  — un único punto de resolución evita promesas colgadas si el usuario
  cierra el modal sin pulsar el botón de confirmar.
- `modal-item.js` (`openDeleteConfirm` o equivalente, línea ~1030) se
  reescribe para usar `confirmDialog()` en vez de su cableado manual
  actual, quedando como el resto de llamadas.
- Los 19 sitios existentes cambian de `if(!confirm('X')) return;` a
  `if(!await confirmDialog({message:'X'})) return;` (requiere que la
  función contenedora sea `async`; se verifica caso por caso — la mayoría
  ya lo son porque hacen `await apiPost(...)` después).
- El caso con rama positiva (`prestamos.js:292`) pasa a
  `if(await confirmDialog({message:'...'})) openProfModal();`.
- El `alert()` de error de cámara (`agente-widget.js:3825`) se sustituye
  por `toast(msg, 'err')` (ya definido en `inventory.js:1713`), sin pasar
  por `confirmDialog` (no es una confirmación, es un aviso).

### 2. `friendlyError(err): string`

Misma ubicación (`js/ui-helpers.js`). Traduce errores comunes antes de
pasarlos a `toast()`:

```js
function friendlyError(err) {
  const msg = String(err?.message || err || '');
  if (/401/.test(msg)) return 'Sesión caducada. Vuelve a iniciar sesión.';
  if (/403/.test(msg)) return 'No tienes permiso para hacer esto.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Sin conexión. Comprueba tu red e inténtalo de nuevo.';
  console.error(err);
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}
```

Uso: los sitios que hoy hacen `toast('Error: '+err.message,'err')` pasan a
`toast(friendlyError(err),'err')`. El mensaje técnico original se preserva
en consola (`console.error`) para depuración, nunca se pierde información
para quien desarrolle, solo se oculta al usuario final.

No se persigue cobertura exhaustiva de todos los mensajes de backend
posibles — cubre los patrones repetidos detectados (red, 401, 403) y cae
a un genérico seguro para el resto. Ampliable después si aparecen más
patrones recurrentes.

### 3. Validación inline en el modal de ítem

En `saveItem()` (`modal-item.js`), la validación existente de 3 campos
(nombre, ciclo/departamento, módulo/asignatura) deja de depender solo de
`toast()`. Se añade una función helper `markFieldError(fieldId, message)`
que:

- Añade una clase `.field-error` al contenedor del campo (borde rojo,
  reutilizando el color `--red` ya definido en `styles.css`).
- Inserta o actualiza un `<span class="field-error-msg">` justo debajo del
  campo, con el mensaje concreto — mismo patrón visual que `.login-error`
  ya existente en la pantalla de login (`auth.js`/`styles.css`), reusado
  aquí en vez de crear un componente nuevo.
- Hace `scrollIntoView({behavior:'smooth', block:'center'})` + `.focus()`
  sobre el primer campo con error.
- Se limpia (`clearFieldErrors()`) al reintentar guardar o al cambiar el
  valor del campo (listener `input`/`change`).

El `toast()` genérico se mantiene como aviso adicional ("Revisa los campos
marcados") pero deja de ser el único punto de feedback.

## Archivos afectados

- Nuevo: `js/ui-helpers.js`
- `index.html`: añadir `<script defer src="js/ui-helpers.js">` tras
  `state.js`; añadir `id="cIcon"` al icono de `#mConf`.
- `js/modal-item.js`: generalizar uso de `#mConf`, añadir
  `markFieldError`/`clearFieldErrors` en `saveItem()`.
- `js/inventory.js`, `js/modal-aulas.js`, `js/auth.js`,
  `js/modal-ciclos.js`, `js/prestamos.js`, `js/modal-ubicaciones.js`,
  `js/import.js`, `js/modal-cats.js`, `js/docs.js`, `js/agente-widget.js`:
  reemplazar `confirm()`/`alert()` por `confirmDialog()`/`toast()`.
- `css/styles.css`: clases `.field-error`, `.field-error-msg`,
  `.btn-danger` (si no existe ya un estilo equivalente para botón de
  peligro en `#mConf`).

## Testing

Sin framework de tests automatizados en el proyecto (confirmado: no hay
`package.json` con test runner para el frontend). Verificación manual tras
implementar:
- Cada uno de los 19 puntos migrados: confirmar que aparece el modal
  (no el diálogo nativo del navegador) y que aceptar/cancelar/Escape
  hacen lo esperado.
- Simular un error 401 y uno de red (offline) para verificar
  `friendlyError()`.
- Enviar el formulario de ítem con nombre vacío: verificar que el campo
  se resalta, hace scroll y recibe foco.

## Riesgos

- Runtime sin módulos ES: si `ui-helpers.js` no carga antes que sus
  consumidores, fallará en silencio (funciones no definidas). Mitigado
  colocándolo justo después de `state.js`, el segundo script cargado.
- `confirmDialog()` requiere `await`, así que cualquier función que lo
  use debe ser `async`. Se revisa caso por caso al migrar cada uno de los
  19 sitios (la mayoría ya son `async` porque llaman a `apiPost`).

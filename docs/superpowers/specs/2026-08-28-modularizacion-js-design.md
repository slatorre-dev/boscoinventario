# Modularización progresiva de JS — Diseño

**Fecha:** 28/08/2026
**Estado:** Diseño aprobado, sin implementar. Ritmo de ejecución: **oportunista**
(no es un proyecto dedicado — se aplica la próxima vez que una tarea real
toque uno de los archivos grandes, extrayendo una sola pieza cada vez).
**Autonomía (decisión del usuario, 28/08/2026):** aplicar el checklist
**sin pedir confirmación cada vez** cuando una tarea real ya vaya a tocar
uno de los 4 archivos — no es necesario preguntar "¿extraigo esto también
aparte?" antes de hacerlo. Sigue aplicando: una sola pieza por vez, commit
de extracción siempre separado del commit de la tarea, y verificación
dirigida del flujo tocado antes de dar la extracción por buena.
**Origen:** Pendiente histórico en `docs/ROADMAP.md` [2.2] "Modularizar
JavaScript (ES6 modules)" y `docs/superpowers/plans/2026-08-24-mejoras-codigo-ux-ui.md`
Fase 7 "Modularización progresiva" — ninguno de los dos llegó a detallarse
en un proceso concreto. Este documento los sustituye como referencia.

---

## Problema

`js/` tiene 34 archivos cargados como `<script defer>` clásicos en
`index.html`, sin `import`/`export`, compartiendo un único espacio de
nombres global (`SESSION`, `CATS`, `AULAS`, y cientos de funciones
top-level). Cuatro archivos concentran el grueso de la lógica y son
difíciles de mantener por tamaño:

| Archivo | Líneas | Commits que lo tocan | Otros `.js` que llaman a sus funciones |
|---|---|---|---|
| `js/agente-widget.js` | 4397 | 84 | **0** — ya está envuelto en un IIFE propio, nadie más lo invoca |
| `js/prestamos.js` | 1372 | 47 | 1 (`js/modo-clase.js`) |
| `js/inventory.js` | 1818 | 108 | 4 (`js/modal-cats.js`, `js/multi-equipo.js`, `js/nav.js`, `js/search.js`) |
| `js/modal-item.js` | 1900 | 83 | **7** (`agente-widget`, `camara-serie`, `camara-unificada`, `inventory`, `modal-auditoria`, `nav`, `search`) |

(Commits = `git log --oneline -- js/<archivo> | wc -l` a 28/08/2026. Fan-in
= `grep -l` de las funciones públicas probables del archivo en el resto de
`js/*.js`.)

`index.html` (2351 líneas) y `css/styles.css` (2672 líneas) quedan **fuera
de alcance** de este diseño — ver "No objetivos".

### Hallazgo crítico que condiciona el enfoque

Muchos `onclick="..."` no están solo en el HTML estático de `index.html`:
se generan dentro de plantillas JS inyectadas con `innerHTML`. Ejemplo real
(`js/inventory.js:8`, dentro de `renderSubStats()`):

```js
onclick="_subFilter=null;renderInv()"
```

Ese `onclick` se resuelve contra el scope global en tiempo de ejecución,
tanto si viene del HTML estático como si lo genera JS dinámicamente.
Cualquier función referenciada así **tiene que seguir existiendo como
global** (`window.fn`), sea cual sea la técnica de modularización elegida.
No es una preferencia de diseño — es una restricción real del código
actual, y define la regla central del proceso (ver más abajo).

---

## Objetivo

Reducir el tamaño y el acoplamiento oculto de los archivos JS grandes,
de forma que:

- Se pueda entender y tocar una pieza sin tener que cargar el archivo
  entero en la cabeza.
- Las dependencias entre piezas queden explícitas (`import`/`export`)
  en vez de implícitas (orden de `<script>` + scope global).
- El proceso se pueda aplicar **incrementalmente**, una pieza cada vez,
  sin necesitar una sesión dedicada ni arriesgar una reescritura grande
  de una vez.

## No objetivos (alcance descartado explícitamente, decisión del usuario 28/08/2026)

- **No** se toca `index.html` ni `css/styles.css` en esta fase. Trocear
  el marcado de los ~30 modales de `index.html` no tiene una forma nativa
  sin JS ni build step (no hay SSI ni `<include>`); si se decide abordarlo,
  necesita su propio diseño aparte.
- **No** se introduce ningún bundler (esbuild, Vite, webpack...). Ver
  justificación en "Enfoque técnico".
- **No** se migra a TypeScript.
- **No** se reescribe lógica de negocio ni se cambia comportamiento — cada
  extracción es un movimiento literal de código, no una mejora funcional.
- **No** resuelve la falta de tests de frontend/E2E (sigue abierto en
  `CLAUDE.md` Pendiente #21 del 27-28/08/2026, sub-proyecto aparte). Este
  proceso se apoya en verificación manual/Playwright dirigida por commit,
  no en cobertura automática.
- **No** es un proyecto con fecha de fin. Es un proceso que se repite cada
  vez que toque, hasta que dé por sí solo con los cuatro archivos grandes.

---

## Enfoque técnico: ES modules nativos, sin bundler

**Alternativas consideradas:**

1. **Bundler (esbuild/Vite) + ES modules** — el que proponía originalmente
   `docs/ROADMAP.md` [2.2]. Permite tree-shaking y un único bundle de
   salida, pero añade un paso de build nuevo al despliegue, que hoy es
   literalmente "`git push` → Cloudflare Pages despliega solo" (ver
   `CLAUDE.md`, Workflow Estándar). Un build que puede fallar en silencio,
   con sourcemaps y minificación de por medio, es un riesgo
   desproporcionado para un proyecto mantenido por una sola persona sin
   CI de frontend. **Descartado.**
2. **Reorganizar en archivos más pequeños sin `import`/`export`** — solo
   trocear, seguir dependiendo del orden de `<script>` y del scope global
   para todo, como hoy. Es lo más simple de entender, pero no resuelve el
   problema real ("dependencias claras" — ver `docs/ROADMAP.md` [2.2]):
   seguiría sin haber forma de saber qué depende de qué sin leer el
   código, y los bugs de orden de carga seguirían siendo posibles.
   **Descartado como técnica principal**, aunque es la red de seguridad si
   los módulos ES dieran algún problema inesperado en el piloto.
3. **`<script type="module">` nativo, sin bundler — elegido.** Todos los
   navegadores modernos lo soportan sin ninguna herramienta nueva.
   Permite `export`/`import` explícito entre los archivos que se vayan
   partiendo — un `import` de un nombre que no existe falla de forma
   visible en la consola, en vez del bug silencioso de hoy (una función
   usada antes de que su `<script>` se cargue, o renombrada en un archivo
   sin actualizar otro). Cloudflare Pages no necesita ningún cambio de
   configuración: sigue sirviendo archivos estáticos tal cual.

**Por qué se puede hacer archivo por archivo, sin convertir todo de
golpe:** un módulo ES puede seguir leyendo con total normalidad los
globales que ya existen en `window` (`SESSION.usuario`, `CATS`,
`apiCall(...)`, puestos ahí por los `<script>` clásicos de
`config.js`/`state.js`/`api.js`) — lo único que un módulo **no** hace
automáticamente es exponer sus propias `const`/`function` de nivel
superior a `window`. Eso significa que **no hace falta convertir
`config.js`/`state.js`/`api.js` ni ningún otro archivo** para empezar:
solo el archivo que se está partiendo pasa a `type="module"`, y
reexpone explícitamente (`window.fn = fn`) lo que el hallazgo crítico
de arriba exija.

---

## El proceso (checklist repetible)

Aplicar la próxima vez que una tarea real (feature o bug) obligue a tocar
uno de los archivos grandes. No hace falta terminar el archivo en una
sesión — se avanza una pieza cada vez.

1. **Mapear la superficie pública del archivo** antes de tocar nada:
   - `grep -o 'onclick="[a-zA-Z_][a-zA-Z0-9_]*(' index.html` y lo mismo
     dentro de las plantillas JS del propio archivo (buscar sus nombres
     de función dentro de template strings con `onclick=`/`onXxx=`).
   - `grep -l "nombreFuncion(" js/*.js` para cada función top-level del
     archivo, para ver qué otros archivos la llaman directamente.
   - Esa lista combinada es el contrato que la extracción no puede
     romper. Anotarla (aunque sea en el mensaje del commit) para que el
     reviewer — humano o Claude — sepa qué se prometió no tocar.

2. **Elegir una sola pieza cohesionada para extraer** — no el archivo
   entero de una vez. Preferir la pieza con menos llamadas de vuelta al
   resto del archivo (menor acoplamiento interno = extracción más
   segura). Ver "Orden de prioridad" y el ejemplo de piloto más abajo
   para candidatos concretos.

3. **Crear `js/<original>-<pieza>.js`:**
   - Mover el código **tal cual**, sin cambiar comportamiento en este
     commit (es un movimiento, no una mejora funcional — eso puede ir en
     un commit posterior si hace falta).
   - Añadir `export` a lo que el archivo original necesite importar de
     vuelta.
   - `import { ... } from './archivo-pieza.js'` en el archivo original.
   - `window.fn = fn` explícito para cada nombre detectado en el paso 1
     que viva en el archivo nuevo.

4. **Actualizar `index.html`:** cambiar a `type="module"` los dos
   `<script>` afectados (el original y el nuevo), manteniendo su posición
   relativa en la lista. Los scripts `defer` y `type="module"` se
   ejecutan en orden de documento salvo que se use `async` — ninguno de
   los `<script>` actuales lo usa — pero **verificarlo en el piloto**
   (mirar la consola: que no aparezca ningún error de "X is not defined"
   por ejecución fuera de orden) en vez de darlo por garantizado sin
   comprobar.

5. **Verificación dirigida, no E2E completo:** abrir en el navegador (o
   con Playwright) el flujo concreto que usa el código movido, confirmar
   que no hay errores de consola y que el comportamiento es idéntico al
   de antes del cambio. Mismo criterio que ya se usó en v633/v645 para
   validar cambios de UI sin una suite de tests de frontend.

6. **Commit atómico y separado:** subir `VERSION` en `sw.js` (regla ya
   existente del proyecto), y commitear la extracción sola — mensaje tipo
   `refactor: extrae <pieza> de <archivo>, sin cambio de comportamiento`
   — **sin mezclar** con el commit de la feature/bug que motivó tocar el
   archivo. Así, si algo se rompe en producción, se puede revertir la
   extracción sin perder el trabajo real que la motivó.

7. **Repetir** la próxima vez que el archivo (o el que quede de él)
   vuelva a tocar por una tarea real.

---

## Orden de prioridad sugerido

No es obligatorio — el ritmo es oportunista, así que en la práctica gana
el archivo que toque una tarea real. Como referencia si hay que elegir:

1. **`js/agente-widget.js` primero.** Es el más grande con diferencia
   (4397 líneas) y tiene **cero dependientes externos** — nadie más lo
   llama, así que un error en una extracción no puede propagarse a
   inventario, préstamos ni ningún otro flujo. Es el piloto natural para
   probar el proceso completo (pasos 1-7) con el menor riesgo posible.
2. **`js/prestamos.js`** — solo 1 dependiente externo (`modo-clase.js`).
3. **`js/inventory.js`** — el más tocado (108 commits), pero con 4
   dependientes externos; abordar una vez probado el proceso en (1)/(2).
4. **`js/modal-item.js`** el último — el más acoplado (7 dependientes
   externos). Necesita el mapeo del paso 1 hecho con más rigor que los
   demás antes de tocarlo, precisamente por ser el que más archivos
   podrían romperse si el contrato público se equivoca.

### Piloto concreto: `js/agente-widget.js` → `js/agente-voz.js`

El archivo ya tiene secciones bien delimitadas por comentarios
(`// ── Nombre de sección ──`), lo que hace posible señalar el primer
corte literal sin necesidad de releer las 4397 líneas cada vez que se
retome:

- **Primer corte (piloto, más pequeño y aislado):** bloque
  "Reconocimiento de voz" (línea 4071 en adelante, ~130 líneas) — wrapper
  de la Web Speech API, con límites claros y sin llamadas de vuelta
  complejas al resto del widget. Extraer a `js/agente-voz.js`. Sirve para
  validar el proceso completo de principio a fin (pasos 1-7) con el
  riesgo más bajo posible antes de aplicarlo a piezas más grandes.
- **Siguientes cortes naturales** (cuando el archivo vuelva a tocarse):
  - Motor de NLP/detección de intención (líneas ~795-4071, ~3200 líneas
    — el bloque más grande con diferencia: búsqueda inteligente,
    detección de intención de préstamo, extracción de aula/ubicación/
    ciclo/módulo/profesor/fecha desde frases, autocompletado de
    formulario, parser central de intenciones). Probablemente necesite
    partirse a su vez en más de un módulo — no es una sola pieza
    cohesionada, es el candidato a decidir cuando se llegue ahí.
  - Panel admin Auditoría/CSV (línea 4282 en adelante) — recién tocado en
    v648 (`applyAgentTabGating()`), autocontenido y de uso exclusivo
    `superadmin`.
  - Lo que quede (construcción de UI, arrastre del FAB, tabs, render de
    chat, init) se queda como el orquestador — el `agente-widget.js`
    resultante, mucho más pequeño que el actual.

---

## Cómo se sabe que esto está funcionando

No hay una métrica de "terminado" — es un proceso continuo. Señales de
que va bien, a revisar de vez en cuando:

- El recuento de líneas de los 4 archivos de la tabla baja con el tiempo.
- Cada extracción es su propio commit, revertible sin arrastrar otros
  cambios.
- Ningún `grep -l` de una función movida aparece ya en el archivo
  original salvo en el `import`.
- No han aparecido errores de "X is not defined" en producción atribuibles
  a una extracción (validaría que el mapeo del paso 1 se hizo bien).

Si en algún punto el proceso genera fricción real (por ejemplo, el orden
de ejecución `module`/`defer` da problemas, o mantener `window.fn = fn`
manualmente se vuelve propenso a errores), es una señal para reconsiderar
la alternativa 2 descartada arriba (trocear sin `import`/`export`) en vez
de forzar módulos ES — no hay compromiso de seguir con este enfoque si
deja de tener sentido.

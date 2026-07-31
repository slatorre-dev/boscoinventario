# Mejoras en Devolver material y recordatorio de vencidos

## Objetivo

4 mejoras puntuales al flujo de préstamos, detectadas al revisar
`js/prestamos.js` en la sesión anterior:

1. El modal Devolver no muestra si el préstamo está vencido.
2. `confirmDevolver()` recarga todo el inventario (`loadData()`) tras cada
   devolución, más lento que el resto de flujos de préstamo (que
   actualizan estado local).
3. No hay aviso si se deja una devolución parcial sin querer.
4. No hay ningún aviso proactivo de préstamos vencidos — hoy solo existe
   un badge pasivo que cuenta, nadie se entera si no entra a mirar.

Autorización: se procede sin ronda de preguntas adicional (autorizado
explícitamente por el usuario), documentando aquí las decisiones de
diseño que en otra circunstancia se habrían preguntado.

## 1. Aviso de vencido en el modal Devolver

`openDevolver(presId)` (`js/prestamos.js:566`) ya tiene acceso al
préstamo completo (`p`) y a `isVencido()` (`js/prestamos.js:8`, ya
existente). Se añade una línea condicional en el bloque `devolverInfo`:
si `isVencido(p)`, mostrar `⚠ Vencido desde el DD/MM/YYYY` (formateando
`p.fechaPrevista`) en rojo (`var(--red)`, ya usado en el proyecto para
vencidos), justo debajo de la línea de "Pendiente de devolver".

## 2. Quitar `loadData()` de `confirmDevolver`

**Backend** (`functions/api/prestar.js:188-203`, acción `devolver`): hoy
devuelve solo `{ok:true}`. Se cambia para que devuelva también el
préstamo actualizado y el nuevo `qty` del ítem:

```js
return Response.json({ ok: true, prestamo: { ...pres, fechaDevolucion: fecha, cantidadDevuelta, estado, obs: obs || '' }, nuevoQty: <valor tras el UPDATE> });
```

El nuevo `qty` se obtiene leyendo `inventario.qty` tras el `UPDATE ...
SET qty = qty + ?` ya existente (una lectura adicional, o calculando
`qty_anterior + cantidadDevuelta` si se lee antes del `UPDATE` — se
prefiere leer tras el `UPDATE` para evitar condiciones de carrera con
otro préstamo/devolución concurrente).

**Frontend** (`confirmDevolver`, `js/prestamos.js:591-605`): sustituir
`await loadData(); goPrestamos();` por actualización local, mismo patrón
que `confirmPrestar`/`confirmPrestarCaja`:

```js
const idx = prestamos.findIndex(x=>Number(x.id)===Number(devolverPresId));
if(idx>=0) prestamos[idx] = res.prestamo;
const itemIdx = items.findIndex(x=>Number(x.id)===Number(res.prestamo.itemId));
if(itemIdx>=0) items[itemIdx].qty = res.nuevoQty;
closeDevolver();
toast('Devolución registrada','ok');
goPrestamos();
```

Sin `await loadData()` — igual de consistente que los otros flujos, sin
recargar todo el backend en cada devolución.

## 3. Aviso de devolución parcial

En el modal Devolver, añadir un aviso en vivo (mismo patrón que
`ag-loan-stock-warn` de Volt, `js/agente-widget.js`) bajo el input
`dev_cant`: si `cant < pendiente` (el máximo calculado en
`openDevolver`), mostrar `⚠ Quedarán N unidad(es) sin devolver` en ámbar
(`var(--amber)`). Se recalcula en el evento `oninput` del campo
`dev_cant`, comparando contra el `pendiente` guardado como `data-max` (o
reutilizando `cantInput.max` ya seteado) al abrir el modal. No bloquea el
envío — solo informativo, igual que el aviso de stock de Volt.

## 4. Recordatorio proactivo de préstamos vencidos

**Descartado: cron/scheduled worker.** El proyecto usa Cloudflare Pages
Functions (`functions/api/`), no Workers con Cron Triggers configurados
(`wrangler.toml` no tiene sección `[triggers]` ni binding de tipo
scheduled). Añadir un cron real es un cambio de infraestructura de
despliegue distinto del resto de este trabajo, con más riesgo (requiere
un Worker aparte o migrar el proyecto a Workers + Assets) y no se aborda
aquí.

**Diseño elegido: notificación disparada por uso, no por tiempo.** Cuando
cualquier usuario del departamento visita la página de Préstamos
(`goPrestamos()`, ya existe) y hay préstamos vencidos de su departamento
que no se han notificado aún, se dispara un email al jefe/a de
departamento (`usuarios.rol='jefe/a departamento'` de ese `departamento`,
igual que ya hace `notifyResponsableModulo` con el email del responsable
de módulo) resumiendo los vencidos, y se marcan como notificados para no
repetir el envío en cada visita.

**Backend** — nueva columna `prestamos.notificado_vencido INTEGER DEFAULT
0` (migración `0022`). Nuevo endpoint en `functions/api/prestar.js`,
acción `notificarVencidos`:
- Recibe `{}` (sin parámetros, usa el departamento del usuario
  autenticado vía `data.departamento`, igual que el resto de acciones).
- Selecciona préstamos `estado IN ('Activo','Parcial')`,
  `fechaPrevista < hoy`, `notificado_vencido=0`, del departamento del
  actor (`itemDept` por cada uno, o join a `inventario.departamento`
  igual que hace `list.js` para el histórico de préstamos).
- Si no hay ninguno: responde `{ok:true, enviados:0}` sin hacer nada más.
- Si hay: busca el email del jefe/a de departamento
  (`SELECT email FROM usuarios WHERE departamento=? AND
  rol='jefe/a departamento' AND email!=''`), construye un HTML con la
  lista (ítem, profesor, días de retraso) reusando el patrón de
  `sendGmail`/`notifyResponsableModulo` ya existente, y lo envía.
- Marca esos préstamos con `UPDATE prestamos SET notificado_vencido=1
  WHERE id IN (...)` — se ejecuta tanto si el email tuvo éxito como si
  falló (igual que `notifyResponsableModulo` ya traga errores de envío
  sin bloquear el flujo principal) para no reintentar en bucle contra un
  email mal configurado; el catch de `sendGmail` ya existe.
- Sin destinatario válido (jefe/a sin email o rol no encontrado): igual
  se marcan como notificados (evita reintentos infinitos) y se responde
  `{ok:true, enviados:0, motivo:'sin destinatario'}`.

**Frontend** — en `goPrestamos()` (`js/prestamos.js:44`), tras calcular
`vencidos` (ya existente, línea ~56), si `vencidos > 0` disparar
`apiPost({action:'notificarVencidos'})` una vez por sesión de página
(variable de módulo `_vencidosNotifCheckDone`, para no repetir la llamada
cada vez que se navega a Préstamos dentro de la misma sesión de la app —
el backend ya es idempotente por `notificado_vencido`, pero evita tráfico
de red innecesario). Llamada "fire and forget" (no bloquea el render de
la página, sin await en el flujo principal, solo `.catch()` silencioso).

## Fuera de alcance

- No se toca el resto de la lógica de vencidos ya existente
  (`isVencido`, `getVencidos`, `getVencidosParaUsuario`, el badge).
- No se añade configuración de frecuencia/opt-out del email — un único
  envío por préstamo vencido es el comportamiento pedido, sin
  reenvíos periódicos.
- No se migra el proyecto a Workers con Cron Triggers.

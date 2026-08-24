# Plan de mejoras de codigo, usabilidad e interfaz

> Plan de trabajo incremental para Inventario IES Juan Bosco. Cada fase debe
> validarse en codigo y navegador antes de iniciar la siguiente.

## Objetivo

Reducir la friccion en tablet y movil, mejorar la robustez de actualizaciones y
accesibilidad, y disminuir riesgos tecnicos sin cambiar el modelo de datos ni
romper los flujos de inventario, prestamos y camara.

## Reglas de ejecucion

- Una fase funcional por commit.
- Incrementar `VERSION` en `sw.js` cuando cambie el frontend.
- Validar sintaxis, `git diff --check` y una prueba Playwright del flujo tocado.
- Probar en 1280px, 1024px, 768px y 390px cuando afecte a responsive.
- No tocar copias historicas (`Copia_29_05_26/` y `migracionApache/`).
- Hacer commit y push al terminar cada fase.
- No cambiar esquema D1 sin migracion y backup previo.

## Fase 1 - Toolbar tablet

**Problema:** en tablet el toolbar puede crecer a varias filas. La visibilidad
aplicada con `style.display` desde `js/roles.js` puede sobrescribir reglas CSS
responsive.

**Implementacion:**

- Controlar la visibilidad del grupo de botones mediante clases responsive,
  no mediante estilos inline incompatibles con el menu.
- Mantener en una sola fila logo, departamento activo, estado, usuario y menu.
- Llevar las acciones secundarias al menu hamburguesa entre 641px y 1200px.
- Mantener todos los permisos actuales y comprobar que el menu sigue abriendo.

**Validacion:** medir altura del `.topbar`, comprobar ausencia de overflow
horizontal y abrir cada accion principal en Playwright.

## Fase 2 - Actualizacion PWA fiable

- Completar la lista de recursos precacheados de `sw.js`.
- Detectar recursos cargados por `index.html` que falten en la cache.
- No recargar mientras haya un formulario o modal con cambios sin guardar.
- Mostrar una accion clara para actualizar cuando haya nueva version.
- Validar instalacion, actualizacion y carga offline basica.

## Fase 3 - Busqueda y filtros coherentes

- Incluir `serie` en el filtro local cuando la interfaz lo anuncie.
- Unificar normalizacion de tildes, mayusculas, referencias y tags.
- Mantener busqueda rapida en Home y en inventario.
- Añadir pruebas para coincidencias por nombre, referencia, proveedor, aula y S/N.

## Fase 4 - Seguridad de sesion

- Sustituir contraseñas en `localStorage` y query params por sesion de servidor.
- Usar cookie `HttpOnly`, `Secure`, `SameSite` y expiracion/revocacion.
- Mantener compatibilidad temporal durante una migracion controlada.
- Revisar logs y limpiar datos sensibles ya almacenados en el navegador.

## Fase 5 - Renderizado seguro y errores recuperables

- Centralizar `escapeHtml` para datos procedentes de D1 o usuario.
- Eliminar handlers inline generados con datos.
- Añadir timeouts y `AbortController` a peticiones largas.
- Mostrar reintento para errores de carga y diferenciar sesion caducada,
  falta de red y error de servidor.

## Fase 6 - Tour, accesibilidad y estados vacios

- Evitar que el tour automatico bloquee el primer uso sin opcion de omitirlo.
- Gestionar foco y tecla Escape en modales.
- Añadir `aria-label`, `aria-live` y foco visible a controles iconograficos.
- Crear estados vacios por aula, categoria y busqueda sin resultados.

## Fase 7 - Modularizacion progresiva

- Separar API/sesion, estado, inventario, prestamos y modales en modulos ES.
- Extraer un controlador comun para captura de camara y permisos.
- Reducir fuentes de verdad duplicadas entre fallback local y D1.
- Incorporar pruebas de contratos para permisos, hash routing y Service Worker.

## Orden de parada

Si una fase rompe login, permisos, datos, prestamos o camara, detener la
siguiente fase, corregir y repetir la validacion de la fase actual.

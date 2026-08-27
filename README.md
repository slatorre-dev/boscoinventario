# Bosco Inventario — IES El Bosco

Sistema web de gestión de inventario para el IES El Bosco. Accesible desde
cualquier dispositivo (PC, móvil, tablet) sin instalación, funciona también
sin conexión.

Nació como el inventario de un único departamento y ya está desplegado como
inventario general de todo el centro, con cada departamento gestionando el
suyo desde la misma aplicación. Ver
[docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md) para el
detalle del despliegue.

---

## Qué hace la aplicación

### Acceso y usuarios

- Login con usuario y contraseña, o con **Google (OAuth)**
- Roles: **Consulta** (solo lectura), **Profesor/a** (préstamos y edición
  básica), **Jefe/a de Departamento** (acceso completo a su departamento),
  **Superadmin** (ve y gestiona todos los departamentos del centro)
- Bloqueo de cuenta tras 5 intentos fallidos de login, con panel de
  administración para desbloquear y gestionar accesos
- Gestión de usuarios: alta, baja, cambio de rol y asignación de aulas y
  módulos/ciclos desde la propia app
- Autoservicio: cada profesor/a elige sus propios módulos y aulas
  ("📌 Mis Cursos/Aulas" en la barra superior) y, si su correo de Google no
  trae uno asignado, su propio departamento
- Perfil personal: cambiar nombre, email y contraseña
- Historial de todas las acciones con fecha y usuario responsable

### Inventario principal

- Ítems catalogados con: nombre, referencia, aula, ubicación exacta
  (armario, estantería…), categoría, ciclo formativo, módulo, tipo
  (consumible/inventariable), cantidad, mínimo de stock, estado, proveedor,
  fecha de revisión, foto y observaciones
- Búsqueda en tiempo real insensible a mayúsculas y tildes, con matching en
  singular y plural
- Filtros combinables: por aula, categoría, ciclo, estado, tipo de material
  y texto libre
- Vista tabla o vista tarjetas, adaptadas a móvil
- Paginación configurable (10, 25, 50 ítems)
- Código QR por ítem: generado automáticamente, imprimible individualmente o
  en lote
- Posibilidad de ocultar ítems (solo visibles para administradores)
- Contenedores (prefijo `SET-` y `CONT-`): agrupan componentes en conjuntos
  o cajas físicas, con generación automática de unidades hijas

### Selección en lote

Selecciona varios ítems a la vez y aplica:
- Cambio de aula, ubicación, categoría, ciclo/módulo o tipo de material
- Añadir o reemplazar tags
- Marcar para mantenimiento
- Cambiar imagen en bloque
- Exportar a CSV o imprimir listado
- Eliminar con cuenta atrás de 5 segundos (doble confirmación)

### Préstamos

- Registrar préstamo: ítem, profesor, cantidad, aula destino y fecha de
  devolución prevista
- Préstamo de caja completa: registra un préstamo por cada componente del
  conjunto en un solo paso
- Devolución total o parcial
- Estados: Activo, Parcial, Devuelto, Vencido
- Vistas agrupadas: por profesor, por aula, por material
- Gestión de profesores prestatarios (nombre, departamento, email,
  importables desde CSV)
- Resaltado automático de préstamos vencidos

### Fotos y documentos

- Foto principal del ítem: subir desde archivo, hacer foto con la cámara del
  móvil directamente o arrastrar imagen
- Compresión automática antes de guardar
- Documentos adjuntos por ítem (PDF, imágenes, Word, Excel…) almacenados en
  Google Drive
- Vista ampliada de foto con un toque

### Cámara e identificación por IA

Un único botón de cámara en Inicio cubre todo el escaneo:
- Detección continua de **código QR** y **código de barras**
- Identificación por **número de serie o foto del objeto** vía IA
  (reconocimiento visual + OCR, con aprendizaje por departamento a partir
  de las correcciones reales de los usuarios)
- Tras identificar el ítem por cualquiera de las vías: panel de acciones
  rápido para **préstamo/devolución** ("Me lo llevo" / "Devolver") sin
  pasar por el formulario completo
- **Alta masiva** desde una sola foto de una mesa con varios objetos
- **Revisar aula**: recorre una aula foto a foto confirmando o corrigiendo
  la ubicación de cada ítem
- Tour guiado la primera vez tras iniciar sesión + ayuda permanente

### Agente Volt — IA por chat y voz

Botón flotante que abre un panel de chat para gestionar el inventario en
lenguaje natural: buscar material, añadir ítems, registrar préstamos y
devoluciones, consultar o actualizar stock, marcar mantenimiento, resúmenes
por aula, escanear QR y dictado por voz. Aprende de las correcciones del
usuario. Detalle técnico completo en
[docs/BACKEND_APRENDIZAJE_INTENCIONES.md](docs/BACKEND_APRENDIZAJE_INTENCIONES.md).

### Pedidos, solicitudes y planificación de prácticas

- **🛒 Pedidos**: alta de pedidos de material con aviso por email a
  jefatura y sincronización con la base de datos
- **Solicitudes de material**: circuito independiente de Pedidos, para
  peticiones puntuales de profesorado; jefatura cambia el estado y también
  se avisa por email al crearse
- **Planificación de prácticas**: reserva de material por ciclo/módulo,
  fecha y franja horaria libre, con bloqueo si hay conflicto con otra
  reserva y confirmación de recogida en un clic; plantillas de práctica
  reutilizables para no repetir la misma reserva cada curso
- **🎒 Modo clase**: vista móvil simplificada (botones grandes) pensada
  para llevar al aula, con su propio resumen

### Mantenimiento

- Marcar ítems para mantenimiento (individual o en lote) con estados
  (pendiente, en curso, resuelto…) y coste asociado
- Listado de mantenimiento acotado a "tus aulas" para el profesorado en
  Inicio, con enlace para ver todo el departamento

### Auditoría y calidad de datos

- Panel de auditoría: detecta ítems con campos incompletos (sin aula, sin
  categoría, sin foto, sin ubicación…)
- Filtros por tipo de problema combinables
- Acciones masivas desde el panel de auditoría
- Historial completo de acciones: página visual con timeline agrupado por
  día, avatares de color por tipo, click en ítem navega directamente al
  modal

### Importación y exportación

- Importar CSV: detección automática de columnas, validación previa y vista
  previa de 50 filas antes de confirmar
- Importar backup JSON completo: restaura inventario, aulas, categorías,
  ciclos y profesores
- Exportar CSV del inventario filtrado o completo
- Exportar backup JSON: copia de seguridad completa
- Imprimir listado configurable por columnas
- Etiquetas QR en varios formatos (compacto 6/fila o con datos 5/fila)

### Configuración por departamento

Gestionable desde la app sin tocar código:
- **Aulas**: añadir, eliminar, reordenar, importar desde CSV
- **Categorías**: con icono emoji y color personalizable
- **Tags/etiquetas**: vocabulario controlado de palabras clave
- **Ciclos formativos y módulos**: alta, edición y eliminación con sus
  módulos
- **Ubicaciones sugeridas**: lista de sitios frecuentes (armarios,
  estanterías…)
- **Profesores prestatarios**: gestión del directorio de prestatarios
- **Aulas asignables por admin**: cualquier usuario o rol puede tener aulas
  asignadas desde 🔐 Usuarios, igual que ya existía para módulos

### Inicio personalizado

Para el profesorado, Inicio muestra su propio grid de aulas y las
tarjetas de Stock bajo/Mantenimiento acotadas a "tus aulas" (con enlace
para ver todas). Jefatura de departamento y superadmin ven siempre todo el
departamento. Con una sola aula propia elegida, atajos como "Inventariar
aula" o "＋ Nuevo ítem" saltan directamente el selector de aula.

### Funciona sin conexión (PWA)

- Instalable en el móvil o PC como app
- Carga instantánea desde caché aunque no haya red
- Actualización automática y silenciosa al volver la conexión

---

## Documentación técnica

Este README cubre solo el qué. Para el cómo:

| Documento | Contenido |
|---|---|
| [docs/CONTEXT.md](docs/CONTEXT.md) | Contexto general, origen del proyecto, principios de diseño |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, estructura de archivos, auth, schema D1, PWA |
| [docs/API.md](docs/API.md) | Referencia de endpoints y variables de entorno |
| [docs/BACKEND_APRENDIZAJE_INTENCIONES.md](docs/BACKEND_APRENDIZAJE_INTENCIONES.md) | Agente Volt: NLP, voz, aprendizaje |
| [docs/SECURITY.md](docs/SECURITY.md) | Estado de seguridad actual y pendientes |
| [docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md) | Plan de expansión a todo el centro |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Pendientes a corto/medio plazo |
| [docs/IDEAS.md](docs/IDEAS.md) | Ideas sugeridas sin priorizar |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Historial de sesiones de desarrollo y versionado |
| [docs/MIGRACION_APACHE.md](docs/MIGRACION_APACHE.md) | Migración a servidor Ubuntu/Apache local |

## Puesta en marcha desde cero

### Clonar repo

```bash
git clone https://github.com/slatorre-dev/boscoinventario.git
cd boscoinventario
git checkout main
```

### Instalar Wrangler

```bash
npm install -g wrangler
wrangler login
```

### Crear D1 y aplicar schema

```bash
wrangler d1 create boscoinventario
# copiar database_id a wrangler.toml
wrangler d1 execute boscoinventario --file=migrations/0001_schema.sql
```

### Configurar Cloudflare Pages

```text
Workers & Pages -> Create -> conectar repo GitHub
Settings -> Functions -> D1 database bindings -> DB
Settings -> Environment variables -> secretos Google (ver docs/API.md)
```

### Crear usuario inicial

```bash
wrangler d1 execute boscoinventario --command="INSERT INTO usuarios (usuario,password,nombre,rol,email) VALUES ('Admin','Admin','Administrador','superadmin','')"
```

Cambiar esa contraseña después.

## Flujo de trabajo diario

1. Editar código local.
2. Cambiar `VERSION` en `sw.js`.
3. Commit + push a `main`.
4. Cloudflare Pages despliega automáticamente.

---

*Desarrollado para el IES El Bosco.*

// ═════════════════════════════════════════════════════════
// AULAS — por defecto, modificable por el usuario
// ═════════════════════════════════════════════════════════
// AULAS — se cargan desde Google Sheets, no desde localStorage
const AULAS_DEFAULT=[
  {id:'aula35',name:'Aula 35',icon:'🔧',th:'th-blue',  desc:'Mantenimiento Electrónico'},
  {id:'aula36',name:'Aula 36',icon:'⚡',th:'th-purple',desc:'Electrónica'},
  {id:'aula38',name:'Aula 38',icon:'💡',th:'th-amber', desc:'Electricidad'},
  {id:'aula39',name:'Aula 39',icon:'🔌',th:'th-orange',desc:'Electricidad'},
  {id:'aula40',name:'Aula 40',icon:'📡',th:'th-teal',  desc:'Electrónica'},
  {id:'aula41',name:'Aula 41',icon:'🛠️',th:'th-green', desc:'Electrónica'},
  {id:'aula_dep',name:'Departamento',icon:'🏛️',th:'th-pink',  desc:'Departamento'},
];
let AULAS = AULAS_DEFAULT.slice(); // se reemplazará al cargar datos del backend

// Lista de los 24+1 departamentos — solo se rellena para superadmin (ve todos
// los departamentos), usada en el selector de "departamento de referencia" del perfil.
let DEPARTAMENTOS = [];
let deptActivo = localStorage.getItem('dept_activo_superadmin') || '';

// Nombre legible de un departamento a partir de su slug — usado por los
// modales de gestión (aulas/categorías/ciclos) en la vista global agrupada
// de superadmin cuando no hay un departamento concreto elegido.
function deptNombre(slug){
  return DEPARTAMENTOS.find(d => d.slug === slug)?.nombre || slug;
}
// Filas crudas de `categorias` (con su `departamento`), solo pobladas para
// superadmin (meta.js:catsCrudo, Task 3) — usadas por modal-cats.js para
// filtrar/guardar por deptActivo sin tocar CATS (objeto global fusionado
// usado por 7 archivos del frontend, sin campo departamento por entrada).
let catsCrudo = [];
// true si el propio departamento ya tiene categorías propias en D1
// (meta.js:catsPropias) — inicial `true` para no mostrar el aviso de
// "categorías genéricas" antes de que `meta` cargue (modal-cats.js).
let catsPropias = true;

const TH_OPTIONS = ['th-blue','th-green','th-amber','th-teal','th-orange','th-pink','th-purple','th-red'];

// ═════════════════════════════════════════════════════════
// CICLOS Y MÓDULOS
// ═════════════════════════════════════════════════════════
let MIS_MODULOS = []; // moduloId[] que imparte el usuario logueado (ver meta.js:misModulos)
let MIS_AULAS = []; // aula.id[] en las que da clase el usuario logueado (ver meta.js:misAulas)
let CICLOS = [
  {
    id:'gm_telecom',
    name:'Inst. de Telecomunicaciones',
    alias:'IT',
    nivel:'CFGM',
    icon:'📡',
    th:'th-blue',
    desc:'Grado Medio · Electricidad y Electrónica',
    modulos:[
      {cod:'0237',name:'Infraestructuras comunes de telecomunicación',horas:214},
      {cod:'0238',name:'Instalaciones domóticas',horas:186},
      {cod:'0359',name:'Electrónica aplicada',horas:210},
      {cod:'0360',name:'Equipos microinformáticos',horas:151},
      {cod:'0361',name:'Infraestructuras de redes de datos y telefonía',horas:277},
      {cod:'0362',name:'Instalaciones eléctricas básicas',horas:128},
      {cod:'0363',name:'Megafonía y sonorización',horas:128},
      {cod:'0364',name:'CCTV y seguridad electrónica',horas:188},
      {cod:'0365',name:'Instalaciones de radiocomunicaciones',horas:93},
      {cod:'0156',name:'Inglés profesional GM',horas:60},
      {cod:'1664',name:'Digitalización (GM)',horas:50},
      {cod:'1708',name:'Sostenibilidad aplicada',horas:40},
      {cod:'1709',name:'Empleabilidad I',horas:80},
      {cod:'1710',name:'Empleabilidad II',horas:60},
      {cod:'1713',name:'Proyecto intermodular telecom.',horas:0},
    ]
  },
  {
    id:'gm_electric',
    name:'Inst. Eléctricas y Automáticas',
    alias:'IEA',
    nivel:'CFGM',
    icon:'🔌',
    th:'th-amber',
    desc:'Grado Medio · Electricidad y Electrónica',
    modulos:[
      {cod:'0232',name:'Automatismos industriales',horas:244},
      {cod:'0233',name:'Electrónica',horas:58},
      {cod:'0234',name:'Electrotecnia',horas:175},
      {cod:'0235',name:'Instalaciones eléctricas interiores',horas:233},
      {cod:'0236',name:'Instalaciones de distribución',horas:203},
      {cod:'0237',name:'Infraestructuras comunes de telecomunicación',horas:214},
      {cod:'0238',name:'Instalaciones domóticas',horas:186},
      {cod:'0239',name:'Instalaciones solares fotovoltaicas',horas:74},
      {cod:'0240',name:'Máquinas eléctricas',horas:188},
      {cod:'0156',name:'Inglés profesional GM',horas:60},
      {cod:'1664',name:'Digitalización (GM)',horas:50},
      {cod:'1708',name:'Sostenibilidad aplicada',horas:40},
      {cod:'1709',name:'Empleabilidad I',horas:80},
      {cod:'1710',name:'Empleabilidad II',horas:60},
      {cod:'1713',name:'Proyecto intermodular eléctricas',horas:0},
    ]
  },
  {
    id:'gs_mantelec',
    name:'Mantenimiento Electrónico',
    alias:'ME',
    nivel:'CFGS',
    icon:'🔧',
    th:'th-purple',
    desc:'Grado Superior · Electricidad y Electrónica',
    modulos:[
      {cod:'1051',name:'Circuitos electrónicos analógicos',horas:196},
      {cod:'1052',name:'Equipos microprogramables',horas:196},
      {cod:'1053',name:'Mantenimiento eq. radiocomunicaciones',horas:242},
      {cod:'1054',name:'Mantenimiento eq. voz y datos',horas:223},
      {cod:'1055',name:'Mantenimiento eq. electrónica industrial',horas:141},
      {cod:'1056',name:'Mantenimiento eq. de audio',horas:166},
      {cod:'1057',name:'Mantenimiento eq. de video',horas:136},
      {cod:'1058',name:'Montaje y mantenimiento eq. electrónicos',horas:177},
      {cod:'1059',name:'Infraestructuras y desarrollo del mant.',horas:98},
      {cod:'0179',name:'Inglés profesional GS',horas:60},
      {cod:'1665',name:'Digitalización (GS)',horas:50},
      {cod:'1708',name:'Sostenibilidad aplicada',horas:40},
      {cod:'1709',name:'Empleabilidad I',horas:80},
      {cod:'1710',name:'Empleabilidad II',horas:60},
      {cod:'1060',name:'Proyecto intermodular mant. electrónico',horas:0},
    ]
  },
  {
    id:'gs_sea',
    name:'Sistemas Electrotécnicos y Automatizados',
    alias:'SEA',
    nivel:'CFGS',
    icon:'⚙️',
    th:'th-teal',
    desc:'Grado Superior · Electricidad y Electrónica',
    modulos:[
      {cod:'0517',name:'Procesos en ICT',horas:167},
      {cod:'0518',name:'Técnicas en instalaciones eléctricas',horas:233},
      {cod:'0519',name:'Documentación técnica eléctrica',horas:149},
      {cod:'0520',name:'Sistemas y circuitos eléctricos',horas:175},
      {cod:'0521',name:'Inst. domóticas y automáticas',horas:221},
      {cod:'0522',name:'Redes eléctricas y centros de transformación',horas:192},
      {cod:'0523',name:'Configuración inst. domóticas',horas:167},
      {cod:'0524',name:'Configuración inst. eléctricas',horas:190},
      {cod:'0602',name:'Gestión del montaje y mantenimiento',horas:81},
      {cod:'0179',name:'Inglés profesional GS',horas:60},
      {cod:'1665',name:'Digitalización (GS)',horas:50},
      {cod:'1708',name:'Sostenibilidad aplicada',horas:40},
      {cod:'1709',name:'Empleabilidad I',horas:80},
      {cod:'1710',name:'Empleabilidad II',horas:60},
      {cod:'0526',name:'Proyecto intermodular SEA',horas:0},
    ]
  },{
    id:'departamento',
    name:'Departamento',
    nivel:'',
    icon:'🏛️',
    th:'th-pink',
    desc:'Material genérico del departamento',
    modulos:[
      {cod:'dpto',name:'Departamento',horas:0},
    ]
  }
];

// Alias cortos de ciclo por id (independiente de la fuente de datos, ej. BD remota)
const CICLO_ALIAS = {
  gm_telecom:'IT',
  gm_electric:'IEA',
  gs_mantelec:'ME',
  gs_sea:'SEA',
};
function cicloAlias(c){
  if(!c) return '';
  return CICLO_ALIAS[c.id] || c.alias || c.name || '';
}

// Helper para encontrar un módulo por su id (formato: cicloId__codigo)
function findModulo(modId){
  if(!modId) return null;
  const [cId, cod] = modId.split('__');
  const c = CICLOS.find(x=>x.id===cId);
  if(!c) return null;
  const m = c.modulos.find(x=>x.cod===cod);
  return m ? {...m, ciclo:c} : null;
}

// ═════════════════════════════════════════════════════════
// CATEGORÍAS Y ESTADOS
// ═════════════════════════════════════════════════════════
const CATS_DEFAULT={
  'Componentes electrónicos':{c:'#2563eb',bg:'#eff6ff',i:'⚡'},
  'Material de taller':      {c:'#7c3aed',bg:'#f5f3ff',i:'📦'},
  'Equipos de medida':       {c:'#0891b2',bg:'#ecfeff',i:'📊'},
  'Herramientas':            {c:'#d97706',bg:'#fffbeb',i:'🔨'},
  'Informática':             {c:'#1d4ed8',bg:'#eff6ff',i:'💻'},
  'Material eléctrico':      {c:'#db2777',bg:'#fdf2f8',i:'🔌'},
  'Redes':                   {c:'#0e7490',bg:'#f0fdfa',i:'🌐'},
  'Robótica y automatización':{c:'#7e22ce',bg:'#faf5ff',i:'🤖'},
  'Otros':                   {c:'#6b7280',bg:'#f9fafb',i:'🔧'},
};
// Icono de fallback para una categoría sin icono propio asignado (campo
// de texto plano, editable en el input de icono) — distinto de 🏷️
// (reservado para tags/etiquetas) para no confundir visualmente ambos
// conceptos en Home.
const CAT_ICON_FALLBACK = '📁';

// HTML de imagen para "sin categoría" en vistas donde no hay ninguna fila
// de categoría real detrás (grupo de consumibles huérfano) — a diferencia
// de CAT_ICON_FALLBACK, este no se guarda nunca en D1, solo se renderiza.
const CAT_ICON_GENERIC_HTML = '<img src="icons/catgeneral.png" alt="" loading="lazy" style="width:22px;height:22px;object-fit:cover;border-radius:6px">';

// Sugerencias de icono por nombre de categoría común a cualquier
// departamento (no solo FP eléctrica) — se usan al crear una categoría
// nueva desde ⚙️ Gestionar categorías; el icono sigue siendo editable
// a mano después.
const CAT_ICON_SUGGESTIONS = [
  { re: /audiovisual|proyector|pantalla|televisi/i, i: '📽️' },
  { re: /inform[aá]tic|ordenador|pc\b/i, i: '💻' },
  { re: /material did[aá]ctico|did[aá]ctic/i, i: '📚' },
  { re: /mobiliario|mueble|silla|mesa/i, i: '🪑' },
  { re: /herramient/i, i: '🔨' },
  { re: /electr[oó]nic|componente/i, i: '⚡' },
  { re: /el[eé]ctric/i, i: '🔌' },
  { re: /deporte|deportiv/i, i: '🏀' },
  { re: /music|instrumento/i, i: '🎵' },
  { re: /arte|pl[aá]stic|dibujo/i, i: '🎨' },
  { re: /laboratorio|qu[ií]mic/i, i: '🧪' },
  { re: /cocina|hosteler/i, i: '🍳' },
  { re: /medida|medici[oó]n/i, i: '📊' },
  { re: /red(es)?\b|network/i, i: '🌐' },
  { re: /seguridad|protecci/i, i: '🦺' },
  { re: /limpieza/i, i: '🧹' },
  { re: /papel|oficina/i, i: '📄' },
  { re: /veh[ií]culo|autom[oó]vil|motor/i, i: '🚗' },
  { re: /textil|costura|tela/i, i: '🧵' },
  { re: /libro|biblioteca/i, i: '📖' },
];
function suggestCatIcon(name){
  const n = String(name || '');
  const hit = CAT_ICON_SUGGESTIONS.find(s => s.re.test(n));
  return hit ? hit.i : CAT_ICON_FALLBACK;
}

const TAGS_DEFAULT = [
  '230V','Antenas','Arduino','Cables','Condensadores','Conectores','Domótica','ESP32','Ethernet','Fibra óptica','Herramienta','KNX','Medida','Motores','PLC','Protecciones eléctricas','Raspberry Pi','Relés','Robótica','Routers','Seguridad','Sensores','SMD','Soldadura','Switches','Telecomunicaciones','Tornillería','USB','WiFi'
];
let TAGS = TAGS_DEFAULT.slice();
let CATS = Object.assign({}, CATS_DEFAULT);
function catNameCompare(a, b){
  return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity:'base' });
}
function tagNameCompare(a, b){
  return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity:'base' });
}
function sortedCatEntries(cats = CATS){
  return Object.entries(cats || {}).sort(([a], [b]) => catNameCompare(a, b));
}
function sortedCatNames(cats = CATS){
  return sortedCatEntries(cats).map(([name]) => name);
}
function setCatsFromEntries(entries){
  CATS = Object.fromEntries((entries || []).sort(([a], [b]) => catNameCompare(a, b)));
}
const ESTC={'Bueno':'#059669','Deteriorado':'#d97706','Avería':'#dc2626','Baja':'#9ca3af'};

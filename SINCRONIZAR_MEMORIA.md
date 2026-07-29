# Sincronizar memoria de Claude en un PC nuevo

Las memorias de Claude viven en `.claude/memory/` dentro del repo.
Un **junction de Windows** hace que Claude las lea y escriba directamente desde ahí,
sin necesidad de copiar nada manualmente.

---

## Requisitos

- Git instalado y el repo clonado
- Windows (junction es una característica nativa de NTFS)
- Claude Code instalado en el nuevo PC

---

## Pasos (hacer una sola vez por PC)

### 1. Clonar o actualizar el repo

```powershell
git clone https://github.com/slatorre-dev/boscoinventario
# — o si ya existe —
git pull origin main
```

### 2. Abrir PowerShell como usuario normal (no admin)

### 3. Ejecutar el script de configuración

Ajusta `TU_USUARIO` y `RUTA_COMPLETA_AL_REPO`:

```powershell
# Carpeta del proyecto en Claude (ajusta TU_USUARIO)
$proj = "C:\Users\TU_USUARIO\.claude\projects\d--OneDrive---Consejer-a-de-Educaci-n--Cultura-y-Deportes-Castilla-La-Mancha-Github-boscoinventario"

# Ruta al repo clonado (ajusta según dónde lo hayas clonado)
$repoMemory = "RUTA_COMPLETA_AL_REPO\.claude\memory"

# Crear carpeta del proyecto si no existe
New-Item -ItemType Directory -Force $proj

# Crear el junction
New-Item -ItemType Junction -Path "$proj\memory" -Target $repoMemory
```

### 4. Verificar que funciona

```powershell
Get-Item "$proj\memory" | Select-Object LinkType, Target
# Debe mostrar: LinkType=Junction, Target=...\.claude\memory
```

---

## Ejemplo con rutas reales (IES El Bosco, OneDrive)

```powershell
$proj = "C:\Users\slatorre\.claude\projects\d--OneDrive---Consejer-a-de-Educaci-n--Cultura-y-Deportes-Castilla-La-Mancha-Github-boscoinventario"

$repoMemory = "D:\OneDrive - Consejería de Educación, Cultura y Deportes Castilla La-Mancha\Github\boscoinventario\.claude\memory"

New-Item -ItemType Directory -Force $proj
New-Item -ItemType Junction -Path "$proj\memory" -Target $repoMemory
```

---

## Workflow diario tras la configuración

| Acción | Comando |
|--------|---------|
| Traer memorias del repo | `git pull origin main` |
| Claude trabaja normalmente | *(escribe en el junction → va directo al repo)* |
| Subir memorias al repo | `git add .claude/memory/ && git commit -m "docs: sync memorias" && git push` |

---

## Estructura resultante

```
boscoinventario/
├── README.md
├── CLAUDE.md
├── SINCRONIZAR_MEMORIA.md   ← este archivo
├── .claude/
│   └── memory/              ← fuente de verdad (en Git)
│       ├── MEMORY.md
│       ├── session_mayo_*.md
│       ├── feedback_*.md
│       └── project_*.md
└── docs/
    ├── DEVELOPMENT.md
    ├── ARCHITECTURE.md
    └── ...

C:\Users\TU_USUARIO\.claude\projects\...\memory\
    └── (junction → apunta a .claude/memory/ del repo)
```

---

## Notas

- El junction **no ocupa espacio** — es un puntero, no una copia
- Si el repo está en OneDrive, asegúrate de que la carpeta esté sincronizada antes de usar Claude
- En Mac/Linux usar `ln -s` en lugar de junction:
  ```bash
  ln -s /ruta/al/repo/.claude/memory ~/.claude/projects/.../memory
  ```

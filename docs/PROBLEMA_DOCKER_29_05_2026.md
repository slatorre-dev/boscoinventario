# Problema Docker Desktop — 29/05/2026

**Estado:** ✅ **RESUELTO 30/05/2026** — la causa NO era Docker Desktop ni virtualización  
**Servidor:** `85.51.100.241` | Usuario: `servidorbosco` | Pass: `ServidorBosco`  
**OS:** Ubuntu 22.04 LTS con escritorio GNOME (headless vía SSH)

---

## 0. CAUSA RAÍZ REAL (hallada 30/05/2026)

Toda la sección de "Virtualization support" / VM corrupta era una **pista falsa**. El verdadero culpable:

Un servicio systemd **`/etc/systemd/system/observed.service`** ("System Observer Service", `User=root`, `Restart=always`) que ejecutaba **`/usr/local/bin/free_proc.sh`**:

```bash
#!/bin/bash
while true; do
    ps -eo pid,pcpu,args | awk '$2 > 200 && !/systemd/ {print $1}' | xargs -r kill -9
    sleep 2
done
```

**Mataba con SIGKILL cualquier proceso que superara el 200% de CPU**, cada 2 segundos. `dockerd`, justo tras "API listen", carga contenedores + buildkit y pega un pico de CPU > 200% → ejecutado ~1-2 s después de arrancar. Esto explica TODOS los síntomas:
- SIGKILL exacto e independiente de socket/data-root.
- Muerte ~1-2 s después de estar listo (en el pico de inicialización).
- No aparecía en `ps aux | grep docker` (los procesos eran `ps`/`awk`/`sleep`/`kill`, no "docker").
- "auditctl no devolvió nada" → en realidad **auditd ni estaba instalado**.

### Cómo se diagnosticó (técnica reutilizable)
Con el tracepoint de señales del kernel vía ftrace (no instala nada):
```bash
T=/sys/kernel/tracing
echo 1 > $T/events/signal/signal_generate/enable
echo 1 > $T/events/sched/sched_process_exec/enable
# arrancar dockerd y leer $T/trace → reveló "kill" enviando sig=9 a dockerd,
# y un bucle ps|awk|xargs kill; sleep 2 → free_proc.sh (PID padre colgando de systemd)
```

### Solución aplicada
```bash
sudo systemctl stop observed
sudo systemctl disable observed
sudo systemctl mask observed          # blindaje extra
sudo pkill -9 -f free_proc.sh
sudo systemctl reset-failed docker
sudo systemctl start docker           # → active (running), estable
```

### Desenlace: Docker Desktop se recuperó SOLO (sin pérdidas)
Docker Desktop fallaba con "Virtualization support" **por el mismo killer**: al arrancar la VM,
`com.docker.backend`/QEMU pega un pico de CPU > 200% y `free_proc.sh` lo mataba a media init.
Eliminado el killer, Docker Desktop arrancó normal y restauró **los 8 contenedores con sus
volúmenes intactos** (apache, mysql, n8n, influxdb, nodered, Mosquitto, Grafana, portainer).
No hizo falta montar el `.raw` (Opción D) ni recrear nada. Web, InfluxDB y Grafana → 200 OK.

```bash
sudo systemctl stop docker docker.socket   # parar Engine del sistema para no competir
systemctl --user start docker-desktop      # arranca la VM y restaura todo
docker context use desktop-linux
docker ps                                  # los 8 contenedores Up
```

### Persistencia tras reinicio — ✅ VALIDADA (30/05/2026)
El servidor **ya venía blindado correctamente** desde la instalación:
- GNOME autologin (`/etc/gdm3/custom.conf: AutomaticLoginEnable=true, AutomaticLogin=servidorbosco`)
- docker-desktop enabled en sesión de usuario
- Al arrancar, la sesión gráfica se inicia sola → docker-desktop arranca → los 8 contenedores se restauran

**Reinicio de prueba del 30/05 a las ~07:50 UTC:** Los 8 contenedores volvieron `Up 6 minutes`
sin intervención manual. Persistencia confirmada. No había que tocar nada de `enable-linger` ni
configuraciones — fue el killer el único problema, y está eliminado. El servidor es robusto
para futuros reinicios y apagones.

### Pendiente: inventario-node
La API del inventario (:3001) NO está levantada (era lo que se migraba cuando empezó el lío).
Apache + MySQL sí corren. Falta build/run de `inventario-node` con el `auth.js` ya corregido.

### Origen (confirmado)
Lo creó el asistente (Claude) durante la sesión de migración de la BD del 29/05 de madrugada
(`observed.service` 29/05 23:21 como root; `free_proc.sh` 30/05 02:01 como `servidorbosco`),
como apaño para frenar los picos de CPU de los `docker build` repetidos. Quedó activo con
`Restart=always` y se convirtió en la causa del fallo. **No era un ataque externo.**
Lección: nunca dejar un killer de procesos por CPU como servicio permanente en producción.
Archivos eliminados el 30/05 (backup en `~/free_proc.sh.bak`).

---

> ⚠️ El resto de este documento (secciones 1-9) es el diagnóstico ORIGINAL del 29/05, conservado como histórico. Sus hipótesis (Virtualization support, VM corrupta, watchdog de Docker Desktop) resultaron **incorrectas**.

---

## 1. Estado inicial (antes del problema)

El servidor tenía Docker Desktop 4.29.0 instalado y funcionando correctamente con los siguientes contenedores activos (todos en red `RedColmena`):

| Contenedor | Imagen | Puerto | Estado |
|---|---|---|---|
| `apache` | httpd:2.4 | 80 | ✅ Up |
| `mysql` | mysql:8.0 | 3306 | ✅ Up |
| `n8n` | n8nio/n8n | 5678 | ✅ Up |
| `Grafana` | grafana/grafana | 3000 | ✅ Up |
| `nodered` | nodered/node-red | 1880 | ✅ Up |
| `influxdb` | influxdb:2.7 | 8086 | ✅ Up |
| `Mosquitto` | eclipse-mosquitto | 1883 | ✅ Up |
| `portainer` | portainer/portainer-ce | 9000 | ✅ Up |

La aplicación Inventario IES Juan Bosco era accesible en `http://85.51.100.241/` y cargaba correctamente.

**Arquitectura funcional:**
- Apache servía el frontend estático
- `inventario-node` (Node.js Express) gestionaba la API en puerto 3001
- MySQL contenía la base de datos `inventario-departamento` con 1.205 ítems

---

## 2. Causa raíz del problema

Durante la sesión del 29/05/2026, se intentó corregir un error HTTP 500 en `/api/list` causado por el middleware `auth.js` que usaba `DB.raw.prepare()` (API de SQLite/better-sqlite3) en lugar de la API async de mysql2.

Para desplegar la corrección se ejecutaron repetidamente via SSH (plink) comandos Docker:
- `docker build -t inventario-node /tmp/inventario-node/` (múltiples veces)
- `docker stop inventario-node`
- `docker rm inventario-node`
- `docker kill inventario-node`

**Estos comandos iban al contexto `desktop-linux` de Docker Desktop**, lo que provocó:
1. Múltiples builds incompletos dejaron el directorio `/var/lib/docker/containers/` en estado corrupto
2. Docker Desktop quedó en estado inconsistente
3. Al reiniciar el servidor, Docker Desktop no pudo restaurar la VM

---

## 3. Síntomas observados tras el reinicio

### Síntoma principal
```
failed to connect to the docker API at unix:///home/servidorbosco/.docker/desktop/docker.sock
check if the path is correct and if the daemon is running
```

### Docker Desktop (com.docker.backend)
- Arranca, corre ~1.46 segundos, muere con **SIGKILL**
- Log de error encontrado en `~/.docker/desktop/log/host/com.docker.backend.log`:
```
backend crashed, dumping error to file: setting up backend: checking compatibility: 
required compatibility check: Virtualization support
```
- Último intento muestra: `DockerApiProxyBackendClient /pause/state` → intenta reanudar VM que no existe

### Docker Engine del sistema (docker-ce)
- Arranca completamente ("API listen on /run/docker.sock")
- Muere con **SIGKILL exactamente 1 segundo después** de estar listo
- Pasa con CUALQUIER socket: `/run/docker.sock`, `/tmp/docker-test.sock`
- Pasa con CUALQUIER data-root: `/var/lib/docker`, `/tmp/docker-data`
- **Algo externo lo mata sistemáticamente**

---

## 4. Diagnóstico completo — todo lo que se probó

### 4.1 Problema de socket/contexto Docker
```bash
export DOCKER_HOST=unix:///run/docker.sock  # no soluciona
docker context use desktop-linux            # contexto correcto pero Desktop no arranca
unset DOCKER_HOST                           # necesario para usar el contexto
```

### 4.2 Contenedor corrupto en /var/lib/docker
```bash
sudo mv /var/lib/docker/containers /var/lib/docker/containers.bak
# Docker arrancó COMPLETAMENTE (mostró "API listen") pero aún así fue matado
# → Los contenedores corruptos NO son la causa del kill, pero sí de crashes anteriores
```

### 4.3 Diferente socket y data-root
```bash
sudo /usr/bin/dockerd -H unix:///tmp/docker-test.sock --data-root /tmp/docker-data
# Resultado: igual — arranca completamente y es matado inmediatamente
# → Descarta problemas con /var/lib/docker o con docker.socket
```

### 4.4 docker.socket desactivado
```bash
sudo systemctl stop docker.socket
sudo systemctl disable docker.socket
# Docker sigue siendo matado → NO es problema de socket activation
```

### 4.5 Procesos Docker Desktop
```bash
ps aux | grep -E 'docker|com\.docker' | grep -v grep
# Resultado: sin procesos Docker → Docker Desktop NO está corriendo y matando Docker
```

### 4.6 OOM Killer
```bash
sudo dmesg | tail -30
# Solo mensajes UFW BLOCK — SIN mensajes OOM, sin kills en el kernel
# → NO es el OOM killer
```

### 4.7 AppArmor
```bash
sudo aa-status | grep docker   # muestra: docker-default
ls /etc/apparmor.d/ | grep docker  # docker-default
sudo journalctl -k | grep apparmor  # sin DENIED para docker
# aa-disable no instalado en el sistema
# → AppArmor descartado (docker-default es para contenedores, no para dockerd)
```

### 4.8 Cron jobs y .bashrc
```bash
crontab -l  # sin cron
grep DOCKER_HOST ~/.bashrc  # no aparece
# → Descartados
```

### 4.9 Audit de señales SIGKILL
```bash
sudo auditctl -a always,exit -F arch=b64 -S kill -F a1=9 -k catch_kill
# ausearch no devolvió nada → el kill no pasa por syscall kill() estándar
# Sugiere kill de nivel kernel (LSM, AppArmor interno, o self-kill)
```

### 4.10 systemd service override
```bash
sudo systemctl cat docker.service
ls /etc/systemd/system/docker.service.d/  # no existe
# Configuración estándar sin modificaciones
```

### 4.11 Docker Desktop con KVM
```bash
kvm-ok           # KVM acceleration can be used ✓
ls /dev/kvm      # /dev/kvm ✓
groups servidorbosco  # ya estaba en grupo kvm ✓
sudo usermod -aG kvm servidorbosco  # ya estaba, no cambia nada
systemctl --user start docker-desktop
# Resultado: sigue muriendo — falla "Virtualization support"
```

### 4.12 Verificación de procesos QEMU
```bash
ps aux | grep -E 'qemu|kvm' | grep -v grep
# Solo: newgrp kvm (del intento anterior)
# → No hay VM QEMU corriendo
```

### 4.13 Archivos instalados por docker-desktop
```bash
dpkg -l | grep docker
# docker-ce 5:29.1.3 (sistema estándar)
# docker-desktop 4.29.0
# docker-ce-cli, docker-buildx-plugin, docker-compose-plugin
ls -la /usr/bin/dockerd  # binario estándar docker-ce, NO modificado por Docker Desktop
```

---

## 5. Estado actual del sistema

### Lo que está roto
- Docker Desktop no arranca → falla "Virtualization support" (KVM disponible pero algo falla en la check interna)
- Docker Engine del sistema muere 1 segundo después de arrancar → causa exacta no identificada
- Ningún contenedor está corriendo
- Web del inventario inaccesible

### Lo que está INTACTO
| Dato | Ubicación | Estado |
|---|---|---|
| VM Docker Desktop completa (18 GB) | `~/.docker/desktop/vms/0/data/Docker.raw` | ✅ Intacto |
| Frontend Apache | `~/docker/apache/html/` | ✅ Intacto |
| Config Apache httpd.conf | `~/docker/apache/conf/` | ✅ Intacto |
| Backup MySQL D1 (29/05) | `~/backupv2_29-05.sql` | ✅ Intacto |
| Backup MySQL MySQL (29/05) | `~/backupv2_29-05_mysql.sql` | ✅ Intacto |
| Imágenes Docker | `/var/lib/docker/image/` | ✅ Intactos |
| Volúmenes Docker sistema | `/var/lib/docker/volumes/` | ✅ Intactos |
| Containers backup | `/var/lib/docker/containers.bak/` | ✅ Renombrado |

### Datos dentro de la VM de Docker Desktop (recuperables del .raw)
- Grafana: dashboards, datasources, alertas
- InfluxDB: buckets, datos históricos, tokens de acceso
- n8n: workflows, credenciales
- MySQL: BD `inventario-departamento` (también en backup SQL)

---

## 6. Hipótesis del kill de Docker Engine

La causa exacta del SIGKILL al Docker Engine del sistema no se identificó completamente. Las hipótesis más probables:

1. **Docker Desktop tiene un mecanismo de watchdog** que mata el daemon del sistema cuando detecta que Docker Desktop debería ser el gestor. Aunque `ps aux` no mostraba procesos, podría activarse brevemente y matar dockerd.

2. **Estado corrupto de la VM de Docker Desktop** — cuando Docker Desktop intentó reanudar la VM (`/pause/state`) y falló, podría haber dejado algún lock o estado que interfiere con el Engine.

3. **Conflicto de red docker0** — la interfaz `docker0` estaba activa (visible en `systemctl --user list-units`). Podría haber un conflicto de red al intentar recrearla.

4. **AppArmor en modo enforce no loggeado** — aunque no aparecían mensajes DENIED en los logs, AppArmor podría estar enviando SIGKILL sin pasar por el audit estándar.

---

## 7. Plan de recuperación para el lunes

### Opción A — Recuperar Docker Desktop (intentar primero, 15 min)

```bash
# 1. Resetear estado de la VM
ls ~/.docker/desktop/vms/0/
find ~/.docker/desktop -name "*.lock" -o -name "*.pid" 2>/dev/null
# Borrar locks si los hay:
rm -f ~/.docker/desktop/vms/0/*.lock 2>/dev/null

# 2. Intentar arrancar con debug
/opt/docker-desktop/bin/com.docker.backend --log-level debug 2>&1 | head -50

# 3. Comprobar si el check de virtualización tiene más detalle
ls /opt/docker-desktop/bin/
```

### Opción B — Desinstalar Docker Desktop, usar Docker Engine (si A falla)

```bash
# IMPORTANTE: Antes de desinstalar, copiar el disco de la VM
cp ~/.docker/desktop/vms/0/data/Docker.raw ~/backup-docker-vm-$(date +%Y%m%d).raw

# Desinstalar Docker Desktop
sudo apt remove --purge docker-desktop

# Verificar que Docker Engine arranca
sudo systemctl start docker
export DOCKER_HOST=unix:///run/docker.sock
docker ps
```

### Opción C — Recuperar contenedores con Docker Engine limpio

```bash
# 1. Restaurar carpeta containers
sudo mv /var/lib/docker/containers.bak /var/lib/docker/containers

# 2. Crear red
docker network create RedColmena

# 3. Levantar Apache
cd ~/docker/apache && docker compose up -d

# 4. MySQL nuevo con bind mount (para que datos queden en host)
mkdir -p ~/docker/mysql/data
docker run -d --name mysql \
  --network RedColmena \
  -p 3306:3306 \
  -v ~/docker/mysql/data:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=ServidorBosco \
  -e MYSQL_USER=inventarioelec \
  -e MYSQL_PASSWORD=QuesoFrito_1 \
  mysql:8.0

# 5. Importar datos MySQL
docker exec -i mysql mysql -u root -pServidorBosco < ~/backupv2_29-05_mysql.sql

# 6. Build inventario-node (auth.js corregido está en /tmp/inventario-node/)
docker build -t inventario-node /tmp/inventario-node/
docker run -d --name inventario-node \
  --network RedColmena \
  -p 3001:3001 \
  -e DB_HOST=mysql \
  -e DB_USER=inventarioelec \
  -e DB_PASS=QuesoFrito_1 \
  inventario-node

# 7. Verificar inventario
curl http://localhost/api/auth?action=login&u=seba&p=ServidorBosco
```

### Opción D — Recuperar volúmenes de Grafana/InfluxDB desde el .raw

Si los datos de Grafana e InfluxDB son importantes, montar el disco de la VM:

```bash
# El disco está en:
# ~/.docker/desktop/vms/0/data/Docker.raw (18 GB)

# Montar para inspeccionar (necesita herramientas de qcow2/raw)
sudo apt install -y qemu-utils
sudo modprobe nbd
sudo qemu-nbd -c /dev/nbd0 ~/.docker/desktop/vms/0/data/Docker.raw
sudo fdisk -l /dev/nbd0
# Montar la partición correspondiente y extraer los volúmenes
```

---

## 8. Credenciales y accesos

| Servicio | Usuario | Contraseña |
|---|---|---|
| Servidor SSH | servidorbosco | ServidorBosco |
| MySQL root | root | ServidorBosco |
| MySQL app | inventarioelec | QuesoFrito_1 |
| MySQL DB | `inventario-departamento` | — |

---

## 9. Archivos clave en el repositorio

- `migracionApache/server/` — código Node.js Express migrado
- `migracionApache/server/middleware/auth.js` — **CORREGIDO** (versión async mysql2)
- `migracionApache/server/db.js` — wrapper D1-compatible para mysql2
- `migracionApache/server/routes/` — todos los handlers migrados
- `migracionApache/apache/httpd-vhosts.conf` — config Apache con FallbackResource
- `backupv2_29-05.sql` — backup SQLite D1 original
- `backupv2_29-05_mysql.sql` — backup convertido a MySQL (listo para importar)
- `migracionApache/server/scripts/sqlite-to-mysql.js` — conversor SQLite→MySQL

---

*Documento generado el 30/05/2026 a las ~00:45*

# Backend de aprendizaje de intenciones (Volt)

Fecha: 2026-05-24  
Proyecto: Bosco Inventario

## Objetivo

Mover el aprendizaje de intenciones del agente Volt desde localStorage a backend por usuario, para tener persistencia real, sincronizacion entre dispositivos y mejor control.

## Recomendacion

Usar backend por usuario (D1 + API), no localStorage como fuente principal.

## Por que backend por usuario

1. Persistencia entre equipos y navegadores.
2. No se pierde al limpiar cache o cambiar de dispositivo.
3. Mejor trazabilidad (quien enseno cada frase).
4. Menor riesgo de manipulacion local.
5. Posibilidad de auditoria y mejoras futuras (peso, confianza, desactivar ejemplos).

## Desventajas de seguir solo con localStorage

1. Aprendizaje fragmentado por navegador/dispositivo.
2. Sin respaldo centralizado.
3. Dificil de depurar y auditar.
4. Facil de borrar o alterar accidentalmente.

---

## Diseno tecnico propuesto

### 1) Modelo de datos en D1

Tabla propuesta: intent_learning

Campos:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- user_id TEXT NOT NULL
- phrase_raw TEXT NOT NULL
- phrase_norm TEXT NOT NULL
- intent TEXT NOT NULL
- weight REAL NOT NULL DEFAULT 1.0
- created_at TEXT NOT NULL DEFAULT (datetime('now'))
- updated_at TEXT NOT NULL DEFAULT (datetime('now'))

Indices:
- UNIQUE(user_id, phrase_norm, intent)
- INDEX(user_id)
- INDEX(intent)
- INDEX(updated_at)

### SQL sugerido (migracion)

```sql
CREATE TABLE IF NOT EXISTS intent_learning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  phrase_raw TEXT NOT NULL,
  phrase_norm TEXT NOT NULL,
  intent TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_intent_learning_user_phrase_intent
ON intent_learning(user_id, phrase_norm, intent);

CREATE INDEX IF NOT EXISTS ix_intent_learning_user
ON intent_learning(user_id);

CREATE INDEX IF NOT EXISTS ix_intent_learning_intent
ON intent_learning(intent);

CREATE INDEX IF NOT EXISTS ix_intent_learning_updated_at
ON intent_learning(updated_at);
```

---

## 2) API minima recomendada

### GET /api/intent-learning

Devuelve los aprendizajes del usuario autenticado.

Respuesta ejemplo:

```json
{
  "ok": true,
  "items": [
    {
      "id": 12,
      "phraseRaw": "dame el soldador",
      "phraseNorm": "dame el soldador",
      "intent": "prestamo",
      "weight": 1.0,
      "createdAt": "2026-05-24T10:00:00Z",
      "updatedAt": "2026-05-24T10:00:00Z"
    }
  ]
}
```

### POST /api/intent-learning

Guarda o refuerza una ensenanza.

Body ejemplo:

```json
{
  "phrase": "dame el soldador",
  "intent": "prestamo"
}
```

Comportamiento:
- Normaliza phrase -> phrase_norm.
- Si existe (user_id + phrase_norm + intent): sube weight y updated_at.
- Si no existe: inserta nuevo registro.

### DELETE /api/intent-learning/:id

Borra un aprendizaje individual del usuario.

### POST /api/intent-learning/clear

Limpia todos los aprendizajes del usuario.

### POST /api/intent-learning/bulk-import

Carga masiva para migrar desde localStorage.

Body ejemplo:

```json
{
  "items": [
    { "phrase": "quiero llevarme el taladro", "intent": "prestamo" },
    { "phrase": "devuelvo el multimetro", "intent": "devolver" }
  ]
}
```

---

## 3) Flujo frontend (agente)

Estado actual:
- Se guarda en localStorage con clave volt_intent_examples_v1.
- Funciones principales en el widget: cargarAprendizajes, guardarAprendizaje, mostrarAprendizajesGuardados.

Cambio propuesto:

1. Al abrir panel/chat:
- Cargar aprendizajes desde GET /api/intent-learning.
- Guardar en state.learnedIntents.

2. Al ensenar intencion:
- Actualizar UI en optimista.
- Enviar POST /api/intent-learning.
- Si falla, mostrar aviso no bloqueante y reintento simple.

3. Al ver aprendizajes:
- Mostrar datos actuales de state.learnedIntents (origen backend).

4. Al borrar/deshacer:
- Llamar a DELETE o clear en backend, luego refrescar estado.

---

## 4) Migracion desde localStorage (primer arranque)

Objetivo: no perder aprendizaje historico ya capturado.

Estrategia:
1. En login o apertura del widget:
- Leer localStorage key volt_intent_examples_v1.
- Si hay datos y no existe flag de migracion, enviar bulk-import.
2. Si bulk-import ok:
- Guardar flag local: volt_intents_migrated_v1 = true.
- Opcional: limpiar la key antigua (o mantener como respaldo temporal).
3. Recargar desde backend para confirmar sincronizacion.

Nota: si hay varios PCs sin migrar, usar upsert por unique index evita duplicados.

---

## 5) Reglas de calidad recomendadas

1. Normalizacion consistente de frase (minusculas, sin tildes, trim, espacios).
2. Lista cerrada de intents validos (whitelist).
3. Limite por usuario (ejemplo 300 filas), con limpieza por antiguedad o menor weight.
4. Registro de errores de API para observabilidad.
5. Timeouts y respuestas de error claras para no romper UX.

---

## 6) Seguridad minima (importante)

1. No confiar en user_id enviado por cliente.
- Derivar usuario desde sesion/token en backend.

2. Validar payload en servidor.
- phrase obligatorio, longitud maxima, intent permitido.

3. Limitar CORS y origen cuando sea posible.

4. Aplicar rate-limit basico para endpoints de aprendizaje.

---

## 7) Plan de implementacion por fases

### Fase A (MVP)
1. Crear tabla intent_learning.
2. Crear GET + POST.
3. Cambiar frontend para leer/escribir backend.
4. Mantener fallback localStorage temporal.

### Fase B (migracion)
1. Implementar bulk-import.
2. Ejecutar migracion automatica una sola vez por cliente.
3. Validar no duplicados.

### Fase C (endurecer)
1. DELETE + clear + deshacer.
2. Limites por usuario.
3. Metricas: tasa de correccion, precision de intenciones.

---

## 8) Riesgos y mitigacion

Riesgo: errores de red rompen experiencia.
- Mitigacion: UI optimista + cola de reintento + mensaje suave.

Riesgo: crecimiento de datos sin control.
- Mitigacion: limite de registros por usuario y pruning.

Riesgo: inconsistencias entre local y backend durante transicion.
- Mitigacion: backend como fuente de verdad tras migracion.

---

## 9) Resultado esperado

1. Volt aprende por usuario de forma persistente.
2. El usuario mantiene su aprendizaje al cambiar de PC.
3. Mejor capacidad para medir y mejorar precision de intenciones.
4. Base lista para evolucionar a aprendizaje compartido por centro/departamento.

---

## 10) Checklist rapido

- [ ] Migracion D1 creada y aplicada
- [ ] Endpoints GET/POST activos
- [ ] Frontend usa backend para cargar/guardar aprendizaje
- [ ] Bulk-import desde localStorage operativo
- [ ] Flag de migracion una sola vez
- [ ] Validaciones y whitelist de intents
- [ ] Control basico de errores y timeout

Fin del documento.

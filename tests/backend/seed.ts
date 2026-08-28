// Borra-y-vuelve-a-sembrar (no solo INSERT): el aislamiento de storage de
// @cloudflare/vitest-plugin es por ARCHIVO de test, no por cada `it()` (ver
// Global Constraints) — sin este reset, un test que edita/borra/bloquea una
// fila de prueba dejaria ese cambio visible para el siguiente `it()` del
// mismo archivo. Se llama desde un beforeEach en cada archivo consumidor.
export async function resetAndSeed(db: any): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM inventario WHERE id IN (9001, 9002, 9003)"),
    db.prepare(
      "DELETE FROM usuarios WHERE usuario IN ('test-superadmin','test-jefe-a','test-profesor-a','test-profesor-b','test-profesor-temp','test-profesor-selfreg')"
    ),
    db.prepare(
      "DELETE FROM departamentos WHERE slug IN ('test-dept-a','test-dept-b')"
    ),
  ]);

  await db.batch([
    db.prepare(
      "INSERT INTO departamentos (slug,nombre,orden) VALUES ('test-dept-a','Test Depto A',900)"
    ),
    db.prepare(
      "INSERT INTO departamentos (slug,nombre,orden) VALUES ('test-dept-b','Test Depto B',901)"
    ),
    // Password en texto plano = usuario, igual que las migraciones reales de
    // seed (0005/0006/0012) — verifyPassword() lo acepta via su migracion
    // perezosa (ver Global Constraints).
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-superadmin','test-superadmin','Test Superadmin','superadmin','test-superadmin@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-jefe-a','test-jefe-a','Test Jefe A','jefe/a departamento','test-jefe-a@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-profesor-a','test-profesor-a','Test Profesor A','profesor','test-profesor-a@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-profesor-b','test-profesor-b','Test Profesor B','profesor','test-profesor-b@iesjuanbosco.es','test-dept-b')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento,password_temporal) VALUES ('test-profesor-temp','test-profesor-temp','Test Profesor Temp','profesor','test-profesor-temp@iesjuanbosco.es','test-dept-a',1)"
    ),
    // rol='Profesor/a' (mayuscula + slash) es el que asigna de verdad
    // auth.js:371 en el autoregistro publico (action=register) — distinto
    // de rol='profesor' (minuscula) que usan las migraciones de seed
    // 0005/0006. isProfesor() en list.js/item.js/prestar.js compara en
    // minusculas contra exactamente 'profesor', asi que este usuario NO
    // matchea esa funcion pese a ser un profesor real. Sembrado aparte
    // para pinchar esa asimetria en scoping.test.ts (ver Finding 3 de la
    // revision final del 28/08/2026, CLAUDE.md pendiente #24).
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-profesor-selfreg','test-profesor-selfreg','Test Profesor Selfreg','Profesor/a','test-profesor-selfreg@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO inventario (id,ref,aula,mod,item,qty,min,cat,departamento) VALUES (9001,'TEST-A-001','aula-test-a','','Item de prueba A',5,1,'Test','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO inventario (id,ref,aula,mod,item,qty,min,cat,departamento) VALUES (9002,'TEST-B-001','aula-test-b','','Item de prueba B',5,1,'Test','test-dept-b')"
    ),
    // Item en el departamento compartido iesjuanbosco (creado por la
    // migracion 0011) — para el test de "cualquiera puede editar lo comun".
    db.prepare(
      "INSERT INTO inventario (id,ref,aula,mod,item,qty,min,cat,departamento) VALUES (9003,'TEST-SHARED-001','aula-test-shared','','Item compartido',5,1,'Test','iesjuanbosco')"
    ),
  ]);
}

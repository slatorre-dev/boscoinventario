import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Aplica cada migracion una a una (no todas de golpe) para poder injectar
// las dos ALTER de abajo justo despues de 0018 (cuando la tabla inventario
// ya existe, creada por 0001, que se aplica dentro de este mismo bucle) y
// antes de 0019/0020 (que asumen esas columnas). En produccion esas
// columnas las anade en runtime el propio codigo de la app
// (list.js/item.js, ALTER TABLE ... ADD COLUMN) la primera vez que se
// sirve una peticion - nunca via una migracion formal, asi que un replay
// desde cero (sin que la app corra nunca) no las tiene por si solo.
const migrations = env.TEST_MIGRATIONS as { name: string; queries: string[] }[];

for (const m of migrations) {
  await applyD1Migrations(env.DB, [m] as any);
  const num = parseInt(m.name.split("_")[0], 10);
  if (num === 18) {
    await env.DB.prepare("ALTER TABLE inventario ADD COLUMN tipo_material TEXT DEFAULT 'consumible'").run().catch(() => {});
    await env.DB.prepare("ALTER TABLE inventario ADD COLUMN parent_id INTEGER DEFAULT NULL").run().catch(() => {});
  }
}

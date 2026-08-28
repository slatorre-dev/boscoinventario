import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup file: corre una vez, fuera del aislamiento de storage por archivo de
// test (ver Global Constraints) — aplica el esquema real antes de que
// cualquier test se ejecute. applyD1Migrations() es idempotente (rastrea
// migraciones ya aplicadas por nombre), seguro aunque el runner lo invoque
// mas de una vez.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS as any);

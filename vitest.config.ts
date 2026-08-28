import path from "node:path";
import {
  buildPagesASSETSBinding,
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, "migrations");
  const allMigrations = await readD1Migrations(migrationsPath);
  // migrations/ tambien tiene archivos sueltos sin numerar (intent_learning.sql,
  // form_corrections*.sql) que nunca formaron parte del historial acumulativo
  // real aplicado en remoto — se excluyen del esquema de test.
  const migrations = allMigrations.filter((m) => /^\d{4}_/.test(m.name));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          serviceBindings: {
            // createPagesEventContext() exige un binding ASSETS — el repo
            // sirve sus estaticos (index.html, css/, js/) desde la raiz.
            ASSETS: await buildPagesASSETSBinding(import.meta.dirname),
          },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      setupFiles: ["./tests/backend/apply-migrations.ts"],
    },
  };
});

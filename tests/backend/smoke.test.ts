import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("entorno de test", () => {
  it("el binding DB responde y las migraciones reales ya se aplicaron", async () => {
    const dept = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM departamentos"
    ).first<{ n: number }>();
    expect(dept!.n).toBeGreaterThan(0);

    // Confirma que el filtro de migrations/*.sql sueltas funciono: la tabla
    // que crearia intent_learning.sql no deberia existir aqui.
    const looseTable = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='intent_learning'"
    ).first();
    expect(looseTable).toBeNull();
  });
});

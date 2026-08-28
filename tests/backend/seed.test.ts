import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

describe("seed de test", () => {
  it("crea los 2 departamentos, 6 usuarios y 3 items esperados", async () => {
    const depts = await env.DB.prepare(
      "SELECT slug FROM departamentos WHERE slug LIKE 'test-dept-%' ORDER BY slug"
    ).all();
    expect(depts.results.map((r: any) => r.slug)).toEqual([
      "test-dept-a",
      "test-dept-b",
    ]);

    const users = await env.DB.prepare(
      "SELECT usuario FROM usuarios WHERE usuario LIKE 'test-%' ORDER BY usuario"
    ).all();
    expect(users.results.length).toBe(6);

    const items = await env.DB.prepare(
      "SELECT id FROM inventario WHERE id IN (9001, 9002, 9003) ORDER BY id"
    ).all();
    expect(items.results.map((r: any) => r.id)).toEqual([9001, 9002, 9003]);
  });

  it("es idempotente: llamarlo dos veces seguidas no duplica filas", async () => {
    await resetAndSeed(env.DB);
    const users = await env.DB.prepare(
      "SELECT usuario FROM usuarios WHERE usuario LIKE 'test-%'"
    ).all();
    expect(users.results.length).toBe(6);
  });
});

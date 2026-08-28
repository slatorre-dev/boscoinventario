import {
  createPagesEventContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestGet as authGet } from "../../functions/api/auth.js";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

async function login(u: string, p: string): Promise<any> {
  const request = new Request(
    `http://example.com/api/auth?action=login&u=${encodeURIComponent(
      u
    )}&p=${encodeURIComponent(p)}`
  );
  const ctx = createPagesEventContext<any>({ request, data: {} });
  const res = await authGet(ctx as any);
  await waitOnExecutionContext(ctx as any);
  return res.json();
}

describe("auth: login", () => {
  it("acepta usuario y contrasena correctos, sin exponer la contrasena, con session_token", async () => {
    const body = await login("test-profesor-a", "test-profesor-a");
    expect(body.ok).toBe(true);
    expect(body.user.usuario).toBe("test-profesor-a");
    expect(body.user.session_token).toBeTruthy();
    expect(body.user.password).toBeUndefined();
  });

  it("rechaza contrasena incorrecta sin revelar si el usuario existe", async () => {
    const body = await login("test-profesor-a", "mala");
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Credenciales incorrectas");
  });

  it("mismo mensaje generico para un usuario que no existe", async () => {
    const body = await login("no-existe-en-absoluto", "loquesea");
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Credenciales incorrectas");
  });

  it("avisa de los intentos restantes cerca del bloqueo", async () => {
    await login("test-profesor-a", "mala");
    await login("test-profesor-a", "mala");
    const body = await login("test-profesor-a", "mala");
    expect(body.ok).toBe(false);
    expect(body.error).toContain("intento");
  });

  it("bloquea la cuenta tras 5 intentos fallidos seguidos, incluso con la contrasena correcta despues", async () => {
    for (let i = 0; i < 5; i++) {
      await login("test-profesor-a", "mala");
    }
    const afterBlock = await login("test-profesor-a", "test-profesor-a");
    expect(afterBlock.ok).toBe(false);
    expect(afterBlock.bloqueado).toBe(true);
  });

  it("usuario con password_temporal=1 puede loguear igual, con el flag en la respuesta", async () => {
    const body = await login("test-profesor-temp", "test-profesor-temp");
    expect(body.ok).toBe(true);
    expect(body.user.password_temporal).toBe(1);
  });

  it("un login correcto resetea el contador de intentos fallidos anteriores", async () => {
    await login("test-profesor-a", "mala");
    await login("test-profesor-a", "mala");
    const ok = await login("test-profesor-a", "test-profesor-a");
    expect(ok.ok).toBe(true);

    // Tras el login correcto, deberian hacer falta 5 fallos NUEVOS para
    // bloquear (no solo los 3 restantes de antes del reset).
    for (let i = 0; i < 3; i++) {
      await login("test-profesor-a", "mala");
    }
    const stillNotBlocked = await login("test-profesor-a", "mala");
    expect(stillNotBlocked.bloqueado).toBeFalsy();
  });
});

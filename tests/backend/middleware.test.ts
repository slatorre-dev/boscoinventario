import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestGet as listGet } from "../../functions/api/list.js";
import { onRequestPost as perfilPost } from "../../functions/api/perfil.js";
import { authQuery, callThroughMiddleware } from "./harness";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

describe("_middleware: resolucion de autenticacion", () => {
  it("resuelve data.user y data.departamento con usuario+contrasena validos", async () => {
    const { res, data } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", "test-profesor-a")}`,
    });
    expect(res.status).toBe(200);
    expect(data.user.usuario).toBe("test-profesor-a");
    expect(data.departamento).toBe("test-dept-a");
  });

  it("rechaza sin credenciales, sin llegar a ejecutar el handler protegido", async () => {
    let handlerCalled = false;
    const spyHandler = async () => {
      handlerCalled = true;
      return Response.json({ ok: true });
    };
    const { res } = await callThroughMiddleware(spyHandler, { path: "/api/list" });
    expect(res.status).toBe(401);
    expect(handlerCalled).toBe(false);
  });

  it("rechaza con contrasena incorrecta", async () => {
    const { res } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", "incorrecta")}`,
    });
    expect(res.status).toBe(401);
  });

  it("resuelve con token de sesion (t=) igual que con contrasena", async () => {
    await env.DB.prepare(
      "UPDATE usuarios SET session_token='test-token-fijo-123' WHERE usuario='test-profesor-a'"
    ).run();
    const { res, data } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", undefined, "test-token-fijo-123")}`,
    });
    expect(res.status).toBe(200);
    expect(data.user.usuario).toBe("test-profesor-a");
  });

  it("rechaza un token de sesion invalido", async () => {
    const { res } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", undefined, "token-que-no-existe")}`,
    });
    expect(res.status).toBe(401);
  });
});

describe("perfil: changePassword rota el session_token", () => {
  it("limpia password_temporal y devuelve un session_token nuevo que ya funciona", async () => {
    const before = await env.DB.prepare(
      "SELECT session_token FROM usuarios WHERE usuario='test-profesor-temp'"
    ).first<{ session_token: string | null }>();

    const { res } = await callThroughMiddleware(perfilPost, {
      method: "POST",
      path: `/api/perfil?${authQuery("test-profesor-temp", "test-profesor-temp")}`,
      body: { action: "changePassword", oldPassword: "test-profesor-temp", newPassword: "nueva1234" },
    });
    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.session_token).toBeTruthy();
    expect(body.session_token).not.toBe(before?.session_token);

    const row = await env.DB.prepare(
      "SELECT password_temporal, session_token FROM usuarios WHERE usuario='test-profesor-temp'"
    ).first<{ password_temporal: number; session_token: string }>();
    expect(row!.password_temporal).toBe(0);
    expect(row!.session_token).toBe(body.session_token);

    // El token nuevo ya autentica de verdad.
    const { res: res2, data } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-temp", undefined, row!.session_token)}`,
    });
    expect(res2.status).toBe(200);
    expect(data.user.usuario).toBe("test-profesor-temp");
  });
});

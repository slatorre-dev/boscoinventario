import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestPost as itemPost } from "../../functions/api/item.js";
import { onRequestGet as listGet } from "../../functions/api/list.js";
import { onRequestPost as prestarPost } from "../../functions/api/prestar.js";
import { onRequestPost as usuariosPost } from "../../functions/api/usuarios.js";
import { authQuery, callThroughMiddleware } from "./harness";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

async function itemRefs(u: string, p: string): Promise<string[]> {
  const { res } = await callThroughMiddleware(listGet, {
    path: `/api/list?${authQuery(u, p)}`,
  });
  const body: any = await res.json();
  const refIdx = body.itemsH.indexOf("ref");
  return body.itemsC.map((row: any[]) => row[refIdx]);
}

describe("scoping por departamento", () => {
  it("un profesor (rol profesor) ve los items de su propio departamento y los del departamento compartido (solo lectura)", async () => {
    const refs = await itemRefs("test-profesor-a", "test-profesor-a");
    expect(refs).toContain("TEST-A-001");
    expect(refs).not.toContain("TEST-B-001");
    // list.js ya no excluye el departamento compartido iesjuanbosco para el
    // rol "profesor" en la lectura (itemsQuery usa siempre GENERIC_DEPT) —
    // profesor puede VER esos items igual que jefe/a departamento y
    // superadmin, pero sigue sin poder editarlos/prestarlos/borrarlos (eso
    // lo bloquean item.js/prestar.js via el genericDept sentinel, ver los
    // tests de edicion mas abajo). Solo la query de "ciclos" sigue
    // sentinel'ada para que el desplegable de "Nuevo item" no le ofrezca
    // crear items nuevos en iesjuanbosco.
    expect(refs).toContain("TEST-SHARED-001");
  });

  it("un profesor auto-registrado (rol 'Profesor/a', el que asigna auth.js de verdad) tambien ve el departamento compartido", async () => {
    // auth.js:371 asigna 'Profesor/a' (mayuscula y slash) a cualquiera que
    // se registre por el formulario publico, igual que el alta manual desde
    // Usuarios y la importacion CSV (ROLES_DISPONIBLES en prestamos.js) —
    // es la forma mayoritaria en la app real, no 'profesor' a secas (esa
    // solo la usan las 24 cuentas sembradas por migracion y Google OAuth).
    // isProfesor() reconoce ambas formas por igual en list.js/meta.js
    // (lectura) e item.js/prestar.js/historial.js (edicion/prestamo/
    // historial, que se mantienen bloqueados).
    const refs = await itemRefs("test-profesor-selfreg", "test-profesor-selfreg");
    expect(refs).toContain("TEST-SHARED-001");
  });

  it("un jefe/a de departamento si ve el departamento compartido iesjuanbosco", async () => {
    const refs = await itemRefs("test-jefe-a", "test-jefe-a");
    expect(refs).toContain("TEST-A-001");
    expect(refs).toContain("TEST-SHARED-001");
    expect(refs).not.toContain("TEST-B-001");
  });

  it("superadmin ve items de todos los departamentos", async () => {
    const refs = await itemRefs("test-superadmin", "test-superadmin");
    expect(refs).toContain("TEST-A-001");
    expect(refs).toContain("TEST-B-001");
  });

  it("un profesor no puede editar un item de otro departamento (403)", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "update",
        item: {
          id: 9002,
          ref: "HACKEADO",
          aula: "aula-test-b",
          mod: "",
          item: "x",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.ok).toBe(false);

    // Confirma que no se colo el cambio pese al 403.
    const row = await env.DB.prepare("SELECT ref FROM inventario WHERE id=9002").first<{ ref: string }>();
    expect(row!.ref).toBe("TEST-B-001");
  });

  it("un profesor no puede borrar un item de otro departamento (403)", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: { action: "delete", id: 9002 },
    });
    expect(res.status).toBe(403);

    const row = await env.DB.prepare("SELECT id FROM inventario WHERE id=9002").first();
    expect(row).not.toBeNull();
  });

  it("un profesor si puede editar un item de su propio departamento", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "update",
        item: {
          id: 9001,
          ref: "TEST-A-001",
          aula: "aula-test-a",
          mod: "",
          item: "Item de prueba A editado",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
  });

  it("un jefe/a de departamento (de otro departamento) puede editar el item compartido iesjuanbosco", async () => {
    // Nota: el rol "profesor" NO tiene este acceso (ver test de scoping de
    // lista arriba) — isProfesor(user) excluye el departamento compartido
    // para ese rol en item.js igual que en list.js. Se usa test-jefe-a
    // (departamento test-dept-a) editando un item de iesjuanbosco para
    // confirmar que el acceso es "cualquier departamento propio", no solo
    // el suyo.
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-jefe-a", "test-jefe-a")}`,
      body: {
        action: "update",
        item: {
          id: 9003,
          ref: "TEST-SHARED-001",
          aula: "aula-test-shared",
          mod: "",
          item: "Item compartido editado",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(200);
  });

  it("un profesor (rol profesor) NO puede editar el item del departamento compartido", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-b", "test-profesor-b")}`,
      body: {
        action: "update",
        item: {
          id: 9003,
          ref: "TEST-SHARED-001",
          aula: "aula-test-shared",
          mod: "",
          item: "x",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(403);
  });

  it("superadmin puede editar un item de cualquier departamento", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-superadmin", "test-superadmin")}`,
      body: {
        action: "update",
        item: {
          id: 9002,
          ref: "TEST-B-001",
          aula: "aula-test-b",
          mod: "",
          item: "Editado por superadmin",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(200);
  });

  it("un prestamo de un item ajeno al departamento del actor se rechaza (403)", async () => {
    const { res } = await callThroughMiddleware(prestarPost, {
      method: "POST",
      path: `/api/prestar?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "prestar",
        prestamo: {
          itemId: 9002,
          itemNombre: "Item de prueba B",
          cantidad: 1,
          aulaOrigen: "aula-test-b",
          profesorNombre: "Test Profesor A",
        },
      },
    });
    expect(res.status).toBe(403);
  });

  it("un prestamo de un item del propio departamento del actor se acepta", async () => {
    const { res } = await callThroughMiddleware(prestarPost, {
      method: "POST",
      path: `/api/prestar?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "prestar",
        prestamo: {
          itemId: 9001,
          itemNombre: "Item de prueba A",
          cantidad: 1,
          aulaOrigen: "aula-test-a",
          profesorNombre: "Test Profesor A",
        },
      },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.prestamo).toBeTruthy();

    const row = await env.DB.prepare("SELECT * FROM prestamos WHERE itemId=9001").first<any>();
    expect(row).not.toBeNull();
    expect(row.cantidad).toBe(1);
  });

  it("mantenimientoMarcarRevisado: un profesor no puede marcar la revision de un item de otro departamento (403)", async () => {
    await env.DB.prepare("UPDATE inventario SET mantPlanIntervaloDias=90 WHERE id=9002").run();
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: { action: "mantenimientoMarcarRevisado", itemId: 9002, nota: "hackeado" },
    });
    expect(res.status).toBe(403);
    const row = await env.DB.prepare("SELECT mantPlanUltimaRevision FROM inventario WHERE id=9002").first<{ mantPlanUltimaRevision: string }>();
    expect(row!.mantPlanUltimaRevision || "").toBe("");
  });

  it("mantenimientoMarcarRevisado: un profesor si puede marcar la revision de un item de su propio departamento", async () => {
    await env.DB.prepare("UPDATE inventario SET mantPlanIntervaloDias=90 WHERE id=9001").run();
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: { action: "mantenimientoMarcarRevisado", itemId: 9001, nota: "revisado ok" },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mantPlanUltimaRevision).toBeTruthy();
    expect(body.mantPlanProximaRevision > body.mantPlanUltimaRevision).toBe(true);

    const mant = await env.DB.prepare("SELECT tipo, estado FROM mantenimientos WHERE item_id=9001 ORDER BY id DESC LIMIT 1").first<{ tipo: string; estado: string }>();
    expect(mant!.tipo).toBe("preventivo");
    expect(mant!.estado).toBe("Resuelto");
  });

  it("userAssignMantenimiento: un jefe/a de departamento no puede asignar categorias a un usuario de otro departamento (403)", async () => {
    const { res } = await callThroughMiddleware(usuariosPost, {
      method: "POST",
      path: `/api/usuarios?${authQuery("test-jefe-a", "test-jefe-a")}`,
      body: { action: "userAssignMantenimiento", usuario: "test-profesor-b", categorias: ["Herramientas"] },
    });
    expect(res.status).toBe(403);
  });
});

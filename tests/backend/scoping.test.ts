import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestPost as itemPost } from "../../functions/api/item.js";
import { onRequestGet as listGet } from "../../functions/api/list.js";
import { onRequestPost as prestarPost } from "../../functions/api/prestar.js";
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
  it("un profesor (rol profesor) solo ve los items de su propio departamento", async () => {
    const refs = await itemRefs("test-profesor-a", "test-profesor-a");
    expect(refs).toContain("TEST-A-001");
    expect(refs).not.toContain("TEST-B-001");
    // isProfesor(user) hace que list.js excluya el departamento compartido
    // iesjuanbosco para el rol "profesor" (genericDept='__none__' en vez de
    // GENERIC_DEPT) — solo jefe/a departamento y superadmin lo ven, ver el
    // siguiente test. Comportamiento real verificado en el codigo, no lo
    // que sugiere la wording de CLAUDE.md ("cualquier jefe/a de
    // departamento o profesor") — el codigo manda.
    expect(refs).not.toContain("TEST-SHARED-001");
  });

  it("un profesor auto-registrado (rol 'Profesor/a', el que asigna auth.js de verdad) SI ve el departamento compartido", async () => {
    // A diferencia de rol='profesor' (test anterior), auth.js:371 asigna
    // 'Profesor/a' (con mayuscula y slash) a cualquiera que se registre por
    // el formulario publico. isProfesor() en list.js/item.js/prestar.js
    // compara en minusculas contra exactamente 'profesor', asi que
    // 'Profesor/a' NO matchea -> isProfesor()===false -> SI recibe el bypass
    // de iesjuanbosco que a rol='profesor' se le niega. Comportamiento real
    // verificado en el codigo, no un bug de este test - discrepancia de la
    // propia app entre el rol de las migraciones de seed (profesor) y el
    // rol real de autoregistro (Profesor/a), documentada como pendiente en
    // CLAUDE.md.
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
});

const DRIVE_FOLDER_ID = '1Ld7lhl1JIcmihza6CMskMSxHty0Qujbg';
const MAX_BACKUPS = 6;

async function getDriveAccessToken(env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) throw new Error(data?.error_description || 'No se pudo obtener access token de Drive');
  return data.access_token;
}

async function listBackups(token) {
  const q = encodeURIComponent(`'${DRIVE_FOLDER_ID}' in parents and name contains 'backup-inventario-' and mimeType='application/json' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime asc&fields=files(id,name,createdTime)&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json().catch(() => ({}));
  return data.files || [];
}

async function deleteFile(token, fileId) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function uploadToDrive(token, filename, content) {
  const metadata = JSON.stringify({ name: filename, parents: [DRIVE_FOLDER_ID] });
  const body = new Uint8Array(new TextEncoder().encode(content));
  const boundary = '-------inv_backup_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`;
  const dataPart = `${delimiter}Content-Type: application/json\r\n\r\n`;

  const metaBytes = new TextEncoder().encode(metaPart);
  const dataHeaderBytes = new TextEncoder().encode(dataPart);
  const closeBytes = new TextEncoder().encode(closeDelimiter);

  const combined = new Uint8Array(metaBytes.length + dataHeaderBytes.length + body.length + closeBytes.length);
  combined.set(metaBytes, 0);
  combined.set(dataHeaderBytes, metaBytes.length);
  combined.set(body, metaBytes.length + dataHeaderBytes.length);
  combined.set(closeBytes, metaBytes.length + dataHeaderBytes.length + body.length);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Error subiendo a Drive');
  return data;
}

async function runBackup(db, token) {
  await db.prepare("ALTER TABLE inventario ADD COLUMN tipo_material TEXT DEFAULT 'consumible'").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN proveedor TEXT DEFAULT ''").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN tags TEXT DEFAULT ''").run().catch(() => {});
  await db.prepare("CREATE TABLE IF NOT EXISTS ubicaciones (name TEXT PRIMARY KEY, orden INTEGER DEFAULT 0)").run().catch(() => {});
  await db.prepare("UPDATE inventario SET tipo_material='inventariable' WHERE es_contenedor=1 AND (tipo_material IS NULL OR trim(tipo_material)='')").run().catch(() => {});
  await db.prepare("UPDATE inventario SET tipo_material='consumible' WHERE tipo_material IS NULL OR trim(tipo_material)=''").run().catch(() => {});
  const [inventario, aulas, cats, ubicaciones, ciclos, prestamos, profesores, usuarios] = await Promise.all([
    db.prepare('SELECT * FROM inventario').all(),
    db.prepare('SELECT * FROM aulas').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM categorias').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM ubicaciones').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM ciclos').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM prestamos').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM profesores').all().catch(() => ({ results: [] })),
    db.prepare('SELECT usuario, nombre, rol, email FROM usuarios').all().catch(() => ({ results: [] })),
  ]);

  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const backup = {
    meta: {
      app: 'Inventario IES Juan Bosco',
      exportedAt: now.toISOString(),
      counts: {
        items: inventario.results?.length ?? 0,
        aulas: aulas.results?.length ?? 0,
        categorias: cats.results?.length ?? 0,
        ubicaciones: ubicaciones.results?.length ?? 0,
        ciclos: ciclos.results?.length ?? 0,
        prestamos: prestamos.results?.length ?? 0,
        profesores: profesores.results?.length ?? 0,
        usuarios: usuarios.results?.length ?? 0,
      },
    },
    inventario: inventario.results ?? [],
    aulas: aulas.results ?? [],
    categorias: cats.results ?? [],
    ubicaciones: ubicaciones.results ?? [],
    ciclos: ciclos.results ?? [],
    prestamos: prestamos.results ?? [],
    profesores: profesores.results ?? [],
    usuarios: usuarios.results ?? [],
  };

  const filename = `backup-inventario-${stamp}.json`;
  const content = JSON.stringify(backup, null, 2);

  // Subir nuevo backup
  const uploaded = await uploadToDrive(token, filename, content);

  // Purgar antiguos si hay más de MAX_BACKUPS
  const existing = await listBackups(token);
  if (existing.length > MAX_BACKUPS) {
    const toDelete = existing.slice(0, existing.length - MAX_BACKUPS);
    await Promise.all(toDelete.map(f => deleteFile(token, f.id)));
    return { uploaded: uploaded.name, deleted: toDelete.map(f => f.name) };
  }

  return { uploaded: uploaded.name, deleted: [] };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || '';
  if (!env.BACKUP_SECRET || secret !== env.BACKUP_SECRET) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }
  try {
    const token = await getDriveAccessToken(env);
    const result = await runBackup(env.DB, token);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error('backup error', e?.message);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// Gestión de documentos adjuntos (metadatos)
async function auditLog(db, user, accion, itemId, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, user.usuario, user.nombre, user.rol, accion, String(itemId || ''), resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncodeBytes(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return base64UrlEncode(str);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return base64ToUint8Array(b64).buffer;
}

async function signJwt(privateKeyPem, payload) {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(payload)
  );
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function getGoogleAccessToken(env) {
  if (env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
      throw new Error('Google OAuth incompleto: faltan GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET');
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error('Google OAuth refresh error: ' + (tokenJson.error_description || tokenJson.error || JSON.stringify(tokenJson)));
    }
    return tokenJson.access_token;
  }

  const sa = env.GOOGLE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('Google Drive no configurado');
  const account = typeof sa === 'string' ? JSON.parse(sa) : sa;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const jwtPayload = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const signature = await signJwt(account.private_key, jwtPayload);
  const assertion = `${jwtPayload}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error('Google OAuth error: ' + (tokenJson.error_description || tokenJson.error || JSON.stringify(tokenJson)));
  }
  return tokenJson.access_token;
}

function normalizeFolderName(name) {
  return String(name || '').trim() || 'Aula';
}

function driveErrorMessage(prefix, payload) {
  const message = payload?.error?.message || JSON.stringify(payload);
  if (/storageQuotaExceeded|Service Accounts do not have storage quota|shared drives/i.test(message)) {
    return prefix + ': Google rechaza la subida porque la cuenta de servicio no tiene cuota propia. Usa como GOOGLE_DRIVE_ROOT_FOLDER_ID una carpeta dentro de una Unidad compartida de Google Drive y añade el service account como Gestor de contenido o Editor. Detalle: ' + message;
  }
  return prefix + ': ' + message;
}

async function findOrCreateDriveFolder(env, parentFolderId, folderName) {
  const token = await getGoogleAccessToken(env);
  const safeName = normalizeFolderName(folderName).replace(/'/g, "\\'");
  const query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and '${parentFolderId}' in parents and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`;
  const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } });
  const searchJson = await searchRes.json();
  if (searchRes.ok && Array.isArray(searchJson.files) && searchJson.files.length > 0) {
    return searchJson.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: normalizeFolderName(folderName),
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson.id) {
    throw new Error(driveErrorMessage('No se pudo crear la carpeta de aula en Drive', createJson));
  }
  return createJson.id;
}

async function uploadFileToDrive(env, folderId, fileName, mimeType, base64Data) {
  const token = await getGoogleAccessToken(env);
  const boundary = '-------314159265358979323846';
  const metadata = {
    name: fileName,
    parents: [folderId],
  };
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const metadataPart =
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n';
  const fileHeader = `Content-Type: ${mimeType}\r\n\r\n`;
  const preamble = new TextEncoder().encode(delimiter + metadataPart + `--${boundary}\r\n` + fileHeader);
  const fileData = base64ToUint8Array(base64Data);
  const postamble = new TextEncoder().encode(closeDelimiter);
  const body = new Uint8Array(preamble.length + fileData.length + postamble.length);
  body.set(preamble, 0);
  body.set(fileData, preamble.length);
  body.set(postamble, preamble.length + fileData.length);

  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.id) {
    throw new Error(driveErrorMessage('No se pudo subir el archivo a Drive', uploadJson));
  }

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadJson.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (e) {
    // Si falla el permiso público, seguimos guardando el documento.
  }

  return {
    driveId: uploadJson.id,
    driveUrl: uploadJson.webViewLink || `https://drive.google.com/file/d/${uploadJson.id}/view`,
  };
}

const GENERIC_DEPT = 'iesjuanbosco'; // "IES Juan Bosco": bolsa compartida, visible/editable por cualquier departamento

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

// ¿Puede este usuario ver/tocar documentos del ítem itemId? Mismo departamento,
// departamento compartido, o superadmin (ve todo) — igual que en item.js.
async function canAccessItemDocs(db, user, itemId) {
  if (isSuperAdmin(user)) return true;
  const row = await db.prepare('SELECT departamento FROM inventario WHERE id=?').bind(itemId).first();
  if (!row) return false;
  const dept = row.departamento || '';
  return dept === (user?.departamento || '') || dept === GENERIC_DEPT;
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  if (!user) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  if (action === 'getDocs') {
    const itemId = body.itemId;
    if (itemId == null) return Response.json({ ok: false, error: 'itemId requerido' });
    if (!await canAccessItemDocs(env.DB, user, itemId)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const docs = await env.DB.prepare('SELECT * FROM documentos WHERE itemId=? ORDER BY id').bind(itemId).all();
    return Response.json({ ok: true, docs: docs.results || [] });
  }

  if (action === 'deleteDoc') {
    const docId = body.docId;
    if (docId == null) return Response.json({ ok: false, error: 'docId requerido' });
    const docRow = await env.DB.prepare('SELECT itemId FROM documentos WHERE id=?').bind(docId).first();
    if (!docRow) return Response.json({ ok: false, error: 'Documento no encontrado' });
    if (!await canAccessItemDocs(env.DB, user, docRow.itemId)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    if (body.driveId) {
      try {
        const token = await getGoogleAccessToken(env);
        await fetch(`https://www.googleapis.com/drive/v3/files/${body.driveId}?supportsAllDrives=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // Ignoramos si la eliminación en Drive falla y seguimos borrando metadatos.
      }
    }
    await env.DB.prepare('DELETE FROM documentos WHERE id=?').bind(docId).run();
    await auditLog(env.DB, user, 'deleteDoc', body.itemId, `Doc ${docId} eliminado`);
    return Response.json({ ok: true });
  }

  if (action === 'uploadDoc') {
    const { itemId, itemNombre, aulaId, aulaName, fileName, mimeType, data: fileData } = body;
    if (itemId == null) return Response.json({ ok: false, error: 'itemId requerido' });
    if (!fileName) return Response.json({ ok: false, error: 'fileName requerido' });
    if (!fileData) return Response.json({ ok: false, error: 'data requerido' });
    if (!await canAccessItemDocs(env.DB, user, itemId)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID || env.DRIVE_FOLDER_ID;
    if (!rootFolderId) return Response.json({ ok: false, error: 'Drive root folder no configurado' });

    try {
      const folderId = await findOrCreateDriveFolder(env, rootFolderId, aulaName || aulaId || 'Aula');
      const uploaded = await uploadFileToDrive(env, folderId, fileName, mimeType || 'application/octet-stream', fileData);
      await env.DB.prepare('INSERT INTO documentos (itemId,itemNombre,aulaId,fileName,driveId,driveUrl,fecha) VALUES (?,?,?,?,?,?,?)')
        .bind(itemId, itemNombre || '', aulaId || '', fileName, uploaded.driveId, uploaded.driveUrl, new Date().toISOString()).run();
      const doc = await env.DB.prepare('SELECT * FROM documentos WHERE driveId=?').bind(uploaded.driveId).first();
      await auditLog(env.DB, user, 'uploadDoc', itemId, `Documento subido: ${fileName}`);
      return Response.json({ ok: true, doc });
    } catch (error) {
      return Response.json({ ok: false, error: error.message || String(error) });
    }
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}

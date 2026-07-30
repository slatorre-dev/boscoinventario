/**
 * Pages Function — Proxy para GitHub Models (OpenAI-compatible)
 * Ruta: /api/proxy-ai
 * GITHUB_TOKEN: Personal Access Token de GitHub (secret de Cloudflare)
 * Modelos disponibles: gpt-4o-mini, gpt-4o, meta-llama-3.1-70b-instruct, phi-4, mistral-large...
 * Protegido por functions/api/_middleware.js (requiere u+p o u+t válidos) — antes vivía
 * en /proxy/ai, fuera del alcance del middleware, sin ninguna autenticación.
 */

const GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions';

export async function onRequestPost({ request, env }) {
  if (!env.GITHUB_TOKEN) {
    return Response.json({ error: 'GITHUB_TOKEN no configurado en Cloudflare' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const resp = await fetch(GITHUB_MODELS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

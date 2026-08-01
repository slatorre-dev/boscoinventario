/**
 * Pages Function — Proxy para el chat de Volt vía Cloudflare Workers AI
 * Ruta: /api/proxy-ai
 * Antes usaba GitHub Models (retirado el 30/07/2026, ver claude.md) — ahora
 * usa el binding nativo env.AI (mismo binding que ya usa item.js:buscarPorSerie).
 * Protegido por functions/api/_middleware.js (requiere u+p o u+t válidos).
 *
 * Sin streaming real: se esperó a que env.AI.run() con stream:true tradujera
 * bien el stream nativo a SSE (2 intentos, ambos colgados sin devolver
 * datos ni error — causa no confirmada), así que se simplificó a una sola
 * llamada no-streaming y se envuelve la respuesta completa en un único
 * chunk SSE — el frontend (js/agente-widget.js:streamAI()) sigue esperando
 * SSE con "data: {choices:[{delta:{content}}]}" + "data: [DONE]", así que
 * no necesita ningún cambio, solo pierde el efecto de escritura incremental
 * (la respuesta aparece de golpe en vez de palabra por palabra).
 */

const MODEL = '@cf/zai-org/glm-4.7-flash';

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return Response.json({ error: 'Workers AI no configurado en Cloudflare' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const maxTokens = body.max_tokens || 500;

  let aiData;
  try {
    aiData = await env.AI.run(MODEL, {
      messages,
      max_tokens: maxTokens
    });
  } catch (e) {
    return Response.json({ error: 'Error del servicio de IA: ' + String(e?.message || e) }, { status: 500 });
  }

  const content = aiData?.response || '';
  const chunk = { choices: [{ delta: { content } }] };
  const sse = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;

  return new Response(sse, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}

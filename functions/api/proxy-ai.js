/**
 * Pages Function — Proxy para el chat de Volt vía Cloudflare Workers AI
 * Ruta: /api/proxy-ai
 * Antes usaba GitHub Models (retirado el 30/07/2026, ver claude.md) — ahora
 * usa el binding nativo env.AI (mismo binding que ya usa item.js:buscarPorSerie).
 * Protegido por functions/api/_middleware.js (requiere u+p o u+t válidos).
 *
 * El frontend (js/agente-widget.js:streamAI()) espera SSE en formato OpenAI
 * ("data: {choices:[{delta:{content}}]}\n\n" por chunk, "data: [DONE]" al
 * final) — este archivo traduce el stream nativo de Workers AI a ese
 * formato exacto para no tener que tocar el frontend.
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

  let aiStream;
  try {
    aiStream = await env.AI.run(MODEL, {
      messages,
      max_tokens: maxTokens,
      stream: true
    });
  } catch (e) {
    return Response.json({ error: 'Error del servicio de IA: ' + String(e?.message || e) }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = aiStream.getReader();

  const translated = new ReadableStream({
    async pull(controller) {
      // Sigue leyendo del stream nativo hasta encolar algo (contenido real o
      // el cierre) — un solo read() puede traer un chunk sin contenido útil
      // (línea vacía, [DONE] de Workers AI que descartamos), y si pull()
      // retorna sin encolar nada el stream queda esperando indefinidamente.
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }
        const text = decoder.decode(value, { stream: true });
        let enqueued = false;
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          let content = '';
          try {
            const parsed = JSON.parse(payload);
            content = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? '';
          } catch {
            const dbg = { choices: [{ delta: { content: '[DEBUG raw]: ' + payload.slice(0, 200) } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(dbg)}\n\n`));
            enqueued = true;
            continue;
          }
          if (!content) {
            const dbg = { choices: [{ delta: { content: '[DEBUG parsed]: ' + JSON.stringify(parsed).slice(0, 200) } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(dbg)}\n\n`));
            enqueued = true;
            continue;
          }
          const chunk = { choices: [{ delta: { content } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          enqueued = true;
        }
        if (enqueued) return;
      }
    }
  });

  return new Response(translated, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}

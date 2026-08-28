import {
  createPagesEventContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { onRequest as authMiddleware } from "../../functions/api/_middleware.js";

type Handler = (ctx: any) => Promise<Response>;

// Encadena _middleware.js -> el handler real, igual que hace el router de
// Cloudflare Pages para cualquier ruta bajo /api/*: si el middleware llama a
// next(), el handler recibe el MISMO objeto `data` que el middleware acabo
// de rellenar (data.user, data.departamento).
export async function callThroughMiddleware(
  handler: Handler,
  opts: { method?: string; path: string; body?: unknown }
): Promise<{ res: Response; data: Record<string, any> }> {
  const request = new Request("http://example.com" + opts.path, {
    method: opts.method || "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data: Record<string, any> = {};
  const ctx = createPagesEventContext<any>({
    request,
    data,
    next: async () => {
      const innerCtx = createPagesEventContext<any>({ request, data });
      const res = await handler(innerCtx);
      await waitOnExecutionContext(innerCtx as any);
      return res;
    },
  });
  const res = await authMiddleware(ctx as any);
  await waitOnExecutionContext(ctx as any);
  return { res, data };
}

export function authQuery(u: string, p?: string, t?: string): string {
  const params = new URLSearchParams({ u });
  if (p) params.set("p", p);
  if (t) params.set("t", t);
  return params.toString();
}

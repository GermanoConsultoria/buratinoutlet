import "./lib/error-capture";
import process from "node:process";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

async function handleDanfeProxy(saleId: string): Promise<Response> {
  const token = process.env.FOCUS_NFE_TOKEN;
  const ambiente = process.env.FOCUS_NFE_AMBIENTE;
  if (!token || !ambiente) {
    return new Response("Focus NFe não configurado", { status: 503 });
  }
  const baseUrl =
    ambiente === "producao"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";

  const ref = `venda-${saleId}`;
  const resp = await fetch(
    `${baseUrl}/v2/nfce/${encodeURIComponent(ref)}/danfe`,
    { headers: { Authorization: `Basic ${btoa(`${token}:`)}` } },
  );
  if (!resp.ok) {
    return new Response(`Erro ao buscar DANFE: ${resp.status}`, { status: resp.status });
  }
  return new Response(resp.body, {
    headers: {
      "Content-Type": resp.headers.get("Content-Type") ?? "application/pdf",
      "Content-Disposition": `inline; filename="danfce-${saleId}.pdf"`,
    },
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const danfeMatch = url.pathname.match(/^\/api\/danfe\/([^/]+)$/);
    if (danfeMatch) return handleDanfeProxy(danfeMatch[1]);

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
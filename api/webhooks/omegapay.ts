import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { api: { bodyParser: false } };

async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const body = await rawBody(req);
    const event: any = JSON.parse(body.toString("utf8"));

    // Log para depuração. A liberação de acesso no frontend continua via polling de /api/pix/status.
    console.info("OmegaPay webhook recebido", {
      transactionId: event?.transactionId || event?.id || event?.data?.id || null,
      clientIdentifier: event?.clientIdentifier || event?.identifier || null,
      status: event?.status || event?.transactionStatus || event?.data?.status || null,
    });

    return res.status(200).json({ received: true });
  } catch {
    return res.status(400).json({ error: "Corpo do webhook inválido" });
  }
}

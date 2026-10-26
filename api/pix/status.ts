import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_BASE = "https://app.omegapayments.com.br/api/v1";
const json = (res: VercelResponse, status: number, body: unknown) =>
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").json(body);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido" });

  const publicKey = process.env.OMEGAPAY_PUBLIC_KEY;
  const secretKey = process.env.OMEGAPAY_SECRET_KEY;
  const id = String(req.query.identifier || "").trim();

  if (!publicKey || !secretKey) {
    return json(res, 500, { error: "Configure OMEGAPAY_PUBLIC_KEY e OMEGAPAY_SECRET_KEY na Vercel." });
  }
  if (!id || id.length > 200) return json(res, 400, { error: "Identificador inválido." });

  try {
    let upstream = await fetch(
      `${API_BASE}/gateway/transactions?id=${encodeURIComponent(id)}`,
      {
        headers: {
          "x-public-key": publicKey,
          "x-secret-key": secretKey,
          Accept: "application/json",
        },
      }
    );

    let result: any = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      upstream = await fetch(
        `${API_BASE}/gateway/transactions?clientIdentifier=${encodeURIComponent(id)}`,
        {
          headers: {
            "x-public-key": publicKey,
            "x-secret-key": secretKey,
            Accept: "application/json",
          },
        }
      );
      result = await upstream.json().catch(() => ({}));
    }

    if (!upstream.ok) {
      const message =
        typeof result?.message === "string"
          ? result.message
          : typeof result?.error === "string"
            ? result.error
            : "Não foi possível consultar o Pix na OmegaPay.";
      return json(res, upstream.status, { error: message });
    }

    const transaction = result?.data ?? result?.transaction ?? result;
    const rawStatus = String(
      transaction?.status || transaction?.transactionStatus || result?.status || "pending"
    ).toLowerCase();

    const paid = ["paid", "completed", "confirmed", "approved", "ok", "success"].includes(rawStatus);
    const failed = ["expired", "cancelled", "canceled", "failed", "refunded", "denied"].includes(rawStatus);

    return json(res, 200, {
      payment: {
        id: transaction?.id || transaction?.transactionId || id,
        amount: transaction?.chargeAmount ?? transaction?.amount,
        status: paid ? "paid" : failed ? "failed" : "pending",
        provider_status: rawStatus,
      },
    });
  } catch (error) {
    console.error("Erro ao consultar transação OmegaPay", error);
    return json(res, 502, { error: "Não foi possível consultar a OmegaPay." });
  }
}

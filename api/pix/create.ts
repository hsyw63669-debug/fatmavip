import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_BASE = "https://app.omegapayments.com.br/api/v1";
const json = (res: VercelResponse, status: number, body: unknown) =>
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").json(body);

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Gera um CPF matematicamente válido (somente dígitos). */
function randomCpf(): string {
  let n: number[];
  do {
    n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  } while (n.every((d) => d === n[0]));

  const calc = (base: number[]) => {
    const sum = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(n);
  const d2 = calc([...n, d1]);
  return [...n, d1, d2].join("");
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });

  const publicKey = process.env.OMEGAPAY_PUBLIC_KEY;
  const secretKey = process.env.OMEGAPAY_SECRET_KEY;
  if (!publicKey || !secretKey) {
    return json(res, 500, {
      error: "Configure OMEGAPAY_PUBLIC_KEY e OMEGAPAY_SECRET_KEY nas variáveis de ambiente da Vercel.",
    });
  }

  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return json(res, 400, { error: "Valor inválido. Informe um valor entre R$ 1,00 e R$ 100.000,00." });
  }

  const externalId =
    text(req.body?.idempotency_key, 120) ||
    `fatima_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const description = text(req.body?.description, 120) || "Acesso exclusivo - Fátima Araújo";

  const baseUrl = (
    process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  ).replace(/\/$/, "");

  const clientName = text(req.body?.client_name, 80) || text(req.body?.name, 80) || "Cliente";
  const clientEmail =
    text(req.body?.client_email, 120) ||
    text(req.body?.email, 120) ||
    `cliente${Date.now()}@gmail.com`;

  let clientPhone = onlyDigits(
    text(req.body?.client_phone, 30) || text(req.body?.phone, 30) || ""
  );
  if (clientPhone.length < 10 || clientPhone.length > 11) clientPhone = "11999999999";

  let clientDocument = onlyDigits(
    text(req.body?.client_document, 20) ||
      text(req.body?.document, 20) ||
      text(req.body?.cpf, 20) ||
      ""
  );
  if (clientDocument.length !== 11) {
    clientDocument = randomCpf();
  }

  const payload: Record<string, unknown> = {
    identifier: externalId,
    amount: Number(amount.toFixed(2)),
    client: {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      document: clientDocument,
    },
    products: [
      {
        id: externalId.slice(0, 20),
        name: description.slice(0, 80) || "Acesso VIP",
        quantity: 1,
        price: Number(amount.toFixed(2)),
      },
    ],
    metadata: {
      description,
      lead_id: text(req.body?.lead_id, 80) || undefined,
      source: text(req.body?.source, 80) || undefined,
      campaign: text(req.body?.campaign, 80) || undefined,
    },
  };

  if (baseUrl) {
    payload.callbackUrl = `${baseUrl}/api/webhooks/omegapay`;
  }

  try {
    const upstream = await fetch(`${API_BASE}/gateway/pix/receive`, {
      method: "POST",
      headers: {
        "x-public-key": publicKey,
        "x-secret-key": secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result: any = await upstream.json().catch(() => ({}));

    if (!upstream.ok || result?.status === "FAILED" || result?.errorCode) {
      const message =
        typeof result?.message === "string"
          ? result.message
          : typeof result?.errorDescription === "string"
            ? result.errorDescription
            : typeof result?.error === "string"
              ? result.error
              : "A OmegaPay recusou a cobrança Pix.";
      return json(res, upstream.status >= 400 ? upstream.status : 502, {
        error: message,
        details: result?.details || result?.errors || undefined,
      });
    }

    const transactionId = text(result?.transactionId, 200) || text(result?.id, 200);
    const identifier = transactionId || externalId;
    const pix = result?.pix || {};
    const pixCode =
      text(pix?.code, 10000) ||
      text(pix?.qrCode, 10000) ||
      text(pix?.copiaCola, 10000) ||
      text(result?.pix_copia_cola, 10000);
    const pixImage =
      text(pix?.image, 2000) ||
      text(pix?.base64, 200000) ||
      text(result?.pix_image, 2000);
    const checkoutUrl = text(result?.order?.url, 2000) || text(result?.checkout_url, 2000);

    if (!pixCode && !checkoutUrl) {
      return json(res, 502, {
        error: "A OmegaPay não retornou o código Pix nem link de checkout.",
        details: result,
      });
    }

    return json(res, 200, {
      identifier,
      external_id: externalId,
      amount: Number(amount.toFixed(2)),
      pix_code: pixCode,
      pix_image: pixImage,
      checkout_url: checkoutUrl || undefined,
      status: String(result?.transactionStatus || result?.status || "pending").toLowerCase(),
      expires_at: pix?.expiresAt || undefined,
      webhook_token: result?.webhookToken || undefined,
    });
  } catch (error) {
    console.error("Erro ao conectar à OmegaPay", error);
    return json(res, 502, { error: "Não foi possível conectar à OmegaPay. Tente novamente em instantes." });
  }
}

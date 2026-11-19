/**
 * ZarinPal v4 REST gateway (https://www.zarinpal.com/docs/paymentGateway/).
 *
 *   ZARINPAL_MERCHANT_ID   36-character merchant id (any UUID works in sandbox)
 *   ZARINPAL_SANDBOX=1     use sandbox.zarinpal.com — test the whole flow without a real account
 *
 * Amounts are passed in Toman and sent in Rial (the gateway's default unit).
 */
const host = () => (process.env.ZARINPAL_SANDBOX === "1" ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com");

export const zarinpalConfigured = () => /^[0-9a-f-]{36}$/i.test(process.env.ZARINPAL_MERCHANT_ID || "");

export class GatewayError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
  }
}

async function call(path, body) {
  let res;
  try {
    res = await fetch(`${host()}/pg/v4/payment/${path}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ merchant_id: process.env.ZARINPAL_MERCHANT_ID, ...body }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch (err) {
    throw new GatewayError(`ارتباط با درگاه پرداخت برقرار نشد (${err?.name === "TimeoutError" ? "پایان مهلت" : "خطای شبکه"})`);
  }
  const json = await res.json().catch(() => null);
  // success: { data: { code, ... }, errors: [] }  failure: { data: [], errors: { code, message } }
  const code = json?.data?.code ?? json?.errors?.code ?? null;
  return { code: code == null ? null : Number(code), data: json?.data || {}, message: json?.errors?.message || "" };
}

/** @returns {{ authority: string, url: string }} */
export async function requestPayment({ amountToman, callbackUrl, description, mobile, email }) {
  if (!zarinpalConfigured()) throw new GatewayError("درگاه پرداخت تنظیم نشده است");
  const { code, data, message } = await call("request", {
    amount: Math.round(amountToman * 10),
    callback_url: callbackUrl,
    description: String(description || "").slice(0, 250),
    metadata: { ...(mobile ? { mobile } : {}), ...(email ? { email } : {}) },
  });
  if (code !== 100 || !data.authority) throw new GatewayError(`درگاه درخواست را نپذیرفت${message ? `: ${message}` : ""}`, code);
  return { authority: data.authority, url: `${host()}/pg/StartPay/${data.authority}` };
}

/**
 * 100 = verified now, 101 = already verified earlier (a repeated callback) — both are paid.
 * @returns {{ ok: boolean, refId: string|null, cardPan: string|null, code: number|null }}
 */
export async function verifyPayment({ amountToman, authority }) {
  const { code, data } = await call("verify", { amount: Math.round(amountToman * 10), authority });
  const ok = code === 100 || code === 101;
  return { ok, code, refId: ok && data.ref_id != null ? String(data.ref_id) : null, cardPan: data.card_pan || null };
}

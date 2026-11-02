const TIMEOUT_MS = 15_000;
const STATUS_CHECKS = 5;

// Holds only our own text and a numeric code, so it's safe to log and save.
export class DeliveryError extends Error {}

function refused(provider: string, code: unknown, status: number) {
  return new DeliveryError(`${provider} refused this message (error ${Number(code) || status})`);
}

// Twilio can accept a message and fail it a moment later, such as when the number
// hasn't joined the sandbox. A failed check is ignored: retrying could send twice.
async function checkWhatsApp(url: string, authorization: string) {
  for (let check = 0; check < STATUS_CHECKS; check++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch(url, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (result?.status === "failed" || result?.status === "undelivered") {
      throw refused("Twilio", result.error_code, response?.status ?? 0);
    }
    if (["sent", "delivered", "read"].includes(result?.status)) return;
  }
}

export async function sendWhatsApp(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) throw new DeliveryError("WhatsApp sending isn't set up");

  const base = process.env.TWILIO_API_URL ?? "https://api.twilio.com";
  const url = `${base}/2010-04-01/Accounts/${sid}/Messages`;
  const authorization = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
  const response = await fetch(`${url}.json`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: new URLSearchParams({
      To: `whatsapp:${to}`,
      From: `whatsapp:${from.replace("whatsapp:", "")}`,
      Body: body,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.sid) throw refused("Twilio", result?.code, response.status);

  await checkWhatsApp(`${url}/${result.sid}.json`, authorization);
  return result.sid as string;
}

export async function sendEmail(to: string, subject: string, body: string, key: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new DeliveryError("Email sending isn't set up");

  const base = process.env.RESEND_API_URL ?? "https://api.resend.com";
  const response = await fetch(`${base}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Stops a second email if this runs again after a crash.
      "Idempotency-Key": key,
    },
    // Plain text only, so nothing from a letter can become HTML.
    body: JSON.stringify({ from, to: [to], subject, text: body }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) throw refused("Resend", null, response.status);
  return result.id as string;
}

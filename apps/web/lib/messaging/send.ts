const TIMEOUT_MS = 15_000;

// Holds only our own text and a numeric code, so it's safe to log and save.
export class DeliveryError extends Error {}

function refused(provider: string, code: unknown, status: number) {
  return new DeliveryError(`${provider} refused this message (error ${Number(code) || status})`);
}

export async function sendWhatsApp(to: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new DeliveryError("WhatsApp sending isn't set up");

  const base = process.env.WHATSAPP_API_URL ?? "https://graph.facebook.com";
  const response = await fetch(`${base}/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace("+", ""),
      type: "text",
      text: { body },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const result = await response.json().catch(() => null);
  const id = result?.messages?.[0]?.id;
  if (!response.ok || !id) throw refused("WhatsApp", result?.error?.code, response.status);
  return id as string;
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

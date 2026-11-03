export const SAMPLE_VALUES = {
  patient_name: "Asha Verma",
  patient_id: "PAT-001",
  claim_number: "CL-9921",
  requested_items:
    "1. A hospital bill listing each charge.\n   Why: Your insurer needs to see each charge separately.",
};

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

// A typo here would stop every message, so it's caught when the template is saved.
export function templateProblem(body: string, subject: string | null) {
  const names = [...`${subject ?? ""} ${body}`.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
  const unknown = names.find((name) => !(name in SAMPLE_VALUES));
  if (unknown) return `{{${unknown}}} isn't a known placeholder`;
  if (![...body.matchAll(PLACEHOLDER)].some((match) => match[1] === "requested_items")) {
    return "The message needs {{requested_items}}, or it won't say what's needed";
  }
  return null;
}

// One pass, so text from the AI can't be filled in again. Returns null if any
// placeholder has no value: no message is better than an incomplete one.
export function fillTemplate(text: string, values: Record<string, string | null>) {
  let complete = true;
  const filled = text.replace(PLACEHOLDER, (_, name: string) => {
    const value = values[name];
    if (!value) complete = false;
    return value ?? "";
  });
  return complete ? filled : null;
}

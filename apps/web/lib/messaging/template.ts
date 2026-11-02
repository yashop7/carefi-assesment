// One pass, so text from the AI can't be filled in again. Returns null if any
// placeholder has no value: no message is better than an incomplete one.
export function fillTemplate(text: string, values: Record<string, string | null>) {
  let complete = true;
  const filled = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const value = values[name];
    if (!value) complete = false;
    return value ?? "";
  });
  return complete ? filled : null;
}

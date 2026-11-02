import { randomUUID } from "node:crypto";
import { createExpiringLink, deleteObject, putObject } from "../lib/storage";

const key = `check/${randomUUID()}.txt`;
const content = "CareFi storage check, fake data";
let failed = false;

function report(name: string, passed: boolean, detail: string) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name} (${detail})`);
  if (!passed) failed = true;
}

async function step(name: string, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    // Only the error's name: messages can include request details.
    report(name, false, error instanceof Error ? error.name : "unknown error");
  }
}

async function expectRefused(name: string, url: string) {
  const response = await fetch(url);
  report(name, response.status === 403, `status ${response.status}`);
}

let uploaded = false;

await step("Upload, then fetch through an expiring link", async () => {
  await putObject(key, content, "text/plain");
  uploaded = true;
  const response = await fetch(await createExpiringLink(key));
  const body = await response.text();
  report(
    "Upload, then fetch through an expiring link",
    response.status === 200 && body === content,
    `status ${response.status}`,
  );
});

await step("Fetch with no signature is refused", async () => {
  const link = new URL(await createExpiringLink(key));
  link.search = "";
  await expectRefused("Fetch with no signature is refused", link.toString());
});

await step("Fetch with a changed signature is refused", async () => {
  const link = new URL(await createExpiringLink(key));
  const signature = link.searchParams.get("X-Amz-Signature") ?? "";
  const changed = (signature.startsWith("0") ? "1" : "0") + signature.slice(1);
  link.searchParams.set("X-Amz-Signature", changed);
  await expectRefused(
    "Fetch with a changed signature is refused",
    link.toString(),
  );
});

await step("Fetch through an expired link is refused", async () => {
  const link = await createExpiringLink(key, 1);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await expectRefused("Fetch through an expired link is refused", link);
});

if (uploaded) {
  await step("Test file is deleted afterwards", async () => {
    await deleteObject(key);
    const response = await fetch(await createExpiringLink(key));
    report(
      "Test file is deleted afterwards",
      response.status === 404,
      `status ${response.status}`,
    );
  });
}

process.exit(failed ? 1 : 0);

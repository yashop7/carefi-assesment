// Scores the agent against test-data/stage8. Run with a test database, a test
// bucket and a stand-in email service, because it uploads files and sends messages.
// Only some letters: bun run score L01 L05
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "db";
import { runAgent } from "../lib/agent/graph";
import { readDocument } from "../lib/documents";
import { readPatientRows } from "../lib/import";
import { putObject } from "../lib/storage";
import { detectFileType, newStorageKey } from "../lib/uploads";

type Expected = { asks: string; match: string[]; status: string; document?: string };
type Answer = { letter: string; patient: string; case: string; file: string; points: Expected[] };
type Found = { asksFor: string; status: string; reason: string; document: { fileName: string } | null };

const ROOT = new URL("../../../test-data/stage8", import.meta.url).pathname;

for (const name of ["DATABASE_URL", "S3_ENDPOINT", "RESEND_API_URL"]) {
  const host = URL.canParse(process.env[name] ?? "") ? new URL(process.env[name]!).hostname : "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.error(`Stopped: ${name} must point at this computer, so nothing real is touched.`);
    process.exit(1);
  }
}

let aiCalls = 0;
let aiTokens = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  const response = await realFetch(...args);
  if (String(args[0]).includes("/responses")) {
    aiCalls++;
    const body = await response.clone().json().catch(() => null);
    aiTokens += body?.usage?.total_tokens ?? 0;
  }
  return response;
}) as typeof fetch;

function matches(point: Found, expected: Expected) {
  const text = point.asksFor.toLowerCase();
  return expected.match.every((word) => word.split("|").some((option) => text.includes(option)));
}

async function loadPatients() {
  const { rows } = readPatientRows(readFileSync(join(ROOT, "patients.csv"), "utf8"));
  const ids = new Map<string, string>();
  for (const row of rows) {
    const code = row["patientCode"]!;
    const patient =
      (await db.orm.public.Patient.first({ patientCode: code })) ??
      (await db.orm.public.Patient.create({
        patientCode: code,
        name: row["name"]!,
        phone: row["phone"]!,
        email: row["email"]!,
        policyNumber: row["policyNumber"]!,
        claimNumber: row["claimNumber"]!,
      }));
    ids.set(code, patient.id);
  }
  return ids;
}

// Documents already there are kept, so a second run doesn't pay to read them again.
async function loadLocker(code: string, patientId: string) {
  const folder = join(ROOT, "lockers", code);
  for (const fileName of readdirSync(folder)) {
    if (await db.orm.public.Document.where({ patientId, fileName }).first()) continue;
    const content = new Uint8Array(readFileSync(join(folder, fileName)));
    const mimeType = detectFileType(content)!;
    const storageKey = newStorageKey(patientId);
    await putObject(storageKey, content, mimeType);
    const document = await db.orm.public.Document.create({
      patientId,
      fileName,
      storageKey,
      mimeType,
      sizeBytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
      uploadedBy: "score-script",
    });
    await readDocument(document.id);
  }
}

async function runLetter(answer: Answer, patientId: string) {
  const content = new Uint8Array(readFileSync(join(ROOT, "letters", answer.patient, answer.file)));
  const mimeType = detectFileType(content)!;
  const storageKey = newStorageKey(patientId, "queries");
  await putObject(storageKey, content, mimeType);
  const letter = await db.orm.public.QueryLetter.create({
    patientId,
    fileName: answer.file,
    storageKey,
    mimeType,
    uploadedBy: "score-script",
  });
  await runAgent(letter.id);
  return (await db.orm.public.QueryPoint.where({ queryLetterId: letter.id })
    .include("document", (document) => document.select("fileName"))
    .orderBy((point) => point.position.asc())
    .limit(50)
    .all()) as Found[];
}

function score(answer: Answer, found: Found[]) {
  const misses: string[] = [];
  const unused = [...found];
  let pointsFound = 0;
  let decisionsRight = 0;

  for (const expected of answer.points) {
    const index = unused.findIndex((point) => matches(point, expected));
    if (index < 0) {
      misses.push(`Point not found: ${expected.asks}`);
      continue;
    }
    const [point] = unused.splice(index, 1);
    pointsFound++;
    const wrongDocument = expected.document && point!.document?.fileName !== expected.document;
    if (point!.status === expected.status && !wrongDocument) {
      decisionsRight++;
    } else {
      misses.push(
        `Wrong decision: ${expected.asks}. Expected ${expected.status}${expected.document ? ` (${expected.document})` : ""}, ` +
          `got ${point!.status}${point!.document ? ` (${point!.document.fileName})` : ""}. Agent's reason: ${point!.reason}`,
      );
    }
  }
  for (const point of unused) misses.push(`Extra point: ${point.asksFor} (${point.status})`);
  return { pointsFound, decisionsRight, extra: unused.length, misses };
}

const only = process.argv.slice(2);
const answers = readdirSync(join(ROOT, "letters"))
  .flatMap((code) =>
    readdirSync(join(ROOT, "letters", code))
      .filter((file) => file.endsWith("-answer.json"))
      .map((file) => JSON.parse(readFileSync(join(ROOT, "letters", code, file), "utf8")) as Answer),
  )
  .filter(({ letter }) => only.length === 0 || only.includes(letter))
  .sort((a, b) => a.letter.localeCompare(b.letter));

const patientIds = await loadPatients();
for (const code of new Set(answers.map(({ patient }) => patient))) await loadLocker(code, patientIds.get(code)!);

const totals = { expected: 0, pointsFound: 0, decisionsRight: 0, extra: 0 };
const missLines: string[] = [];
console.log("| Letter | Patient | Case | Points found | Decisions right | Extra |\n|---|---|---|---|---|---|");
for (const answer of answers) {
  const found = await runLetter(answer, patientIds.get(answer.patient)!);
  const result = score(answer, found);
  const expected = answer.points.length;
  console.log(
    `| ${answer.letter} | ${answer.patient} | ${answer.case} | ${result.pointsFound}/${expected} | ${result.decisionsRight}/${expected} | ${result.extra} |`,
  );
  totals.expected += expected;
  totals.pointsFound += result.pointsFound;
  totals.decisionsRight += result.decisionsRight;
  totals.extra += result.extra;
  missLines.push(...result.misses.map((miss) => `- ${answer.letter} ${answer.patient}: ${miss}`));
}

const percent = (value: number) => `${Math.round((value / Math.max(totals.expected, 1)) * 100)}%`;
console.log(`\nPoints found: ${totals.pointsFound}/${totals.expected} (${percent(totals.pointsFound)})`);
console.log(`Decisions right: ${totals.decisionsRight}/${totals.expected} (${percent(totals.decisionsRight)})`);
console.log(`Extra points: ${totals.extra}`);
console.log(`\nMisses: ${missLines.length}`);
console.log(missLines.join("\n"));
console.log(`\nOpenAI calls: ${aiCalls}, tokens: ${aiTokens}, model: ${process.env.OPENAI_MODEL}`);
process.exit(0);

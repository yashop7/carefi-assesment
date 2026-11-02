import { randomUUID } from "node:crypto";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Room for the multipart wrapper around the file.
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;

const SIGNATURES = [
  { mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  {
    mimeType: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

// Judged from the content, so a renamed file can't get through.
export function detectFileType(content: Uint8Array) {
  return SIGNATURES.find(({ bytes }) =>
    bytes.every((byte, index) => content[index] === byte),
  )?.mimeType;
}

export function cleanFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "document";
}

export function newStorageKey(patientId: string, folder = "documents") {
  return `patients/${patientId}/${folder}/${randomUUID()}`;
}

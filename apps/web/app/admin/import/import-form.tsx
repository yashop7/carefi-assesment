"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CsvResult = {
  added: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

type FileResult = {
  path: string;
  state: "uploading" | "done" | "failed";
  message?: string;
};

export function ImportForm({ patients }: { patients: { id: string; patientCode: string }[] }) {
  const router = useRouter();
  const [csvPending, setCsvPending] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null);
  const [files, setFiles] = useState<FileResult[]>([]);

  async function importCsv(file: File) {
    setCsvPending(true);
    setCsvError(null);
    setCsvResult(null);
    const response = await fetch("/api/import/patients", { method: "POST", body: file }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (response?.ok) {
      setCsvResult(result);
      router.refresh();
    } else {
      setCsvError(result?.error ?? "Could not import this file. Please try again");
    }
    setCsvPending(false);
  }

  // The folder holding a file names its patient: <patientCode>/<anything>.
  function findPatient(path: string) {
    const folders = path.split("/").slice(0, -1).map((folder) => folder.trim().toUpperCase());
    return patients.find((patient) => folders.includes(patient.patientCode));
  }

  async function uploadFolder(chosen: File[]) {
    const visible = chosen.filter((file) => !file.name.startsWith("."));
    const paths = visible.map((file) => file.webkitRelativePath || file.name);
    setFiles(paths.map((path) => ({ path, state: "uploading" })));
    const update = (index: number, change: Partial<FileResult>) =>
      setFiles((all) => all.map((file, i) => (i === index ? { ...file, ...change } : file)));

    for (const [index, file] of visible.entries()) {
      const patient = findPatient(paths[index] ?? "");
      if (!patient) {
        update(index, { state: "failed", message: "No patient with this folder's ID" });
        continue;
      }
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/patients/${patient.id}/documents`, { method: "POST", body }).catch(() => null);
      if (response?.ok) {
        update(index, { state: "done" });
        router.refresh();
      } else {
        const result = await response?.json().catch(() => null);
        update(index, { state: "failed", message: result?.error ?? "Could not upload this file" });
      }
    }
  }

  return (
    <div className="import-steps">
      <section>
        <h2>1. Patients</h2>
        <p className="muted">
          A CSV with the columns patientCode, name, phone, email, policyNumber, claimNumber. Phone numbers need their
          country code, like +919876543210.
        </p>
        <label className="dropzone">
          <input
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            disabled={csvPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv(file);
              event.target.value = "";
            }}
          />
          <strong>{csvPending ? "Importing…" : "Choose a CSV file"}</strong>
        </label>
        {csvError && <p className="field-error" role="alert">{csvError}</p>}
        {csvResult && (
          <div aria-live="polite">
            <p>
              {csvResult.added} added, {csvResult.skipped} already there, {csvResult.errors.length} with problems.
            </p>
            {csvResult.errors.length > 0 && (
              <ul className="upload-results">
                {csvResult.errors.map((error) => (
                  <li key={error.row}>
                    <span>Row {error.row}</span>
                    <span className="field-error">{error.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section>
        <h2>2. Documents</h2>
        <p className="muted">
          A folder with one folder per patient, named with the patient ID, like PAT-001/discharge.pdf. Query letters go
          on the patient&apos;s page, not here, because that starts the agent.
        </p>
        <label className="dropzone">
          <input
            className="visually-hidden"
            type="file"
            multiple
            {...{ webkitdirectory: "" }}
            onChange={(event) => {
              uploadFolder(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <strong>Choose a folder</strong>
          <span className="muted">PDF, JPG or PNG, up to 20 MB each</span>
        </label>
        {files.length > 0 && (
          <ul className="upload-results" aria-live="polite">
            {files.map((file) => (
              <li key={file.path}>
                <span className="truncate">{file.path}</span>
                {file.state === "uploading" && <span className="badge">Waiting</span>}
                {file.state === "done" && <span className="badge badge-good">Uploaded</span>}
                {file.state === "failed" && <span className="field-error">{file.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

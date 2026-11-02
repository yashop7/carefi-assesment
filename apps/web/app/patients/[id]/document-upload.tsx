"use client";

import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";

type Result = {
  key: number;
  name: string;
  state: "uploading" | "done" | "failed";
  message?: string;
};

export function DocumentUpload({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadFiles(files: File[]) {
    let key = Date.now();
    for (const file of files) {
      const current = key++;
      const update = (change: Partial<Result>) =>
        setResults((all) =>
          all.map((result) => (result.key === current ? { ...result, ...change } : result)),
        );
      setResults((all) => [{ key: current, name: file.name, state: "uploading" }, ...all]);

      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/patients/${patientId}/documents`, {
        method: "POST",
        body,
      }).catch(() => null);

      if (response?.ok) {
        update({ state: "done" });
        router.refresh();
      } else {
        const result = await response?.json().catch(() => null);
        update({
          state: "failed",
          message: result?.error ?? "Could not upload this file. Please try again",
        });
      }
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div>
      <label
        className={dragging ? "dropzone dropzone-active" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          className="visually-hidden"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => {
            uploadFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <strong>Drop documents here, or click to choose</strong>
        <span className="muted">PDF, JPG or PNG, up to 20 MB each</span>
      </label>
      {results.length > 0 && (
        <ul className="upload-results" aria-live="polite">
          {results.map((result) => (
            <li key={result.key}>
              <span className="truncate">{result.name}</span>
              {result.state === "uploading" && <span className="badge">Uploading</span>}
              {result.state === "done" && <span className="badge badge-good">Uploaded</span>}
              {result.state === "failed" && <span className="field-error">{result.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

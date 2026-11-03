"use client";

import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";

export function QueryDrop({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    setError("");

    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`/api/patients/${patientId}/queries`, {
      method: "POST",
      body,
    }).catch(() => null);
    const result = await response?.json().catch(() => null);

    if (response?.ok) {
      router.push(`/patients/${patientId}/queries/${result.query.id}`);
    } else {
      setError(result?.error ?? "Could not upload this letter. Please try again");
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    upload(event.dataTransfer.files[0]);
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
          accept="application/pdf,image/jpeg,image/png"
          disabled={uploading}
          onChange={(event) => {
            upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <strong>{uploading ? "Uploading…" : "Drop a query letter here, or click to choose"}</strong>
        <span className="muted">PDF, JPG or PNG, up to 20 MB. The rest happens automatically.</span>
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

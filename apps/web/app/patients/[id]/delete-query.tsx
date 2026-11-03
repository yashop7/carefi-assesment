"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteQuery({ queryId, patientId }: { queryId: string; patientId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/queries/${queryId}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) {
      router.push(`/patients/${patientId}?tab=queries`);
      router.refresh();
    } else {
      setError("Could not delete. Please try again");
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="link-button link-button-danger" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }

  return (
    <span className="status-cell">
      <button type="button" className="link-button link-button-danger" disabled={pending} onClick={remove}>
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" className="link-button" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {error && <span className="field-error">{error}</span>}
    </span>
  );
}

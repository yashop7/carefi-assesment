"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AssignPatient({
  userId,
  patients,
}: {
  userId: string;
  patients: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patientId) return;
    setPending(true);
    setError(null);
    const response = await fetch(`/api/users/${userId}/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId }),
    }).catch(() => null);
    if (response?.ok) {
      setPatientId("");
      router.refresh();
    } else {
      setError("Could not assign. Please try again");
    }
    setPending(false);
  }

  return (
    <form className="assign-form" onSubmit={onSubmit}>
      <select
        aria-label="Patient to assign"
        value={patientId}
        onChange={(event) => setPatientId(event.target.value)}
      >
        <option value="">Choose a patient</option>
        {patients.map(({ id, label }) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>
      <button type="submit" className="button button-quiet" disabled={pending || !patientId}>
        Assign
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </form>
  );
}

export function RemoveAssignment({ userId, patientId }: { userId: string; patientId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setPending(true);
    setFailed(false);
    const response = await fetch(`/api/users/${userId}/patients/${patientId}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) router.refresh();
    else setFailed(true);
    setPending(false);
  }

  return (
    <>
      <button type="button" className="link-button link-button-danger" disabled={pending} onClick={remove}>
        Remove
      </button>
      {failed && <span className="field-error" role="alert">Could not remove</span>}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Option = { id: string; label: string };

export function AccountForm({ lockers }: { lockers: Option[] }) {
  const router = useRouter();
  const [role, setRole] = useState("agent");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    }).catch(() => null);
    if (response?.ok) {
      form.reset();
      setRole("agent");
      router.refresh();
    } else {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Could not add the account. Please try again");
    }
    setPending(false);
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <label className="field">
        <span>Role</span>
        <select name="role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="agent">Agent</option>
          <option value="patient">Patient</option>
        </select>
      </label>
      {role === "patient" && (
        <label className="field">
          <span>Locker</span>
          <select name="patientId" defaultValue="">
            <option value="" disabled>Choose a patient</option>
            {lockers.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>Name</span>
        <input name="name" autoComplete="off" />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="off" />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" />
        <small className="muted">At least 12 characters. Share it with this person directly.</small>
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Adding…" : "Add account"}
        </button>
      </div>
    </form>
  );
}

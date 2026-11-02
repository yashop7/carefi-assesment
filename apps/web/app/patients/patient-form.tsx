"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type PatientValues = {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email: string;
  policyNumber: string | null;
  claimNumber: string | null;
};

function Field({
  label,
  name,
  defaultValue,
  error,
  hint,
  required,
  type = "text",
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <label className="field">
      <span>
        {label}
        {!required && !disabled && <span className="muted"> (optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && !error && <small id={`${name}-hint`} className="muted">{hint}</small>}
      {error && <small id={`${name}-error`} className="field-error">{error}</small>}
    </label>
  );
}

export function PatientForm({ patient }: { patient?: PatientValues }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);

    const response = await fetch(
      patient ? `/api/patients/${patient.id}` : "/api/patients",
      {
        method: patient ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      },
    ).catch(() => null);
    const result = await response?.json().catch(() => null);

    if (!response?.ok) {
      setErrors(result?.fields ?? {});
      setFormError(result?.error ?? "Something went wrong. Please try again");
      setPending(false);
      return;
    }
    router.push(`/patients/${result.patient.id}`);
    router.refresh();
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field label="Patient ID" name="patientCode" defaultValue={patient?.patientCode} error={errors.patientCode} hint={patient ? "A patient ID can't be changed" : "For example PAT-001"} required disabled={Boolean(patient)} />
      <Field label="Full name" name="name" defaultValue={patient?.name} error={errors.name} required />
      <Field label="Phone" name="phone" type="tel" defaultValue={patient?.phone} error={errors.phone} hint="With country code, like +91 98765 43210. WhatsApp messages go here" required />
      <Field label="Email" name="email" type="email" defaultValue={patient?.email} error={errors.email} required />
      <Field label="Policy number" name="policyNumber" defaultValue={patient?.policyNumber} error={errors.policyNumber} />
      <Field label="Claim number" name="claimNumber" defaultValue={patient?.claimNumber} error={errors.claimNumber} hint="Messages to the patient quote this" />
      {formError && <p className="field-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : patient ? "Save changes" : "Add patient"}
        </button>
        <Link className="button button-quiet" href={patient ? `/patients/${patient.id}` : "/patients"}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

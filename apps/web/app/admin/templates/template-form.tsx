"use client";

import { useState, type FormEvent } from "react";
import { fillTemplate, SAMPLE_VALUES } from "@/lib/messaging/template";

export function TemplateForm({
  channel,
  title,
  initialBody,
  initialSubject,
}: {
  channel: "whatsapp" | "email";
  title: string;
  initialBody: string;
  initialSubject?: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/templates/${channel}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    }).catch(() => null);
    if (response?.ok) {
      setSaved(true);
    } else {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Could not save. Please try again");
    }
    setPending(false);
  }

  return (
    <section className="template-editor">
      <h2>{title}</h2>
      <div className="template-columns">
        <form className="form" onSubmit={onSubmit} noValidate>
          {channel === "email" && (
            <label className="field">
              <span>Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Message</span>
            <textarea rows={12} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            {saved && <span className="badge badge-good" role="status">Saved</span>}
          </div>
        </form>
        <div className="message">
          <strong>Preview</strong>
          {channel === "email" && <pre>{fillTemplate(subject, SAMPLE_VALUES) ?? subject}</pre>}
          <pre>{fillTemplate(body, SAMPLE_VALUES) ?? body}</pre>
        </div>
      </div>
    </section>
  );
}

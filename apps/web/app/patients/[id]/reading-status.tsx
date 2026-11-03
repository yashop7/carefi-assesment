"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RefreshWhileReading() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}

export function ActionButton({ url, label = "Try again" }: { url: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    const response = await fetch(url, { method: "POST" }).catch(() => null);
    if (response?.ok) {
      router.refresh();
    } else {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "That didn't work. Please try again");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" className="link-button" disabled={pending} onClick={run}>
        {label}
      </button>
      {error && <span className="field-error" role="alert">{error}</span>}
    </>
  );
}

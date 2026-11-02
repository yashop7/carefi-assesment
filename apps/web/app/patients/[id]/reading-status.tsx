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

export function RetryButton({ url }: { url: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retry() {
    setPending(true);
    await fetch(url, { method: "POST" }).catch(() => null);
    router.refresh();
    setPending(false);
  }

  return (
    <button type="button" className="link-button" disabled={pending} onClick={retry}>
      Try again
    </button>
  );
}

"use client";

export default function PatientsError({ reset }: { reset: () => void }) {
  return (
    <div className="empty" role="alert">
      <h1>Something went wrong</h1>
      <p>We couldn&apos;t load this page. Please try again.</p>
      <button type="button" className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}

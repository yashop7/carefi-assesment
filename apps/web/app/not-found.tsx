import Link from "next/link";

export default function NotFound() {
  return (
    <main className="panel">
      <h1>Page not found</h1>
      <p>This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link className="text-link" href="/">
        Go to the home page
      </Link>
    </main>
  );
}

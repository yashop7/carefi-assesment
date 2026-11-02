import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="panel">
      <h1>CareFi Patient Locker</h1>
      <p>{session.user.email}</p>
      <p>Role: {session.user.role}</p>
      <SignOutButton />
    </main>
  );
}

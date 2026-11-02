import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/access";
import { SignOutButton } from "../sign-out-button";

// Only for the header. A layout doesn't rerun between pages, so each page
// makes its own access check.
export default async function PatientsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="portal">
      <header className="portal-header">
        <Link className="portal-brand" href="/">
          CareFi Patient Locker
        </Link>
        <div className="portal-user">
          <span>
            {user.email} <span className="badge">{user.role}</span>
          </span>
          <SignOutButton className="button button-quiet" />
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}

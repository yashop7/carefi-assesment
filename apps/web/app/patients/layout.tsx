import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/access";
import { Avatar } from "../avatar";
import { BrandMark } from "../brand-mark";
import { SignOutButton } from "../sign-out-button";
import { NavLinks } from "./nav-links";

// Only for the sidebar. A layout doesn't rerun between pages, so each page
// makes its own access check.
export default async function PatientsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="portal">
      <aside className="portal-side">
        <Link className="portal-brand" href="/">
          <BrandMark />
          CareFi Locker
        </Link>
        <NavLinks role={user.role} />
        <div className="portal-user">
          <Avatar name={user.email} />
          <div className="portal-user-name">
            <span className="truncate" title={user.email}>{user.email}</span>
            <span className="muted">{user.role}</span>
          </div>
          <SignOutButton className="link-button link-button-quiet" />
        </div>
      </aside>
      <main className="portal-main">{children}</main>
    </div>
  );
}

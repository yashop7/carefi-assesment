"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const ICONS = {
  patients: "M16 19v-1a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v1M9.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a3 3 0 0 0-2.3-2.9M15.5 5.1a3 3 0 0 1 0 5.8",
  queue: "M4 13h4l2 3h4l2-3h4M6.5 5h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5L6.5 5Z",
  accounts: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
  templates: "M4 6h16v12H4V6Zm0 1 8 6 8-6",
  import: "M12 4v11M7.5 10.5 12 15l4.5-4.5M4 20h16",
  log: "M12 3 5 6v5.5c0 4.2 2.8 7.7 7 9.5 4.2-1.8 7-5.3 7-9.5V6l-7-3ZM9 12l2 2 4-4",
  locker: "M4 8h16v11H4V8Zm0 0 2-3h12l2 3M10 12h4",
};

const LINKS = [
  { href: "/patients", label: "Patients", icon: ICONS.patients, roles: ["admin", "agent"] },
  { href: "/queue", label: "Team queue", icon: ICONS.queue, roles: ["admin", "agent"] },
  { href: "/admin/users", label: "Accounts", icon: ICONS.accounts, roles: ["admin"] },
  { href: "/admin/templates", label: "Templates", icon: ICONS.templates, roles: ["admin"] },
  { href: "/admin/import", label: "Import", icon: ICONS.import, roles: ["admin"] },
  { href: "/admin/access-log", label: "Access log", icon: ICONS.log, roles: ["admin"] },
  { href: "/", label: "My locker", icon: ICONS.locker, roles: ["patient"] },
];

export function NavLinks({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <nav className="portal-nav" aria-label="Main">
      {LINKS.filter(({ roles }) => roles.includes(role)).map(({ href, label, icon }) => {
        const current = pathname.startsWith(href) || (href === "/" && pathname.startsWith("/patients"));
        return (
          <Fragment key={href}>
            {href === "/admin/users" && <span className="nav-label">Admin</span>}
            <Link href={href} className="nav-link" aria-current={current ? "page" : undefined}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={icon} />
              </svg>
              {label}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}

import { db } from "db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, orNotFound, requireAdmin } from "@/lib/access";
import { accessActionLabel, formatDate } from "@/lib/format";
import { listAccounts } from "@/lib/users";

export default async function AccessLogPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await orNotFound(requireAdmin(user));

  const deniedOnly = (await searchParams).view === "denied";
  const logs = db.orm.public.AccessLog.include("patient", (patient) => patient.select("patientCode"))
    .orderBy((log) => log.createdAt.desc())
    .limit(200);
  const rows = await (deniedOnly ? logs.where({ action: "denied" }) : logs).all();

  const accounts = await listAccounts();
  const emails = new Map(accounts.map((account) => [account.id, account.email]));

  return (
    <>
      <Link className="back-link" href="/patients">
        Back to patients
      </Link>
      <div className="page-title">
        <h1>Access log</h1>
      </div>
      <nav className="tabs" aria-label="Log view">
        <Link href="/admin/access-log" className={deniedOnly ? "tab" : "tab tab-active"}>
          All
        </Link>
        <Link href="/admin/access-log?view=denied" className={deniedOnly ? "tab tab-active" : "tab"}>
          Denied only
        </Link>
      </nav>
      {rows.length === 0 ? (
        <div className="empty">
          <p>Nothing logged yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Person</th>
                <th scope="col">Action</th>
                <th scope="col">Patient ID</th>
                <th scope="col">Item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{emails.get(row.userId) ?? row.userId}</td>
                  <td>
                    <span className={row.action === "denied" ? "badge badge-warn" : "badge"}>
                      {accessActionLabel(row.action)}
                    </span>
                  </td>
                  <td className="mono">{row.patient?.patientCode ?? "—"}</td>
                  <td className="mono">{row.resourceId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

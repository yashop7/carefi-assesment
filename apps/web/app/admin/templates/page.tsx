import { db } from "db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/access";
import { TemplateForm } from "./template-form";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const whatsapp = await db.orm.public.Template.first({ channel: "whatsapp" });
  const email = await db.orm.public.Template.first({ channel: "email" });

  return (
    <>
      <Link className="back-link" href="/patients">
        Back to patients
      </Link>
      <div className="page-title">
        <h1>Message templates</h1>
      </div>
      <p className="muted">
        You can use {"{{patient_name}}"}, {"{{patient_id}}"}, {"{{claim_number}}"} and {"{{requested_items}}"}. Changes
        apply to the next message, not to ones already made.
      </p>
      {whatsapp && <TemplateForm channel="whatsapp" title="WhatsApp" initialBody={whatsapp.body} />}
      {email && (
        <TemplateForm channel="email" title="Email" initialBody={email.body} initialSubject={email.subject ?? ""} />
      )}
    </>
  );
}

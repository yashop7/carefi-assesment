import { db } from "db";
import { z } from "zod";
import { auth } from "./auth";

export const newAccountSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  name: z.string().trim().min(1, "Enter a name").max(100),
  password: z.string().min(12, "Use at least 12 characters").max(128),
  role: z.enum(["agent", "patient"]),
  patientId: z.string().nullish(),
});

export async function listAccounts() {
  const ctx = await auth.$context;
  const users = await ctx.internalAdapter.listUsers(1000);
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: (user as { role?: string | null }).role ?? "",
  }));
}

export async function findAccount(id: string) {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.findUserById(id);
  return user ? { id: user.id, role: (user as { role?: string | null }).role ?? "" } : null;
}

export async function emailInUse(email: string) {
  const ctx = await auth.$context;
  return (await ctx.internalAdapter.findUserByEmail(email)) !== null;
}

export async function createAccount(
  account: Pick<z.infer<typeof newAccountSchema>, "email" | "name" | "password" | "role">,
) {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: account.email, name: account.name, emailVerified: true, role: account.role },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    providerId: "credential",
    accountId: user.id,
    userId: user.id,
    password: await ctx.password.hash(account.password),
  });
  return user.id;
}

export async function linkPatientAccount(userId: string, patientId: string) {
  await db.orm.public.Patient.where({ id: patientId }).update({ userId });
}

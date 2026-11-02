import { auth } from "../lib/auth";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error("Set ADMIN_EMAIL, and ADMIN_PASSWORD with at least 12 characters");
  process.exit(1);
}

const ctx = await auth.$context;
if (await ctx.internalAdapter.findUserByEmail(email)) {
  console.log("Admin already exists");
  process.exit(0);
}

const user = await ctx.internalAdapter.createUser(
  { email, name: "Admin", emailVerified: true, role: "admin" },
  { method: "admin" },
);
await ctx.internalAdapter.linkAccount({
  providerId: "credential",
  accountId: user.id,
  userId: user.id,
  password: await ctx.password.hash(password),
});
console.log("Admin created");
process.exit(0);

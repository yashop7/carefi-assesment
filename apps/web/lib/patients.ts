import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(100)
  .nullish()
  .transform((value) => value || null);

export const patientUpdateSchema = z.object({
  name: z.string().trim().min(1, "Enter the patient's name").max(200),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/, "Include the country code, like +91 98765 43210"),
    ),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  policyNumber: optionalText,
  claimNumber: optionalText,
});

export const newPatientSchema = patientUpdateSchema.extend({
  patientCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,32}$/, "Use letters, numbers and dashes, like PAT-001"),
});

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

export function publicPatient(patient: {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email: string;
  policyNumber: string | null;
  claimNumber: string | null;
}) {
  const { id, patientCode, name, phone, email, policyNumber, claimNumber } = patient;
  return { id, patientCode, name, phone, email, policyNumber, claimNumber };
}

import { AccessDeniedError, NotLoggedInError } from "./access";

export function apiError(status: number, error: string, extra?: object) {
  return Response.json({ error, ...extra }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof NotLoggedInError) return apiError(401, "Please log in");
  if (error instanceof AccessDeniedError) return apiError(404, "Not found");
  // Only the name: messages can contain patient data or connection details.
  console.error("Request failed:", error instanceof Error ? error.name : "unknown");
  return apiError(503, "Something went wrong. Please try again");
}

export function isForeignOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    origin !== null &&
    origin !== new URL(process.env.BETTER_AUTH_URL ?? request.url).origin
  );
}

export function isUniqueViolation(error: unknown) {
  return (error as { sqlState?: string } | null)?.sqlState === "23505";
}

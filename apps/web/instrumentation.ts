export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumeUnreadDocuments } = await import("./lib/documents");
  resumeUnreadDocuments().catch((error) => {
    console.error("Resume failed:", error instanceof Error ? error.name : "unknown");
  });
}

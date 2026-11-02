export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumeUnreadDocuments } = await import("./lib/documents");
  const { resumeUnfinishedLetters } = await import("./lib/agent/graph");
  const logFailure = (error: unknown) => {
    console.error("Resume failed:", error instanceof Error ? error.name : "unknown");
  };
  resumeUnreadDocuments().catch(logFailure);
  resumeUnfinishedLetters().catch(logFailure);
}

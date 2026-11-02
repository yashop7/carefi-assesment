import { END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { db } from "db";
import {
  addToTeamQueue,
  alertTeam,
  buildMessage,
  checkLocker,
  extractPoints,
  finish,
  routeAfterTeam,
  routeDelivery,
  routeResults,
  safetyChecks,
  sendMessages,
  State,
} from "./nodes";

const workflow = new StateGraph(State)
  .addNode("extractPoints", extractPoints, { retryPolicy: { maxAttempts: 3 } })
  .addNode("checkLocker", checkLocker, { retryPolicy: { maxAttempts: 3 } })
  .addNode("safetyChecks", safetyChecks)
  .addNode("addToTeamQueue", addToTeamQueue)
  .addNode("buildMessage", buildMessage)
  .addNode("sendMessages", sendMessages)
  .addNode("alertTeam", alertTeam)
  .addNode("finish", finish)
  .addEdge(START, "extractPoints")
  .addEdge("extractPoints", "checkLocker")
  .addEdge("checkLocker", "safetyChecks")
  .addConditionalEdges("safetyChecks", routeResults, ["addToTeamQueue", "buildMessage", "finish"])
  .addConditionalEdges("addToTeamQueue", routeAfterTeam, ["buildMessage", "finish"])
  .addEdge("buildMessage", "sendMessages")
  .addConditionalEdges("sendMessages", routeDelivery, ["sendMessages", "alertTeam", "finish"])
  .addEdge("alertTeam", END)
  .addEdge("finish", END);

async function connect() {
  // Its own schema, because Prisma plans to drop unknown tables in `public`.
  const saver = PostgresSaver.fromConnString(process.env.DATABASE_URL!, { schema: "langgraph" });
  await saver.setup();
  return workflow.compile({ checkpointer: saver });
}

// Connects on first use, because the build runs with no variables.
let graph: ReturnType<typeof connect> | undefined;

function getGraph() {
  graph ??= connect().catch((error) => {
    graph = undefined;
    throw error;
  });
  return graph;
}

export async function runAgent(queryLetterId: string) {
  // The letter's id ties saved progress to this letter.
  const config = { configurable: { thread_id: queryLetterId } };
  try {
    await db.orm.public.QueryLetter.where({ id: queryLetterId })
      .where((letter) => letter.startedAt.isNull())
      .update({ startedAt: new Date().toISOString() });

    const agent = await getGraph();
    const saved = await agent.getState(config);
    // A run with a saved next step carries on from there, not from the top.
    await agent.invoke(saved.next.length > 0 ? null : { queryLetterId }, config);
  } catch (error) {
    // Only the name: messages can contain letter contents.
    console.error("Agent failed:", error instanceof Error ? error.name : "unknown");
    await db.orm.public.QueryLetter.where({ id: queryLetterId })
      .update({
        status: "failed",
        errorMessage: "The letter could not be processed.",
      })
      .catch(() => undefined);
  }
}

// A restart can leave letters part way through, so each one carries on.
export async function resumeUnfinishedLetters() {
  const letters = await db.orm.public.QueryLetter.where((letter) =>
    letter.status.in(["uploaded", "reading", "checking_locker", "sending"]),
  )
    .select("id")
    .limit(500)
    .all();
  for (const letter of letters) await runAgent(letter.id);
}

import { findLatestRun } from "@/lib/sync/run";
import { importTcgApiCatalog } from "@/lib/sync/tcgapi-catalog";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const gameId = args.find((a) => !a.startsWith("--"));
  const flag = args.indexOf("--max-requests");
  const maxRequests = flag === -1 ? undefined : Number(args[flag + 1]);
  const onlyIfIncomplete = args.includes("--only-if-incomplete");
  if (!gameId || (maxRequests !== undefined && !(Number.isInteger(maxRequests) && maxRequests > 0))) {
    console.error("Usage: pnpm sync:catalog <gameId> [--max-requests N] [--only-if-incomplete]");
    process.exit(2);
  }
  return { gameId, maxRequests, onlyIfIncomplete };
}

// An async main() rather than top-level await: tsx compiles this file as CJS.
async function main() {
  const { gameId, maxRequests, onlyIfIncomplete } = parseArgs(process.argv);

  // Lets a scheduled job keep continuing a multi-day import and stop once it's done,
  // instead of starting a fresh full re-import the day after it succeeds.
  if (onlyIfIncomplete) {
    const latest = await findLatestRun("tcgapi", `catalog:${gameId}`);
    if (latest?.status === "succeeded") {
      console.log(JSON.stringify({ gameId, skipped: true, reason: "catalog already complete" }));
      return;
    }
  }

  const summary = await importTcgApiCatalog({ gameId, maxRequests });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

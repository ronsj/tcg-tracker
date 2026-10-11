import { refreshTrackedJustTcg } from "@/lib/sync/justtcg-tracked";
import { refreshTrackedTcgApi } from "@/lib/sync/tcgapi-tracked";
import { justTcgShare, remainingBudget } from "@/lib/sync/tracked-utils";

const DEFAULT_MAX_REQUESTS = 40;
const SOURCES = ["justtcg", "tcgapi"] as const;
type Source = (typeof SOURCES)[number];

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const maxFlag = args.indexOf("--max-requests");
  const maxRequests = maxFlag === -1 ? DEFAULT_MAX_REQUESTS : Number(args[maxFlag + 1]);
  const sourceFlag = args.indexOf("--source");
  const source = sourceFlag === -1 ? undefined : args[sourceFlag + 1];
  if (
    !(Number.isInteger(maxRequests) && maxRequests > 0) ||
    (source !== undefined && !SOURCES.includes(source as Source))
  ) {
    console.error("Usage: pnpm sync:prices [--max-requests N] [--source justtcg|tcgapi]");
    process.exit(2);
  }
  return { maxRequests, source: source as Source | undefined };
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

// An async main() rather than top-level await: tsx compiles this file as CJS.
async function main() {
  const { maxRequests, source } = parseArgs(process.argv);
  const summary: Record<string, unknown> = {};
  let failed = false;

  // Each source reports its own failure so one outage doesn't skip the other.
  let justtcgUsed = 0;
  if (!source || source === "justtcg") {
    try {
      const res = await refreshTrackedJustTcg({ maxRequests: source ? maxRequests : justTcgShare(maxRequests) });
      justtcgUsed = res.requestsUsed;
      failed ||= res.status === "failed";
      summary.justtcg = res;
    } catch (err) {
      failed = true;
      summary.justtcg = { error: message(err) };
    }
  }

  if (!source || source === "tcgapi") {
    const budget = remainingBudget(maxRequests, justtcgUsed);
    try {
      const games = budget > 0 ? await refreshTrackedTcgApi({ maxRequests: budget }) : [];
      failed ||= games.some((g) => "error" in g || g.summary.status === "failed");
      summary.tcgapi = games;
    } catch (err) {
      failed = true;
      summary.tcgapi = { error: message(err) };
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

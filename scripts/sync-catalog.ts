import { importTcgApiCatalog } from "@/lib/sync/tcgapi-catalog";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const gameId = args.find((a) => !a.startsWith("--"));
  const flag = args.indexOf("--max-requests");
  const maxRequests = flag === -1 ? undefined : Number(args[flag + 1]);
  if (!gameId || (maxRequests !== undefined && !(Number.isInteger(maxRequests) && maxRequests > 0))) {
    console.error("Usage: pnpm sync:catalog <gameId> [--max-requests N]");
    process.exit(2);
  }
  return { gameId, maxRequests };
}

// An async main() rather than top-level await: tsx compiles this file as CJS.
async function main() {
  const { gameId, maxRequests } = parseArgs(process.argv);
  const summary = await importTcgApiCatalog({ gameId, maxRequests });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

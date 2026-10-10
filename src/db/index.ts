import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// The HTTP driver suits serverless route handlers and cron jobs (one round trip per query).
// If you need interactive transactions, switch to `drizzle-orm/neon-serverless` (WebSocket Pool).
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema, casing: "snake_case" });

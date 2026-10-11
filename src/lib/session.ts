import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";

/** The current session, or null when signed out. Request-time: call inside Suspense. */
export async function getSession() {
  // Stops the prerender pass here, before Better Auth touches the DB or `new Date()`.
  await connection();
  return auth.api.getSession({ headers: await headers() });
}

/** The current session; redirects to /sign-in when signed out. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** The current session, or null when signed out. Request-time: call inside Suspense. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** The current session; redirects to /sign-in when signed out. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

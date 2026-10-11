const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Integer cents → "$2.79". */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return usd.format(cents / 100);
}

/** Percent change with an explicit sign: "+5.3%" / "−1.8%". */
export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.abs(n).toFixed(1);
  if (Number(rounded) === 0) return "0.0%";
  return `${n > 0 ? "+" : "−"}${rounded}%`;
}

/** "Oct 11, 2026". Date-only strings ("2026-10-11") are shown as that calendar day. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

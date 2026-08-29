/**
 * Formats a single numeric currency value while leaving descriptive values and
 * ranges untouched. For example, "$10,545 - $11,995" must remain a range
 * rather than being truncated to its first number by parseFloat.
 */
export function formatCurrency(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/[$,]/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return raw;

  const number = Number(normalized);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : raw;
}

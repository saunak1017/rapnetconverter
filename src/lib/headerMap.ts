// Normalize / display label tweaks. We keep the original key, but show a nicer label.
// Critical requirement: "Vendor Stock Number" -> "Stock ID"
export function displayLabelForHeader(header: string): string {
  const h = header.trim();

  if (h.toLowerCase() === "vendor stock number") return "Stock ID";
  if (h === "$/ct") return "$/ct";
  if (h.toLowerCase() === "%rap" || h === "%Rap") return "%Rap";

  // Title Case-ish for nicer look (keeps acronyms mostly)
  return h
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function makeSlug(len = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/I/1
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) {
    s += alphabet[bytes[i] % alphabet.length];
  }
  return s;
}

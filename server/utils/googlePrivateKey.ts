// Normalizes GOOGLE_PRIVATE_KEY however the env UI mangled it. OpenSSL 3
// (Node 18+) hard-fails with "error:1E08010C:DECODER routines::unsupported"
// on anything that isn't clean PEM, and each dashboard (Vercel, Trigger.dev)
// stores pasted multiline secrets differently. Accepts:
//   - raw multiline PEM
//   - single-line with literal \n escapes
//   - double-escaped \\n (some UIs re-escape on save)
//   - value wrapped in single or double quotes (copied from a .env file)
export function normalizeGooglePrivateKey(raw: string | undefined): string {
  let key = (raw ?? '').trim()
  // Strip one layer of wrapping quotes (".env"-style paste).
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  // \\n → \n → real newline. Order matters: collapse double escapes first.
  key = key.replace(/\\\\n/g, '\\n').replace(/\\n/g, '\n')
  // PEM parsers want a trailing newline after END line.
  if (!key.endsWith('\n')) key += '\n'
  return key
}

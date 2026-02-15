/** Strip markdown code fences and whitespace */
function stripFences(text) {
  return text
    .replace(/```[\w]*\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

/** Extract a single integer from a response */
export function parseInteger(response) {
  const cleaned = stripFences(response);
  const match = cleaned.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** Extract yes/no from a response */
export function parseYesNo(response) {
  const cleaned = stripFences(response).toLowerCase();
  if (cleaned.includes("yes")) return "yes";
  if (cleaned.includes("no")) return "no";
  return null;
}

/** Extract a SMILES string from a response */
export function parseSmiles(response) {
  const cleaned = stripFences(response);
  // Take the first line that looks like a SMILES (contains typical SMILES chars)
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^[A-Za-z0-9@+\-\[\]()=#$%./\\:]+$/.test(line)) {
      return line;
    }
  }
  // Fallback: return the entire cleaned string if short enough
  if (cleaned.length < 200 && !cleaned.includes(" ")) return cleaned;
  return null;
}

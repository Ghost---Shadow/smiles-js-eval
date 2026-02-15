/** Strip markdown code fences and whitespace */
function stripFences(text) {
  return text
    .replace(/```[\w]*\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

/** Extract a single integer from a response (takes the last standalone integer) */
export function parseInteger(response) {
  const cleaned = stripFences(response);
  // Find all standalone integers (not part of decimals or other patterns)
  const matches = [...cleaned.matchAll(/(?<!\.)(\b-?\d+\b)(?!\.)/g)];
  if (matches.length === 0) return null;
  return parseInt(matches[matches.length - 1][1], 10);
}

/** Extract yes/no from a response (checks last line first, then last occurrence) */
export function parseYesNo(response) {
  const cleaned = stripFences(response).toLowerCase();
  // Check the last non-empty line first (most likely the final answer)
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || "";
  if (/\byes\b/.test(lastLine)) return "yes";
  if (/\bno\b/.test(lastLine)) return "no";
  // Fallback: last occurrence in entire response
  const lastYes = cleaned.lastIndexOf("yes");
  const lastNo = cleaned.lastIndexOf("no");
  if (lastYes === -1 && lastNo === -1) return null;
  if (lastYes > lastNo) return "yes";
  return "no";
}

/** Extract a SMILES string from a response (takes the last SMILES-like string) */
export function parseSmiles(response) {
  const cleaned = stripFences(response);
  const smilesPattern = /[A-Za-z0-9@+\-\[\]()=#$%./\\:]{3,}/g;

  // Strategy 1: find all backtick-wrapped SMILES, take the last one
  const backtickMatches = [...cleaned.matchAll(/`([A-Za-z0-9@+\-\[\]()=#$%./\\:]{3,})`/g)];
  if (backtickMatches.length > 0) {
    return backtickMatches[backtickMatches.length - 1][1];
  }

  // Strategy 2: find standalone lines that look like SMILES, take the last one
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  let lastSmilesLine = null;
  for (const line of lines) {
    if (/^[A-Za-z0-9@+\-\[\]()=#$%./\\:]+$/.test(line)) {
      lastSmilesLine = line;
    }
  }
  if (lastSmilesLine) return lastSmilesLine;

  // Strategy 3: fallback — return the entire cleaned string if short enough
  if (cleaned.length < 200 && !cleaned.includes(" ")) return cleaned;
  return null;
}

/**
 * Programmatically corrupt a valid SMILES string.
 * Returns { corrupted, corruptionType } or null if no corruption could be applied.
 */
export function corruptSmiles(smiles) {
  const strategies = [
    removeRingClosure,
    unbalanceParens,
    removeAtom,
  ];

  // Shuffle strategies and try each
  const shuffled = strategies.sort(() => Math.random() - 0.5);
  for (const strategy of shuffled) {
    const result = strategy(smiles);
    if (result && result.corrupted !== smiles) return result;
  }
  return null;
}

function removeRingClosure(smiles) {
  // Find ring closure digits and remove the last one
  const ringDigits = [...smiles.matchAll(/(?<=[^%])(\d)/g)];
  if (ringDigits.length < 2) return null;
  const lastMatch = ringDigits[ringDigits.length - 1];
  const idx = lastMatch.index;
  const corrupted = smiles.slice(0, idx) + smiles.slice(idx + 1);
  return { corrupted, corruptionType: "missing_ring_closure" };
}

function unbalanceParens(smiles) {
  // Remove a closing paren
  const closeIdx = smiles.lastIndexOf(")");
  if (closeIdx === -1) return null;
  const corrupted = smiles.slice(0, closeIdx) + smiles.slice(closeIdx + 1);
  return { corrupted, corruptionType: "unbalanced_parens" };
}

function removeAtom(smiles) {
  // Remove a random non-bracket atom from the middle
  const atomPositions = [];
  for (let i = 1; i < smiles.length - 1; i++) {
    if (/[CNOScnos]/.test(smiles[i]) && smiles[i - 1] !== "[") {
      atomPositions.push(i);
    }
  }
  if (atomPositions.length === 0) return null;
  const idx = atomPositions[Math.floor(Math.random() * atomPositions.length)];
  const corrupted = smiles.slice(0, idx) + smiles.slice(idx + 1);
  return { corrupted, corruptionType: "missing_atom" };
}

/**
 * Corrupt smiles-js code representation.
 * Modifies constructor arguments to introduce errors.
 */
export function corruptCode(code) {
  const strategies = [
    corruptRingSize,
    removeLinearElement,
    removeAttachment,
  ];

  const shuffled = strategies.sort(() => Math.random() - 0.5);
  for (const strategy of shuffled) {
    const result = strategy(code);
    if (result && result.corrupted !== code) return result;
  }
  return null;
}

function corruptRingSize(code) {
  const match = code.match(/size:\s*(\d+)/);
  if (!match) return null;
  const origSize = parseInt(match[1]);
  const newSize = origSize === 6 ? 5 : origSize + 1;
  const corrupted = code.replace(/size:\s*\d+/, `size: ${newSize}`);
  return { corrupted, corruptionType: "wrong_ring_size" };
}

function removeLinearElement(code) {
  // Remove one element from a Linear array
  const match = code.match(/Linear\(\[([^\]]+)\]\)/);
  if (!match) return null;
  const elements = match[1].split(",").map((s) => s.trim());
  if (elements.length <= 1) return null;
  const removeIdx = Math.floor(Math.random() * elements.length);
  elements.splice(removeIdx, 1);
  const corrupted = code.replace(
    /Linear\(\[[^\]]+\]\)/,
    `Linear([${elements.join(", ")}])`,
  );
  return { corrupted, corruptionType: "missing_linear_element" };
}

function removeAttachment(code) {
  // Remove an .attach() call
  const match = code.match(/\.attach\([^)]+\)/);
  if (!match) return null;
  const corrupted = code.replace(/\.attach\([^)]+\)/, "");
  return { corrupted, corruptionType: "missing_attachment" };
}

import { parse } from "smiles-js";

/**
 * Convert a SMILES string to smiles-js constructor code.
 * Returns null if the SMILES cannot be parsed.
 */
export function smilesToCode(smiles) {
  try {
    const ast = parse(smiles);
    return ast.toCode("molecule");
  } catch {
    return null;
  }
}

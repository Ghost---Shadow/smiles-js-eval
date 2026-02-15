import { isValidSmiles, canonicalize } from "../data-prep/rdkit-utils.js";

/** Score SMILES repair results: validity rate + exact match to original. */
export async function smilesRepairMetrics(predictions, originals) {
  let valid = 0;
  let exactMatch = 0;

  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    if (!pred) continue;

    const isValid = await isValidSmiles(pred);
    if (isValid) {
      valid++;
      const canonical = await canonicalize(pred);
      const originalCanonical = await canonicalize(originals[i]);
      if (canonical === originalCanonical) exactMatch++;
    }
  }

  return {
    validityRate: valid / predictions.length,
    exactMatchRate: exactMatch / predictions.length,
    valid,
    exactMatch,
    total: predictions.length,
  };
}

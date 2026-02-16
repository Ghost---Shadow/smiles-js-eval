/**
 * F1 scorer for multi-label functional group detection.
 * Computes per-sample precision/recall/F1 and macro-averages.
 */

/**
 * Score functional group predictions against ground truth.
 * @param {Array<{parsed: string[]|null, groups: string[]}>} results - Array of { parsed, groups }
 * @returns {{ f1, precision, recall, accuracy, total, parseFailures, perGroup }}
 */
export function f1Score(results) {
  let totalPrecision = 0;
  let totalRecall = 0;
  let totalF1 = 0;
  let exactMatches = 0;
  let scored = 0;
  let parseFailures = 0;

  // Per-group TP/FP/FN tracking
  const perGroup = {};
  const allGroups = ["hydroxyl", "carboxyl", "amine", "amide", "ester", "ether", "nitro", "halide"];
  for (const g of allGroups) {
    perGroup[g] = { tp: 0, fp: 0, fn: 0 };
  }

  for (const r of results) {
    if (!r.parsed || !Array.isArray(r.parsed)) {
      parseFailures++;
      continue;
    }

    const truth = new Set(r.groups);
    const pred = new Set(r.parsed);

    // Per-group stats
    for (const g of allGroups) {
      if (truth.has(g) && pred.has(g)) perGroup[g].tp++;
      else if (!truth.has(g) && pred.has(g)) perGroup[g].fp++;
      else if (truth.has(g) && !pred.has(g)) perGroup[g].fn++;
    }

    // Per-sample metrics
    const tp = [...pred].filter((g) => truth.has(g)).length;
    const fp = [...pred].filter((g) => !truth.has(g)).length;
    const fn = [...truth].filter((g) => !pred.has(g)).length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    totalPrecision += precision;
    totalRecall += recall;
    totalF1 += f1;
    if (fp === 0 && fn === 0) exactMatches++;
    scored++;
  }

  return {
    f1: scored > 0 ? totalF1 / scored : 0,
    precision: scored > 0 ? totalPrecision / scored : 0,
    recall: scored > 0 ? totalRecall / scored : 0,
    exactMatch: scored > 0 ? exactMatches / scored : 0,
    total: results.length,
    scored,
    exactMatches,
    parseFailures,
    perGroup,
  };
}

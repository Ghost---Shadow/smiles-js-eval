/**
 * Compute AUC-ROC for binary yes/no predictions.
 * Since we only get hard labels (not probabilities), this is equivalent to
 * computing the balanced accuracy: (TPR + TNR) / 2
 */
export function binaryMetrics(predictions, groundTruths) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const truth = groundTruths[i];
    if (pred === "yes" && truth === "yes") tp++;
    else if (pred === "yes" && truth === "no") fp++;
    else if (pred === "no" && truth === "no") tn++;
    else if (pred === "no" && truth === "yes") fn++;
  }

  const accuracy = (tp + tn) / (tp + fp + tn + fn) || 0;
  const tpr = tp / (tp + fn) || 0; // sensitivity
  const tnr = tn / (tn + fp) || 0; // specificity
  const balancedAccuracy = (tpr + tnr) / 2;

  return {
    accuracy,
    balancedAccuracy,
    tp,
    fp,
    tn,
    fn,
    total: predictions.length,
  };
}

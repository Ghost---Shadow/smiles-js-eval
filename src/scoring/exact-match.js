/** Compute exact match accuracy. */
export function exactMatchAccuracy(predictions, groundTruths) {
  if (predictions.length === 0) return { accuracy: 0, total: 0, correct: 0 };
  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] === groundTruths[i]) correct++;
  }
  return {
    accuracy: correct / predictions.length,
    total: predictions.length,
    correct,
  };
}

/**
 * Prompt template for aromatic ring counting.
 * Returns the prompt with molecule representation injected.
 */
export function aromaticRingsPrompt(molecule) {
  return `How many aromatic rings are in the following molecule?

${molecule}

Respond with a single integer.

Answer:`;
}

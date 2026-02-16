/**
 * Prompt template for hydrogen bond donor/acceptor counting.
 * Returns the prompt with molecule representation injected.
 */
export function hbondPrompt(molecule) {
  return `How many hydrogen bond donors and hydrogen bond acceptors does this molecule have?

${molecule}

Respond in the format: donors=X, acceptors=Y

Answer:`;
}

/**
 * Prompt template for functional group detection.
 * Returns the prompt with molecule representation injected.
 */
export function funcGroupPrompt(molecule) {
  return `Which of the following functional groups are present in this molecule?

${molecule}

Possible groups: hydroxyl (-OH), carboxyl (-COOH), amine (-NH2), amide (-C(=O)NH-), ester (-C(=O)O-C), ether (C-O-C), nitro (-NO2), halide (-F/-Cl/-Br/-I)

Respond with ONLY a comma-separated list of the group names that are present. For example: hydroxyl, amine, halide

Answer:`;
}

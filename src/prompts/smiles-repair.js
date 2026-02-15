export function smilesRepairPrompt(corrupted) {
  return `The following SMILES string is invalid. Fix it to produce a valid molecule that is as close as possible to the intended structure.

${corrupted}

Respond with the corrected SMILES string.

Answer:`;
}

export function codeRepairPrompt(corruptedCode) {
  return `The following smiles-js code has an error that makes it produce an invalid molecule. Fix the code to produce a valid molecule as close as possible to the intended structure.

${corruptedCode}

Respond with the corrected SMILES string (not code).

Answer:`;
}

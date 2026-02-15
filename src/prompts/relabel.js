export function relabelPrompt(code) {
  return `The following code constructs a molecule using the smiles-js library. The variable names are auto-generated and not meaningful. Rename all variables to reflect what each part of the molecule is (e.g., phenylRing, methylBranch, acetylGroup, amideBond). Do not change any logic, only variable names.

${code}

Answer:`;
}

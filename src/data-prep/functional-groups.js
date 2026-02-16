import { initRDKit } from "./rdkit-utils.js";

/**
 * SMARTS patterns for 8 common functional groups.
 * Each pattern detects a specific functional group in a molecule.
 */
const FG_SMARTS = {
  hydroxyl: "[OX2H1]",                 // -OH (not in carboxyl)
  carboxyl: "[CX3](=O)[OX2H1]",       // -COOH
  amine: "[NX3H2]",                    // -NH2 (primary amine)
  amide: "[NX3][CX3](=[OX1])",        // -C(=O)N- (amide bond)
  ester: "[#6][OX2][CX3](=[OX1])~*",  // -C(=O)O-C (ester, excludes free acid)
  ether: "[OD2]([#6])[#6;!$([#6]=[OX1])]",  // C-O-C (ether, not ester)
  nitro: "[$([NX3](=O)=O),$([NX3+](=O)[O-])]",  // -NO2 (both forms)
  halide: "[F,Cl,Br,I]",              // any halide
};

export const FG_NAMES = Object.keys(FG_SMARTS);

/**
 * Detect which functional groups are present in a SMILES string.
 * Returns an array of group names (e.g., ["hydroxyl", "amine"]).
 */
export async function detectFunctionalGroups(smiles) {
  const rdkit = await initRDKit();
  const mol = rdkit.get_mol(smiles);
  if (!mol) return null;

  const groups = [];
  for (const [name, smarts] of Object.entries(FG_SMARTS)) {
    const pattern = rdkit.get_qmol(smarts);
    const match = mol.get_substruct_match(pattern);
    if (match && JSON.parse(match).atoms?.length > 0) {
      groups.push(name);
    }
    pattern.delete();
  }
  mol.delete();
  return groups;
}

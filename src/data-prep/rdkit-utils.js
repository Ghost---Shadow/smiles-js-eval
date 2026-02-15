let RDKitModule = null;

export async function initRDKit() {
  if (RDKitModule) return RDKitModule;
  const initRDKitModule = (await import("@rdkit/rdkit")).default;
  RDKitModule = await initRDKitModule();
  return RDKitModule;
}

/** Get ring count for a SMILES string. Returns null on failure. */
export async function getRingCount(smiles) {
  const rdkit = await initRDKit();
  const mol = rdkit.get_mol(smiles);
  if (!mol) return null;
  try {
    const descriptors = JSON.parse(mol.get_descriptors());
    mol.delete();
    return descriptors.NumRings ?? null;
  } catch {
    mol.delete();
    return null;
  }
}

/** Check if a SMILES is valid. */
export async function isValidSmiles(smiles) {
  const rdkit = await initRDKit();
  const mol = rdkit.get_mol(smiles);
  if (!mol) return false;
  mol.delete();
  return true;
}

/** Get canonical SMILES. Returns null on failure. */
export async function canonicalize(smiles) {
  const rdkit = await initRDKit();
  const mol = rdkit.get_mol(smiles);
  if (!mol) return null;
  const canonical = mol.get_smiles();
  mol.delete();
  return canonical;
}

import { writeFileSync } from "fs";
import { getRingCount } from "./rdkit-utils.js";
import { smilesToCode } from "./to-code.js";

const TARGET = 100;
const CHEMBL_API =
  "https://www.ebi.ac.uk/chembl/api/data/molecule.json?limit=200&molecule_structures__canonical_smiles__isnull=false&molecule_properties__num_ro5_violations__lte=3";

async function fetchChEMBLMolecules() {
  console.log("Fetching molecules from ChEMBL...");
  const res = await fetch(CHEMBL_API);
  if (!res.ok) throw new Error(`ChEMBL API error: ${res.status}`);
  const data = await res.json();
  return data.molecules;
}

async function main() {
  const molecules = await fetchChEMBLMolecules();
  console.log(`Fetched ${molecules.length} molecules from ChEMBL`);

  const dataset = [];
  for (const mol of molecules) {
    if (dataset.length >= TARGET) break;

    const smiles =
      mol.molecule_structures?.canonical_smiles;
    if (!smiles) continue;

    const ringCount = await getRingCount(smiles);
    if (ringCount === null) continue;

    const code = smilesToCode(smiles);
    if (!code) continue;

    dataset.push({
      chembl_id: mol.molecule_chembl_id,
      smiles,
      code,
      ringCount,
    });
  }

  console.log(`Prepared ${dataset.length} ring-count entries`);
  writeFileSync("data/ring-count.json", JSON.stringify(dataset, null, 2));
  console.log("Wrote data/ring-count.json");
}

main().catch(console.error);

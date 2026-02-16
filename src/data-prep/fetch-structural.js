/**
 * Fetch molecules from ChEMBL for 3 structural tasks:
 * - func-group: functional group detection (multi-label)
 * - aromatic-rings: aromatic ring counting
 * - hbond: hydrogen bond donor/acceptor counting
 *
 * Usage: bun run src/data-prep/fetch-structural.js [task]
 *   task = func-group | aromatic-rings | hbond | all (default: all)
 */
import { writeFileSync } from "fs";
import { initRDKit } from "./rdkit-utils.js";
import { smilesToCode } from "./to-code.js";
import { detectFunctionalGroups } from "./functional-groups.js";

const TARGET = 100;

// Different offsets to get diverse molecules for each task
const CHEMBL_URLS = {
  "func-group":
    "https://www.ebi.ac.uk/chembl/api/data/molecule.json?limit=500&offset=200&molecule_structures__canonical_smiles__isnull=false&molecule_properties__num_ro5_violations__lte=3",
  "aromatic-rings":
    "https://www.ebi.ac.uk/chembl/api/data/molecule.json?limit=500&offset=700&molecule_structures__canonical_smiles__isnull=false&molecule_properties__aromatic_rings__gte=1",
  hbond:
    "https://www.ebi.ac.uk/chembl/api/data/molecule.json?limit=500&offset=1200&molecule_structures__canonical_smiles__isnull=false&molecule_properties__hbd__gte=1&molecule_properties__hba__gte=2",
};

async function fetchMolecules(url) {
  console.log("Fetching from ChEMBL...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ChEMBL API error: ${res.status}`);
  const data = await res.json();
  return data.molecules;
}

async function buildFuncGroupDataset(molecules) {
  const dataset = [];
  for (const mol of molecules) {
    if (dataset.length >= TARGET) break;
    const smiles = mol.molecule_structures?.canonical_smiles;
    if (!smiles) continue;

    const code = smilesToCode(smiles);
    if (!code) continue;

    const groups = await detectFunctionalGroups(smiles);
    if (!groups || groups.length < 2) continue; // Want molecules with 2+ groups

    dataset.push({
      chembl_id: mol.molecule_chembl_id,
      smiles,
      code,
      groups,
    });
  }
  return dataset;
}

async function buildAromaticRingsDataset(molecules) {
  const rdkit = await initRDKit();
  const dataset = [];
  const seen = new Set(); // Track aromatic ring counts for diversity

  for (const mol of molecules) {
    if (dataset.length >= TARGET) break;
    const smiles = mol.molecule_structures?.canonical_smiles;
    if (!smiles) continue;

    const rdMol = rdkit.get_mol(smiles);
    if (!rdMol) continue;

    const desc = JSON.parse(rdMol.get_descriptors());
    const aromaticRingCount = desc.NumAromaticRings;
    const totalRings = desc.NumRings;
    rdMol.delete();

    // Want molecules where aromatic != total (mix of ring types) for harder task
    // But also include some pure-aromatic for variety
    if (aromaticRingCount === 0) continue;

    const code = smilesToCode(smiles);
    if (!code) continue;

    dataset.push({
      chembl_id: mol.molecule_chembl_id,
      smiles,
      code,
      aromaticRingCount,
      totalRings,
    });
  }
  return dataset;
}

async function buildHBondDataset(molecules) {
  const rdkit = await initRDKit();
  const dataset = [];

  for (const mol of molecules) {
    if (dataset.length >= TARGET) break;
    const smiles = mol.molecule_structures?.canonical_smiles;
    if (!smiles) continue;

    const rdMol = rdkit.get_mol(smiles);
    if (!rdMol) continue;

    const desc = JSON.parse(rdMol.get_descriptors());
    const hbd = desc.NumHBD;
    const hba = desc.NumHBA;
    rdMol.delete();

    if (hbd < 1 || hba < 2) continue;

    const code = smilesToCode(smiles);
    if (!code) continue;

    dataset.push({
      chembl_id: mol.molecule_chembl_id,
      smiles,
      code,
      hbd,
      hba,
    });
  }
  return dataset;
}

async function main() {
  const task = process.argv[2] || "all";
  const tasks = task === "all" ? ["func-group", "aromatic-rings", "hbond"] : [task];

  for (const t of tasks) {
    console.log(`\n=== Building ${t} dataset ===`);
    const molecules = await fetchMolecules(CHEMBL_URLS[t]);
    console.log(`Fetched ${molecules.length} molecules`);

    let dataset;
    if (t === "func-group") {
      dataset = await buildFuncGroupDataset(molecules);
    } else if (t === "aromatic-rings") {
      dataset = await buildAromaticRingsDataset(molecules);
    } else if (t === "hbond") {
      dataset = await buildHBondDataset(molecules);
    }

    console.log(`Prepared ${dataset.length} entries for ${t}`);
    const path = `data/${t}.json`;
    writeFileSync(path, JSON.stringify(dataset, null, 2));
    console.log(`Wrote ${path}`);
  }
}

main().catch(console.error);

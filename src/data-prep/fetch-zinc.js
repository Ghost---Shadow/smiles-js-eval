import { writeFileSync } from "fs";
import { isValidSmiles, canonicalize } from "./rdkit-utils.js";
import { smilesToCode } from "./to-code.js";
import { corruptSmiles, corruptCode } from "./corrupt-smiles.js";

const TARGET = 100;
const HF_BASE =
  "https://datasets-server.huggingface.co/rows?dataset=yairschiff%2Fzinc250k&config=default&split=train";

async function fetchZINC() {
  console.log("Fetching ZINC250k from HuggingFace...");
  const allRows = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const url = `${HF_BASE}&offset=${offset}&length=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HuggingFace API error: ${res.status}`);
    const data = await res.json();
    allRows.push(...data.rows.map((r) => r.row));
    if (data.rows.length < 100) break;
  }
  return allRows;
}

async function main() {
  const rows = await fetchZINC();
  console.log(`Fetched ${rows.length} ZINC rows`);

  const dataset = [];
  for (const row of rows) {
    if (dataset.length >= TARGET) break;

    const smiles = row.smiles?.trim();
    if (!smiles) continue;

    const valid = await isValidSmiles(smiles);
    if (!valid) continue;

    const canonical = await canonicalize(smiles);
    if (!canonical) continue;

    const code = smilesToCode(smiles);
    if (!code) continue;

    const smilesCorruption = corruptSmiles(smiles);
    if (!smilesCorruption) continue;

    const codeCorruption = corruptCode(code);

    dataset.push({
      original: canonical,
      original_code: code,
      corrupted_smiles: smilesCorruption.corrupted,
      smiles_corruption_type: smilesCorruption.corruptionType,
      corrupted_code: codeCorruption?.corrupted ?? null,
      code_corruption_type: codeCorruption?.corruptionType ?? null,
    });
  }

  console.log(`Prepared ${dataset.length} SMILES repair entries`);
  writeFileSync("data/smiles-repair.json", JSON.stringify(dataset, null, 2));
  console.log("Wrote data/smiles-repair.json");
}

main().catch(console.error);

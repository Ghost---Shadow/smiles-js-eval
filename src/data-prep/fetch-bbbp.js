import { writeFileSync } from "fs";
import { smilesToCode } from "./to-code.js";
import { isValidSmiles } from "./rdkit-utils.js";

const TARGET = 100;
const HF_BASE =
  "https://datasets-server.huggingface.co/rows?dataset=katielink%2Fmoleculenet-benchmark&config=bbbp&split=train";

async function fetchBBBPPage(offset, length) {
  const url = `${HF_BASE}&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HuggingFace API error: ${res.status}`);
  const data = await res.json();
  return data.rows.map((r) => r.row);
}

async function fetchAllBBBP() {
  console.log("Fetching BBBP from HuggingFace...");
  const allRows = [];
  for (let offset = 0; offset < 400; offset += 100) {
    const rows = await fetchBBBPPage(offset, 100);
    allRows.push(...rows);
    if (rows.length < 100) break;
  }
  return allRows;
}

async function main() {
  const rows = await fetchAllBBBP();
  console.log(`Fetched ${rows.length} BBBP rows`);

  const positives = [];
  const negatives = [];

  for (const row of rows) {
    const smiles = row.smiles;
    const label = row.p_np; // 1 = penetrates, 0 = does not
    if (!smiles || label === undefined) continue;

    const valid = await isValidSmiles(smiles);
    if (!valid) continue;

    const code = smilesToCode(smiles);
    if (!code) continue;

    const entry = { smiles, code, label: label === 1 ? "yes" : "no" };
    if (label === 1) positives.push(entry);
    else negatives.push(entry);
  }

  // Balance: 50 yes, 50 no
  const half = TARGET / 2;
  const dataset = [...positives.slice(0, half), ...negatives.slice(0, half)];

  // Shuffle
  for (let i = dataset.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dataset[i], dataset[j]] = [dataset[j], dataset[i]];
  }

  console.log(
    `Prepared ${dataset.length} BBBP entries (${positives.slice(0, half).length} yes, ${negatives.slice(0, half).length} no)`,
  );
  writeFileSync("data/bbbp.json", JSON.stringify(dataset, null, 2));
  console.log("Wrote data/bbbp.json");
}

main().catch(console.error);

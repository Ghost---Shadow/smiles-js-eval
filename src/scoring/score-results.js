import "./../../src/load-env.js";
import { readFileSync, writeFileSync } from "fs";
import { parseInteger, parseYesNo, parseSmiles, parseFunctionalGroups, parseHBond } from "../eval/parse-response.js";
import { exactMatchAccuracy } from "./exact-match.js";
import { binaryMetrics } from "./auc-roc.js";
import { smilesRepairMetrics } from "./validity.js";
import { f1Score } from "./f1.js";

const args = process.argv.slice(2);
const resultsFile = args[0];
const task = args[1];

if (!resultsFile || !task) {
  console.error("Usage: bun run src/scoring/score-results.js <results.json> <task>");
  process.exit(1);
}

const { results } = JSON.parse(readFileSync(resultsFile, "utf-8"));
const dataset = JSON.parse(readFileSync(`data/${task}.json`, "utf-8"));

// Parse responses
const parserMap = {
  "ring-count": parseInteger,
  "aromatic-rings": parseInteger,
  bbbp: parseYesNo,
  "smiles-repair": parseSmiles,
  "func-group": parseFunctionalGroups,
  hbond: parseHBond,
};
const parser = parserMap[task];
if (!parser) {
  console.error(`Unknown task: ${task}. Valid: ${Object.keys(parserMap).join(", ")}`);
  process.exit(1);
}
for (const r of results) {
  if (r.rawResponse && r.parsed === null) {
    r.parsed = parser(r.rawResponse);
  }
}

const predictions = results.map((r) => r.parsed);
const parseFailures = predictions.filter((p) => p === null).length;

async function score() {
  let scores;
  if (task === "ring-count") {
    const groundTruths = dataset.map((r) => r.ringCount);
    const validPreds = [];
    const validTruths = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validTruths.push(groundTruths[i]);
      }
    }
    scores = { ...exactMatchAccuracy(validPreds, validTruths), parseFailures };
  } else if (task === "bbbp") {
    const groundTruths = dataset.map((r) => r.label);
    const validPreds = [];
    const validTruths = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validTruths.push(groundTruths[i]);
      }
    }
    scores = { ...binaryMetrics(validPreds, validTruths), parseFailures };
  } else if (task === "smiles-repair") {
    const originals = dataset.map((r) => r.original);
    const validPreds = [];
    const validOriginals = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validOriginals.push(originals[i]);
      }
    }
    scores = { ...(await smilesRepairMetrics(validPreds, validOriginals)), parseFailures };
  } else if (task === "func-group") {
    const scored = results.map((r, i) => ({ parsed: r.parsed, groups: dataset[i].groups }));
    scores = f1Score(scored);
  } else if (task === "aromatic-rings") {
    const groundTruths = dataset.map((r) => r.aromaticRingCount);
    const validPreds = [];
    const validTruths = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validTruths.push(groundTruths[i]);
      }
    }
    scores = { ...exactMatchAccuracy(validPreds, validTruths), parseFailures };
  } else if (task === "hbond") {
    let correct = 0;
    let donorCorrect = 0;
    let acceptorCorrect = 0;
    let scored = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === null) continue;
      scored++;
      const { hbd, hba } = predictions[i];
      if (hbd === dataset[i].hbd) donorCorrect++;
      if (hba === dataset[i].hba) acceptorCorrect++;
      if (hbd === dataset[i].hbd && hba === dataset[i].hba) correct++;
    }
    scores = {
      accuracy: scored > 0 ? correct / scored : 0,
      donorAccuracy: scored > 0 ? donorCorrect / scored : 0,
      acceptorAccuracy: scored > 0 ? acceptorCorrect / scored : 0,
      correct,
      donorCorrect,
      acceptorCorrect,
      total: results.length,
      scored,
      parseFailures,
    };
  }

  console.log(JSON.stringify(scores, null, 2));

  // Write scored results back
  const scored = JSON.parse(readFileSync(resultsFile, "utf-8"));
  scored.scores = scores;
  scored.results = results;
  writeFileSync(resultsFile, JSON.stringify(scored, null, 2));
}

score().catch(console.error);

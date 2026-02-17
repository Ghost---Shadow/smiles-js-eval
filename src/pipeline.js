import "./load-env.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { callClaude, callClaudeTwoTurn } from "./eval/runner.js";
import { parseInteger, parseYesNo, parseSmiles, parseFunctionalGroups, parseHBond } from "./eval/parse-response.js";
import { ringCountPrompt } from "./prompts/ring-count.js";
import { bbbpPrompt } from "./prompts/bbbp.js";
import { smilesRepairPrompt, codeRepairPrompt } from "./prompts/smiles-repair.js";
import { relabelPrompt } from "./prompts/relabel.js";
import { funcGroupPrompt } from "./prompts/func-group.js";
import { aromaticRingsPrompt } from "./prompts/aromatic-rings.js";
import { hbondPrompt } from "./prompts/hbond.js";
import { exactMatchAccuracy } from "./scoring/exact-match.js";
import { binaryMetrics } from "./scoring/auc-roc.js";
import { smilesRepairMetrics } from "./scoring/validity.js";
import { f1Score } from "./scoring/f1.js";

const TASKS = ["bbbp", "func-group", "aromatic-rings", "hbond"];
const CONDITIONS = ["smiles", "code", "code+relabel"];

function loadDataset(task) {
  return JSON.parse(readFileSync(`data/${task}.json`, "utf-8"));
}

function getPrompt(task, condition, row) {
  if (task === "ring-count") {
    const molecule = condition === "smiles" ? row.smiles : row.code;
    return ringCountPrompt(molecule);
  }
  if (task === "bbbp") {
    const molecule = condition === "smiles" ? row.smiles : row.code;
    return bbbpPrompt(molecule);
  }
  if (task === "smiles-repair") {
    if (condition === "smiles") return smilesRepairPrompt(row.corrupted_smiles);
    if (condition === "code" || condition === "code+relabel") {
      if (!row.corrupted_code) return smilesRepairPrompt(row.corrupted_smiles);
      return codeRepairPrompt(row.corrupted_code);
    }
  }
  if (task === "func-group") {
    const molecule = condition === "smiles" ? row.smiles : row.code;
    return funcGroupPrompt(molecule);
  }
  if (task === "aromatic-rings") {
    const molecule = condition === "smiles" ? row.smiles : row.code;
    return aromaticRingsPrompt(molecule);
  }
  if (task === "hbond") {
    const molecule = condition === "smiles" ? row.smiles : row.code;
    return hbondPrompt(molecule);
  }
  throw new Error(`Unknown task: ${task}`);
}

function getParser(task) {
  if (task === "ring-count") return parseInteger;
  if (task === "aromatic-rings") return parseInteger;
  if (task === "bbbp") return parseYesNo;
  if (task === "smiles-repair") return parseSmiles;
  if (task === "func-group") return parseFunctionalGroups;
  if (task === "hbond") return parseHBond;
  throw new Error(`Unknown task: ${task}`);
}

async function runTask(task, condition, dataset) {
  const parser = getParser(task);
  const results = [];
  const total = dataset.length;

  for (let i = 0; i < total; i++) {
    const row = dataset[i];
    let rawResponse, parsed;

    try {
      if (condition === "code+relabel") {
        const relabel = relabelPrompt(row.code);
        const { relabeled, answer } = await callClaudeTwoTurn(
          relabel,
          (relabeledCode) => getPrompt(task, "code", { ...row, code: relabeledCode }),
        );
        rawResponse = answer;
        parsed = parser(answer);
        results.push({ index: i, rawResponse, relabeled, parsed });
      } else {
        const prompt = getPrompt(task, condition, row);
        rawResponse = await callClaude(prompt);
        parsed = parser(rawResponse);
        results.push({ index: i, rawResponse, parsed });
      }
    } catch (err) {
      console.error(`Error on row ${i}: ${err.message}`);
      results.push({ index: i, error: err.message, parsed: null });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ${task}/${condition}: ${i + 1}/${total}`);
    }
  }

  return results;
}

async function scoreResults(task, condition, dataset, results) {
  const predictions = results.map((r) => r.parsed);
  const parseFailures = predictions.filter((p) => p === null).length;

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
    return { ...exactMatchAccuracy(validPreds, validTruths), parseFailures };
  }

  if (task === "bbbp") {
    const groundTruths = dataset.map((r) => r.label);
    const validPreds = [];
    const validTruths = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validTruths.push(groundTruths[i]);
      }
    }
    return { ...binaryMetrics(validPreds, validTruths), parseFailures };
  }

  if (task === "smiles-repair") {
    const originals = dataset.map((r) => r.original);
    const validPreds = [];
    const validOriginals = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validOriginals.push(originals[i]);
      }
    }
    return {
      ...(await smilesRepairMetrics(validPreds, validOriginals)),
      parseFailures,
    };
  }

  if (task === "func-group") {
    const scored = results.map((r, i) => ({ parsed: r.parsed, groups: dataset[i].groups }));
    return f1Score(scored);
  }

  if (task === "aromatic-rings") {
    const groundTruths = dataset.map((r) => r.aromaticRingCount);
    const validPreds = [];
    const validTruths = [];
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== null) {
        validPreds.push(predictions[i]);
        validTruths.push(groundTruths[i]);
      }
    }
    return { ...exactMatchAccuracy(validPreds, validTruths), parseFailures };
  }

  if (task === "hbond") {
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
    return {
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
}

async function main() {
  const args = process.argv.slice(2);
  let tasks = TASKS;
  let conditions = CONDITIONS;

  // Parse --task and --condition flags
  const taskIdx = args.indexOf("--task");
  if (taskIdx !== -1 && args[taskIdx + 1]) {
    tasks = [args[taskIdx + 1]];
  }
  const condIdx = args.indexOf("--condition");
  if (condIdx !== -1 && args[condIdx + 1]) {
    conditions = [args[condIdx + 1]];
  }

  let limit = Infinity;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  mkdirSync("results", { recursive: true });

  const allResults = {};

  for (const task of tasks) {
    console.log(`\n=== Task: ${task} ===`);
    const dataset = loadDataset(task).slice(0, limit);
    allResults[task] = {};

    for (const condition of conditions) {
      console.log(`\n--- Condition: ${condition} ---`);
      const results = await runTask(task, condition, dataset);
      const scores = await scoreResults(task, condition, dataset, results);

      allResults[task][condition] = { scores, results };
      console.log(`Scores:`, JSON.stringify(scores, null, 2));

      // Save per-task-condition results
      const filename = `results/${task}_${condition.replace("+", "-")}.json`;
      writeFileSync(filename, JSON.stringify({ scores, results }, null, 2));
    }
  }

  // Save summary
  const summary = {};
  for (const task of tasks) {
    summary[task] = {};
    for (const condition of conditions) {
      summary[task][condition] = allResults[task]?.[condition]?.scores;
    }
  }
  writeFileSync("results/summary.json", JSON.stringify(summary, null, 2));
  console.log("\n=== Summary ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nResults saved to results/");
}

main().catch(console.error);

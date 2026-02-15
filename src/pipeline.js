import "./load-env.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { callClaude, callClaudeTwoTurn } from "./eval/runner.js";
import { parseInteger, parseYesNo, parseSmiles } from "./eval/parse-response.js";
import { ringCountPrompt } from "./prompts/ring-count.js";
import { bbbpPrompt } from "./prompts/bbbp.js";
import { smilesRepairPrompt, codeRepairPrompt } from "./prompts/smiles-repair.js";
import { relabelPrompt } from "./prompts/relabel.js";
import { exactMatchAccuracy } from "./scoring/exact-match.js";
import { binaryMetrics } from "./scoring/auc-roc.js";
import { smilesRepairMetrics } from "./scoring/validity.js";

const TASKS = ["ring-count", "bbbp", "smiles-repair"];
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
  throw new Error(`Unknown task: ${task}`);
}

function getParser(task) {
  if (task === "ring-count") return parseInteger;
  if (task === "bbbp") return parseYesNo;
  if (task === "smiles-repair") return parseSmiles;
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

  mkdirSync("results", { recursive: true });

  const allResults = {};

  for (const task of tasks) {
    console.log(`\n=== Task: ${task} ===`);
    const dataset = loadDataset(task);
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

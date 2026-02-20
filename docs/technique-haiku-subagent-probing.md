# Technique: Haiku Subagent Probing

## The Problem

Running LLM evaluations the traditional way is slow and expensive:

1. **Batch pipeline**: Write prompts, run 100+ API calls, parse results, score, analyze. Takes hours. Any bug in prompts or parsers means re-running the whole batch.
2. **Local models**: Download weights, configure quantization, manage GPU memory, wait for inference. Even a small model takes 30-45 minutes per condition.
3. **Iteration speed**: You can't explore hypotheses quickly. Each "what if we try X?" costs a full pipeline run.

## The Technique

Use Claude Code's `Task` tool with `model: "haiku"` to spawn lightweight subagents that act as your test subjects. Instead of building a batch pipeline, you have a conversation:

```
You (to Opus/Sonnet):
  "Test whether Haiku can count aromatic rings in this molecule.
   Give it the SMILES, then give it the code. Compare."

Opus spawns two Haiku agents in parallel:
  Agent A: "How many aromatic rings? c1c2ccoc2cc2ccc(=O)oc12" → "2"
  Agent B: "How many aromatic rings? [code version]"           → "3"

Opus compares against ground truth (3):
  "SMILES: wrong. Code: correct. Code wins on fused heterocycles."
```

The outer model (Opus/Sonnet) acts as the **experimenter** — it selects molecules, formulates hypotheses, designs probes, dispatches Haiku agents, and interprets results. Haiku is the **test subject**.

## Why This Works

### Speed
Each Haiku probe completes in 2-5 seconds. You can run 6 probes in parallel. A full round of "pick molecule, test SMILES vs code, analyze" takes under 30 seconds. Compare to 45 minutes for a local GPU run.

### Cost
Haiku is ~60x cheaper than Opus per token. Running 15 probes costs pennies. A batch of 100 rows through Sonnet costs dollars.

### Interactivity
The human stays in the loop. After each round, you see results immediately and can steer:
- "That molecule was too easy. Find a harder one."
- "Scaffold recognition looks promising. Test 3 more."
- "Code overcounted — try the relabel condition."

This is impossible with batch pipelines where you commit to a full run upfront.

### Qualitative depth
Batch runs give you accuracy numbers. Subagent probing gives you *explanations*. You see exactly what Haiku said, why it was wrong, and what the code representation changed in its reasoning. This is how we discovered that code makes Haiku hallucinate "ester" from `Fragment('CO')` — a failure mode invisible in aggregate F1 scores.

## How To Do It

### 1. Pick your test subject model

```js
// In Claude Code's Task tool:
{
  model: "haiku",        // cheap, fast test subject
  subagent_type: "general-purpose",
  prompt: "Your chemistry question here..."
}
```

### 2. Design paired probes

Always test the same molecule with both representations. The outer model selects molecules strategically — start with cases where you expect a difference.

```
// Probe pair: same question, different representation
Agent A (SMILES): "How many aromatic rings? [SMILES string]"
Agent B (Code):   "How many aromatic rings? [smiles-js code]"
```

### 3. Run in parallel

Claude Code can dispatch multiple Task calls in a single message. Fire both representations simultaneously:

```
Task(model: "haiku", prompt: "SMILES version...")
Task(model: "haiku", prompt: "Code version...")
// Both return in ~3 seconds
```

### 4. Log everything

Record each probe with its ground truth, both answers, and a note explaining what happened. We used a JSON file (`data/haiku-probes.json`):

```json
{
  "id": 1,
  "task": "aromatic-ring-count",
  "smiles": "c1c2ccoc2cc2ccc(=O)oc12",
  "truth": 3,
  "smiles_answer": 2,
  "code_answer": 3,
  "smiles_correct": false,
  "code_correct": true,
  "notes": "SMILES compressed furans; code listed 3 rings in FusedRing."
}
```

### 5. Let the outer model steer

The key insight: **the experimenter model is smarter than the test subject**. Opus/Sonnet can:
- Identify which molecules will be hard for Haiku
- Notice patterns across probes ("code always wins on fused heterocycles")
- Formulate and test follow-up hypotheses in real time
- Decide when to stop probing and write conclusions

This is effectively **AI-driven experimental design** where the experiment is "what does a smaller AI get wrong?"

## When To Use This vs Batch Runs

| Use subagent probing when... | Use batch pipelines when... |
|---|---|
| Exploring a new hypothesis | Validating a known hypothesis at scale |
| You don't know which examples matter | You need statistical significance |
| Iteration speed > statistical power | You need reproducible numbers for a paper |
| You want to understand *why* it fails | You need aggregate accuracy metrics |
| Early-stage research | Late-stage evaluation |

The ideal workflow: **probe first, then batch**. Use subagent probing to find the interesting cases and formulate sharp hypotheses. Then run the batch pipeline on those specific cases to get significant numbers.

## Results From This Study

Using this technique on smiles-js-eval, we ran 15 probes in a single session and discovered:

- **3 patterns where code helps** (fused ring counting, scaffold recognition, chain unit counting)
- **2 patterns where SMILES wins** (functional groups, atom-level annotations)
- **1 fundamental principle**: code = tree decomposition; trees beat strings for counting nodes, strings beat trees for pattern matching

These insights would have taken days to extract from batch runs. The subagent probing technique found them in ~30 minutes.

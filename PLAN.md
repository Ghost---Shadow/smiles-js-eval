# Implementation Plan — smiles-js-eval MVP

## Scope
- **3 tasks**: Ring Count (Tier 1), BBBP (Tier 2), SMILES Repair (Tier 3)
- **100 rows per dataset**
- **3 conditions**: `smiles`, `code`, `code+relabel`
- **1 model**: Claude (Anthropic API)
- **Runtime**: Node.js (ES modules, Bun)

## Architecture

```
smiles-js-eval/
├── package.json
├── src/
│   ├── data-prep/                # Dataset fetching & preparation
│   │   ├── fetch-chembl.js       # Fetch molecules from ChEMBL REST API
│   │   ├── fetch-bbbp.js         # Fetch BBBP from HuggingFace Dataset Viewer API
│   │   ├── fetch-zinc.js         # Fetch ZINC250k from HuggingFace
│   │   ├── compute-labels.js     # Use @rdkit/rdkit WASM for ring counts, validation
│   │   ├── corrupt-smiles.js     # Programmatically corrupt SMILES for task 3.5
│   │   └── to-code.js            # Convert SMILES → smiles-js code via parse().toCode()
│   ├── prompts/                  # Prompt templates per task
│   │   ├── ring-count.js         # Task 1.2 prompt builder
│   │   ├── bbbp.js               # Task 2.3 prompt builder
│   │   └── smiles-repair.js      # Task 3.5 prompt builder
│   ├── eval/                     # Evaluation runner
│   │   ├── runner.js             # Calls Claude API, manages retries, rate limits
│   │   └── parse-response.js     # Extract answers from LLM responses
│   ├── scoring/                  # Metrics computation
│   │   ├── exact-match.js        # For ring count, SMILES repair
│   │   ├── auc-roc.js            # For BBBP
│   │   └── validity.js           # SMILES validity check via RDKit
│   └── pipeline.js               # End-to-end orchestrator
├── data/                         # Generated datasets (JSON)
│   ├── ring-count.json
│   ├── bbbp.json
│   └── smiles-repair.json
├── results/                      # Eval results (JSON)
└── tests/                        # Unit tests
    ├── data-prep/
    ├── prompts/
    ├── eval/
    └── scoring/
```

## Implementation Steps

### Step 1: Project Setup
- Initialize package.json (type: module, bun test)
- Install deps: `smiles-js` (local link), `@rdkit/rdkit`, `@anthropic-ai/sdk`
- Set up basic test infrastructure

### Step 2: Data Preparation — Ring Count (Task 1.2)
- Fetch 100 diverse molecules from ChEMBL REST API
- Use @rdkit/rdkit WASM to compute ground truth ring counts
- Convert each SMILES to code via smiles-js parse().toCode()
- Output: `data/ring-count.json` with fields: { smiles, code, ringCount }

### Step 3: Data Preparation — BBBP (Task 2.3)
- Fetch BBBP data from HuggingFace Dataset Viewer API (katielink/moleculenet-benchmark)
- Sample 100 rows, balanced yes/no
- Convert each SMILES to code
- Output: `data/bbbp.json` with fields: { smiles, code, label }

### Step 4: Data Preparation — SMILES Repair (Task 3.5)
- Fetch 100 valid SMILES from HuggingFace ZINC250k dataset
- Programmatically corrupt each (missing ring closure, unbalanced parens, etc.)
- For code condition: corrupt the code representation instead
- Output: `data/smiles-repair.json` with fields: { original, corrupted_smiles, corrupted_code, original_code }

### Step 5: Prompt Templates
- Build prompt generators per task × condition
- Each returns the full prompt string with molecule representation injected
- For code+relabel: generate the relabel prompt + placeholder for turn 2

### Step 6: Evaluation Runner
- Claude API client with retry logic and rate limiting
- Processes each (task, condition, row) tuple
- For code+relabel: makes 2 API calls (relabel, then solve)
- Saves raw responses + parsed answers

### Step 7: Response Parsing
- Integer extraction for ring count
- Yes/no extraction for BBBP
- SMILES string extraction for repair

### Step 8: Scoring
- Ring Count: exact match accuracy
- BBBP: accuracy + AUC-ROC
- SMILES Repair: validity % + exact match to original

### Step 9: Pipeline Orchestrator
- CLI entry point: `bun run src/pipeline.js --task ring-count --condition smiles`
- Supports running all tasks × conditions
- Outputs results to `results/` as JSON

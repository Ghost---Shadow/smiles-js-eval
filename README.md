# smiles-js-eval

**Does representing molecules as composable code help LLMs reason about chemistry?**

This evaluation suite tests the conjecture that LLMs perform better on molecular reasoning tasks when molecules are represented as programmatic construction code (via [smiles-js](https://github.com/Ghost---Shadow/smiles-js)) rather than raw SMILES strings.

---

## Conjecture

SMILES notation encodes molecular structure as flat strings (e.g. `CC(=O)Oc1ccccc1C(=O)O`), which requires implicit knowledge of bracket matching, ring closures, and branching semantics to interpret. The `smiles-js` library can convert these into explicit, composable JavaScript code via `.toCode()`:

```javascript
const molecule1 = Linear(['C', 'C(=O)', 'O']);
const molecule2 = Ring({ atoms: 'c', size: 6 });
const molecule3 = Molecule([molecule1, molecule2, Linear(['C(=O)', 'O'])]);
```

**Hypothesis:** LLMs will achieve higher accuracy on molecular reasoning tasks when given the code representation, because it makes structural features — rings, branches, functional groups, symmetry — syntactically explicit.

---

## Representations & Ablation

The auto-generated code uses generic variable names (`molecule1`, `molecule2`). Giving the LLM a chance to relabel these into meaningful names (`phenylRing`, `acetylGroup`) before solving the task forces a structural reasoning step. This is the **primary ablation**.

### Experimental Conditions

| Condition ID | Input | Steps | Purpose |
|---|---|---|---|
| `smiles` | Raw SMILES string | 1 (solve) | Baseline |
| `code` | Auto-generated smiles-js code | 1 (solve) | Does code structure help? |
| `code+relabel` | Auto-generated → relabeled → solve | 2 (relabel, then solve) | Does forcing structural reasoning before the task help further? |

### Representation Examples

**Raw SMILES:**
```
CC(=O)Oc1ccccc1C(=O)O
```

**smiles-js code (auto-generated):**
```javascript
const molecule1 = Linear(['C', 'C(=O)', 'O']);
const molecule2 = Ring({ atoms: 'c', size: 6 });
const molecule3 = Molecule([molecule1, molecule2, Linear(['C(=O)', 'O'])]);
```

**smiles-js code + relabeling (two-turn):**

Turn 1 — Relabel prompt:
```
The following code constructs a molecule using the smiles-js library. The variable names are auto-generated and not meaningful. Rename all variables to reflect what each part of the molecule is (e.g., phenylRing, methylBranch, acetylGroup, amideBond). Do not change any logic, only variable names.

const molecule1 = Linear(['C', 'C(=O)', 'O']);
const molecule2 = Ring({ atoms: 'c', size: 6 });
const molecule3 = Molecule([molecule1, molecule2, Linear(['C(=O)', 'O'])]);

Answer:
```

Expected relabeling output:
```javascript
const acetylChain = Linear(['C', 'C(=O)', 'O']);
const phenylRing = Ring({ atoms: 'c', size: 6 });
const aspirin = Molecule([acetylChain, phenylRing, Linear(['C(=O)', 'O'])]);
```

Turn 2 — The relabeled code is fed into the actual task prompt in place of `{{MOLECULE}}`.

---

## Tier 1 — Structural Reasoning

These tasks test whether the LLM can "see" molecular topology. This is where we expect the **largest delta** between representations.

### 1.1 Functional Group Identification

**Dataset:** 500 molecules sampled from ChEMBL (drug-like, diverse scaffolds). Labels generated via RDKit SMARTS pattern matching.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/) — download via [ChEMBL downloads page](https://chembl.gitbook.io/chembl-interface-documentation/downloads) or `pip install chembl_webresource_client`

**Prompt:**
```
Identify all functional groups present in the following molecule.

{{MOLECULE}}

Respond with a JSON array of functional group names. Use only names from this list: hydroxyl, carboxyl, amine, amide, ester, ether, aldehyde, ketone, thiol, sulfide, phosphate, nitro, nitrile, halide, imine, sulfonamide, urea, phenol, enol, anhydride.

Answer:
```

**Expected answer:**
```json
["hydroxyl", "carboxyl", "ester"]
```

**Scoring:** Multi-label F1 against RDKit SMARTS-based detection.

---

### 1.2 Ring Count

**Dataset:** 500 molecules sampled from ChEMBL. Labels via `RDKit GetRingInfo().NumRings()`.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/)

**Prompt:**
```
How many rings are in the following molecule?

{{MOLECULE}}

Respond with a single integer.

Answer:
```

**Expected answer:**
```
3
```

**Scoring:** Exact match accuracy.

---

### 1.3 Ring Type Classification

**Dataset:** 500 molecules from ChEMBL. Labels via RDKit ring info + aromaticity perception.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/)

**Prompt:**
```
Classify all rings in the following molecule. For each ring, state its size (number of atoms) and whether it is aromatic or aliphatic.

{{MOLECULE}}

Respond with a JSON array of objects with "size" and "aromatic" fields.

Answer:
```

**Expected answer:**
```json
[
  {"size": 6, "aromatic": true},
  {"size": 6, "aromatic": true},
  {"size": 5, "aromatic": false}
]
```

**Scoring:** Set-match F1 (order-independent comparison of ring descriptors).

---

### 1.4 Substructure Presence

**Dataset:** 1000 (molecule, substructure) pairs. Balanced 50/50 yes/no. Molecules from ChEMBL, substructures from common scaffolds. Labels via `RDKit HasSubstructMatch()`.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/)

**Prompt:**
```
Does molecule A contain molecule B as a substructure?

Molecule A: {{MOLECULE_A}}
Molecule B: {{MOLECULE_B}}

Respond with "yes" or "no".

Answer:
```

**Expected answer:**
```
yes
```

**Scoring:** Binary accuracy, AUC-ROC.

---

### 1.5 Symmetry Detection

**Dataset:** 300 molecules, balanced symmetric/asymmetric. Curated from ChEMBL + synthetic symmetric molecules.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/) + programmatically generated symmetric molecules

**Prompt:**
```
Is the following molecule symmetric? A molecule is symmetric if it contains a mirror plane that maps one half of the molecule onto the other.

{{MOLECULE}}

Respond with "yes" or "no".

Answer:
```

**Expected answer:**
```
yes
```

**Scoring:** Binary accuracy.

---

### 1.6 Atom Environment

**Dataset:** 500 atom queries across diverse molecules from ChEMBL. Labels via RDKit atom descriptors.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/)

**Prompt:**
```
Describe the chemical environment of the {{NTH}} {{ELEMENT}} atom in the following molecule (counting from left to right in the SMILES, starting at 1). State its hybridization (sp, sp2, sp3), number of heavy-atom neighbors, and whether it is in a ring.

{{MOLECULE}}

Respond with a JSON object with fields: "hybridization", "num_neighbors", "in_ring".

Answer:
```

**Expected answer:**
```json
{"hybridization": "sp2", "num_neighbors": 3, "in_ring": true}
```

**Scoring:** Exact match accuracy (all 3 fields must match).

**Note:** For code representation, replace "counting from left to right in the SMILES" with "referring to the {{NTH}} {{ELEMENT}} atom as it appears in the construction code".

---

## Tier 2 — Property Prediction

These tasks test whether code representation helps with property regression/classification. The expected delta is smaller here since these are fundamentally statistical.

All Tier 2 datasets come from the **MoleculeNet** benchmark suite.

**Sources:**
- Direct CSV downloads: [deepchemdata S3 bucket](https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/) (used by DeepChem and PyTorch Geometric internally)
- Via DeepChem: `pip install deepchem` → `deepchem.molnet.load_esol()`, `load_bbbp()`, `load_clintox()`, `load_bace_classification()`, `load_lipo()`
- Via PyTorch Geometric: `torch_geometric.datasets.MoleculeNet(root, name="ESOL")` etc.
- Via HuggingFace: [katielink/moleculenet-benchmark](https://huggingface.co/datasets/katielink/moleculenet-benchmark) (ESOL, BBBP, BACE, ClinTox, etc.)
- Paper: [Wu et al. "MoleculeNet: A Benchmark for Molecular Machine Learning" (2018)](https://arxiv.org/abs/1703.00564)

---

### 2.1 Solubility (ESOL)

**Dataset:** 1,128 compounds with measured aqueous solubility.

**Prompt:**
```
Predict the aqueous solubility (log mol/L) of the following molecule.

{{MOLECULE}}

Respond with a single decimal number.

Answer:
```

**Expected answer:**
```
-3.25
```

**Scoring:** RMSE, R².

---

### 2.2 Lipophilicity

**Dataset:** 4,200 compounds with measured octanol/water partition coefficients.

**Prompt:**
```
Predict the octanol/water partition coefficient (logD at pH 7.4) of the following molecule.

{{MOLECULE}}

Respond with a single decimal number.

Answer:
```

**Expected answer:**
```
2.14
```

**Scoring:** RMSE, R².

---

### 2.3 Blood-Brain Barrier Penetration (BBBP)

**Dataset:** 2,039 compounds with binary permeability labels.

**Prompt:**
```
Does the following molecule penetrate the blood-brain barrier?

{{MOLECULE}}

Respond with "yes" or "no".

Answer:
```

**Expected answer:**
```
yes
```

**Scoring:** AUC-ROC.

---

### 2.4 Clinical Toxicity (ClinTox)

**Dataset:** 1,478 compounds — FDA-approved vs failed clinical trials for toxicity.

**Prompt:**
```
Is the following molecule likely to fail clinical trials due to toxicity?

{{MOLECULE}}

Respond with "yes" or "no".

Answer:
```

**Expected answer:**
```
no
```

**Scoring:** AUC-ROC.

---

### 2.5 Bioactivity (BACE)

**Dataset:** 1,513 compounds with binary labels for BACE-1 inhibition.

**Prompt:**
```
Is the following molecule an inhibitor of beta-secretase 1 (BACE-1)?

{{MOLECULE}}

Respond with "yes" or "no".

Answer:
```

**Expected answer:**
```
yes
```

**Scoring:** AUC-ROC.

---

## Tier 3 — Generative & Compositional

These tasks test whether code form helps LLMs generate, modify, and compose molecules. All generative tasks request output in SMILES regardless of input representation, to keep scoring consistent.

---

### 3.1 Molecule Completion

**Dataset:** 500 molecules from ZINC250k, each truncated to create a partial molecule.

**Source:** [ZINC database](https://zinc.docking.org/) — ZINC250k subset available via [Kaggle](https://www.kaggle.com/datasets/basu369victor/zinc250k), DeepChem (`deepchem.molnet.load_zinc15()`), or the [MolGen repo](https://github.com/zjunlp/MolGen) which includes `zinc250k.csv`.

**Prompt:**
```
The following molecule is incomplete. Complete it to form a valid, chemically plausible molecule.

{{PARTIAL_MOLECULE}}

Respond with the complete molecule in SMILES notation.

Answer:
```

**Expected answer:**
```
CCc1ccc(O)cc1
```

**Scoring:** Validity % (parseable by RDKit), SA score, Tanimoto similarity to original.

**Corruption strategy:**
- SMILES: truncate at a random bond position
- Code: remove one or more constructor arguments (e.g., drop an `.attach()` call, remove elements from a `Linear` array, reduce `Ring` size)

---

### 3.2 Analog Generation

**Dataset:** 200 approved drugs from ChEMBL (filter `max_phase=4`).

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/) — query approved drugs via API: `https://www.ebi.ac.uk/chembl/api/data/molecule?max_phase=4`

**Prompt:**
```
Propose 3 structural analogs of the following molecule. Each analog should be a valid molecule that differs by a small structural modification (e.g., substituent swap, ring replacement, chain extension).

{{MOLECULE}}

Respond with a JSON array of 3 SMILES strings.

Answer:
```

**Expected answer:**
```json
["CC(=O)Oc1ccccc1C(=O)N", "CC(=O)Oc1ccc(F)cc1C(=O)O", "CCC(=O)Oc1ccccc1C(=O)O"]
```

**Scoring:** Validity %, mean Tanimoto similarity to parent (target 0.5–0.9), pairwise diversity.

---

### 3.3 Scaffold Hopping

**Dataset:** 200 molecules from ChEMBL with Murcko scaffolds extracted via RDKit.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/) + RDKit `MurckoScaffold.GetScaffoldForMol()`

**Prompt:**
```
Replace the core scaffold of the following molecule with a different scaffold, while preserving all substituents.

{{MOLECULE}}

The current core scaffold is: {{SCAFFOLD_SMILES}}

Respond with the modified molecule in SMILES notation.

Answer:
```

**Expected answer:**
```
CC(=O)Nc1ccncc1C(=O)O
```

**Scoring:** Validity %, substituent preservation accuracy, scaffold difference (Murcko scaffold Tanimoto < 1.0).

---

### 3.4 Instruction Following

**Dataset:** 300 (molecule, instruction, expected output) triples. Manually curated from ChEMBL molecules.

**Source:** [ChEMBL database](https://www.ebi.ac.uk/chembl/) — molecules selected manually; instructions and expected outputs hand-authored.

**Prompt:**
```
Modify the following molecule according to the instruction.

{{MOLECULE}}

Instruction: {{INSTRUCTION}}

Respond with the modified molecule in SMILES notation.

Answer:
```

**Example instructions:**
- "Add a fluorine atom to the para position of the phenyl ring"
- "Replace the hydroxyl group with an amine"
- "Add a methyl group to nitrogen atom 3"
- "Convert the ester to an amide"
- "Extend the carbon chain by 2 atoms"

**Expected answer:**
```
CC(=O)Oc1ccc(F)cc1C(=O)O
```

**Scoring:** Exact structure match (canonical SMILES), partial credit via Tanimoto similarity.

---

### 3.5 SMILES Repair

**Dataset:** 500 molecules from ZINC250k, programmatically corrupted.

**Source:** [ZINC250k](https://www.kaggle.com/datasets/basu369victor/zinc250k) — corrupt programmatically, keep originals as ground truth.

**Prompt:**
```
The following SMILES string is invalid. Fix it to produce a valid molecule that is as close as possible to the intended structure.

{{CORRUPTED_SMILES}}

Respond with the corrected SMILES string.

Answer:
```

**Example corruptions:**
- Missing ring closure: `c1ccccc` → `c1ccccc1`
- Unbalanced parentheses: `CC(=O(Oc1ccccc1)` → `CC(=O)Oc1ccccc1`
- Invalid valence: `C(C)(C)(C)(C)C` → `CC(C)(C)C`

**Expected answer:**
```
c1ccccc1
```

**Scoring:** Validity %, exact match to intended molecule.

**Code variant corruption:** Wrong `size` in `Ring()`, missing elements in `Linear([])`, invalid `.attach()` position.

---

### 3.6 Description → Structure

**Dataset:** 500 molecule-description pairs from the Mol-Instructions dataset (molecule-oriented subset, "description guided molecule design" task).

**Source:** [zjunlp/Mol-Instructions on HuggingFace](https://huggingface.co/datasets/zjunlp/Mol-Instructions) — CC BY 4.0 license. Paper: [Fang et al. "Mol-Instructions" (ICLR 2024)](https://arxiv.org/abs/2306.08018). GitHub: [zjunlp/Mol-Instructions](https://github.com/zjunlp/Mol-Instructions).

**Prompt:**
```
Convert the following natural language description into a molecule.

"{{DESCRIPTION}}"

Respond with the molecule in SMILES notation.

Answer:
```

**Example description:**
"A six-membered aromatic ring with a hydroxyl group at position 1 and a carboxyl group at position 4"

**Expected answer:**
```
Oc1ccc(C(=O)O)cc1
```

**Scoring:** Exact match (canonical SMILES), Tanimoto similarity, functional group match F1.

---

## Dataset Summary

| Dataset | Tasks | Size | Download |
|---|---|---|---|
| **ChEMBL** | 1.1–1.6, 3.2–3.4 | Various subsets | [ebi.ac.uk/chembl](https://www.ebi.ac.uk/chembl/) / [Downloads](https://chembl.gitbook.io/chembl-interface-documentation/downloads) / `pip install chembl_webresource_client` |
| **MoleculeNet (ESOL)** | 2.1 | 1,128 | [HuggingFace](https://huggingface.co/datasets/katielink/moleculenet-benchmark) / `deepchem.molnet.load_delaney()` |
| **MoleculeNet (Lipophilicity)** | 2.2 | 4,200 | [HuggingFace](https://huggingface.co/datasets/katielink/moleculenet-benchmark) / `deepchem.molnet.load_lipo()` |
| **MoleculeNet (BBBP)** | 2.3 | 2,039 | [HuggingFace](https://huggingface.co/datasets/katielink/moleculenet-benchmark) / `deepchem.molnet.load_bbbp()` |
| **MoleculeNet (ClinTox)** | 2.4 | 1,478 | [HuggingFace](https://huggingface.co/datasets/katielink/moleculenet-benchmark) / `deepchem.molnet.load_clintox()` |
| **MoleculeNet (BACE)** | 2.5 | 1,513 | [HuggingFace](https://huggingface.co/datasets/katielink/moleculenet-benchmark) / `deepchem.molnet.load_bace_classification()` |
| **ZINC250k** | 3.1, 3.5 | 250,000 | [Kaggle](https://www.kaggle.com/datasets/basu369victor/zinc250k) / [zinc.docking.org](https://zinc.docking.org/) / `deepchem.molnet.load_zinc15()` |
| **Mol-Instructions** | 3.6 | 148K (molecule subset) | [HuggingFace](https://huggingface.co/datasets/zjunlp/Mol-Instructions) / [GitHub](https://github.com/zjunlp/Mol-Instructions) |

---

## Ablation Analysis

The relabeling ablation decomposes the conjecture into two testable claims:

| Claim | Test | Supported if |
|---|---|---|
| **Code structure helps** | `smiles` vs `code` | `code` significantly outperforms `smiles` |
| **Semantic naming helps further** | `code` vs `code+relabel` | `code+relabel` significantly outperforms `code` |
| **Combined effect** | `smiles` vs `code+relabel` | Measures the full benefit of code + forced structural reasoning |

**Interpretation guide:**

- `code+relabel` >> `code` > `smiles` → LLM benefits both from explicit structure *and* from being forced to reason about what each part is before answering.
- `code+relabel` ≈ `code` > `smiles` → Structure alone is sufficient; naming is cosmetic.
- `code+relabel` >> `code` ≈ `smiles` → The benefit comes from the reasoning step, not the code form. Code merely serves as a scaffold for that reasoning.

---

## Models

Run on at least 3 model families to test generality:

- **Claude** (Sonnet 4.5 / Opus 4.5) — via Anthropic API
- **GPT-4o / GPT-4.1** — via OpenAI API
- **Gemini 2.5 Pro** — via Google API
- *Optional:* An open-weights model (e.g. Llama 4, Qwen 3) for reproducibility

---

## Success Criteria

### Primary

The conjecture is supported if `code` representation **statistically significantly outperforms** `smiles` on ≥2/3 of Tier 1 tasks across ≥2 model families (p < 0.05, McNemar's test for classification, paired t-test for regression).

### Secondary

- `code` outperforms `smiles` on ≥3/5 Tier 2 datasets
- `code` yields higher validity rates on Tier 3 generative tasks
- The effect is consistent across model families (not model-specific)

---

## Key Metrics per Tier

| Tier | Expected Δ (code vs SMILES) | Rationale |
|------|----------------------------|-----------|
| **Tier 1 — Structural** | **Large** (+10–30% accuracy) | Code explicitly encodes rings, branches, and groups that SMILES leaves implicit |
| **Tier 2 — Property** | **Small–Medium** (+2–8% AUC) | Properties are statistical; code helps only insofar as structure-reasoning matters |
| **Tier 3 — Generative** | **Medium–Large** (+10–20% validity) | Composable code is easier to modify correctly than flat strings |

---

## Response Parsing

All expected answers are constrained to simple formats to minimize parsing failures.

1. Strip leading/trailing whitespace and markdown code fences
2. For JSON: find the first `[` or `{` and parse from there
3. For yes/no: lowercase, check substring match
4. For numeric: extract first float-like pattern via regex
5. Log unparseable responses as `null`, exclude from metrics, report parse failure rate separately

---

## License

MIT License

## Citation

```bibtex
@software{smiles_js_eval,
  title={smiles-js-eval: Evaluating Code vs String Representations of Molecules for LLM Reasoning},
  url={https://github.com/Ghost---Shadow/smiles-js-eval},
  year={2025}
}
```

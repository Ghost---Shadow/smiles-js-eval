# Observations

## Full Run: n=100, Sonnet 4.5

### Ring Count

| Condition | Accuracy |
|---|---|
| smiles | **92%** (92/100) |
| code | 76% (76/100) |
| code+relabel | 74% (74/100) |

- smiles wins decisively. 16-point gap over code.
- code+relabel does NOT help — 74% is slightly worse than code (76%). The relabeling step doesn't recover the Ring() constructor confusion; at n=100 it may even add noise.
- Root cause confirmed at scale: model overcounts `Ring()` constructors as independent rings when they're fused ring closures.

### BBBP

| Condition | Accuracy | Balanced Acc | TP | FP | TN | FN |
|---|---|---|---|---|---|---|
| smiles | 59% | 59% | 23 | 14 | 36 | 27 |
| code | 54% | 54% | 10 | 6 | 44 | 40 |
| **code+relabel** | **62%** | **62%** | 18 | 6 | 44 | 32 |

- code+relabel wins marginally (62% vs 59% smiles vs 54% code).
- code alone is worst — heavy "no" bias (only 10 TPs out of 50 positives).
- code+relabel fixes some of code's false negatives (18 TP vs 10 TP) while keeping false positives low (6 FP).
- smiles has most false positives (14 FP) — it hallucinate BBB penetration more freely.
- All conditions near chance (50%). BBBP is fundamentally hard for zero-shot LLMs.
- The 3-point edge for code+relabel over smiles is not clearly significant at n=100.

### SMILES Repair

| Condition | Validity | Exact Match | Parse Failures |
|---|---|---|---|
| smiles | 57% (45/79) | **28%** (22/79) | 21 |
| code | 50% (45/90) | 0% (0/90) | 10 |
| code+relabel | 46% (39/84) | 0% (0/84) | 16 |

- smiles is the only condition that achieves any exact matches (28%).
- Validity rates are similar across conditions (~50%), but code conditions produce 0% exact match — the model can generate valid SMILES from code, but never the correct original.
- smiles has more parse failures (21 vs 10) — model gives more verbose reasoning for SMILES repair, harder to extract answer. But when parseable, smiles is far more accurate.
- Code conditions never reconstruct the original molecule. The mental compilation of code → SMILES loses structural fidelity.

---

## Summary Table (n=100)

| Task | Best Condition | smiles | code | code+relabel |
|---|---|---|---|---|
| Ring Count | **smiles** | **92%** | 76% | 74% |
| BBBP (bal. acc) | **code+relabel** | 59% | 54% | **62%** |
| SMILES Repair (exact) | **smiles** | **28%** | 0% | 0% |

### Verdict

**Hypothesis not supported for 2/3 tasks.** SMILES wins ring count and repair decisively. code+relabel has a marginal edge on BBBP (3 points) but this is the one task where all conditions are near chance level anyway.

### Key insights

1. **Model has strong SMILES priors.** Sonnet 4.5 has extensive SMILES training data. The code representation is unfamiliar and introduces overhead without proportional benefit.
2. **Ring() constructor is ambiguous.** Both standalone and fused rings use `Ring()`, confusing the model's ring counting.
3. **Code → SMILES compilation is unreliable.** The model can't mentally execute smiles-js code to produce correct SMILES, making repair impossible.
4. **Relabeling helps only for BBBP.** The forced reasoning step benefits the more ambiguous property prediction task but hurts or is neutral for structural tasks where SMILES is already clear.

### What might change the results

- Adding smiles-js API documentation to the system prompt (few-shot)
- Using a code-native task (output code, not SMILES)
- Testing on tasks where SMILES is genuinely opaque (symmetry, 3D structure)
- Testing on models with less SMILES pretraining

---

## Haiku Qualitative Probing — "High Heels" Study

We pivoted to interactive probing with Haiku to find *where code representation gives Haiku a boost it wouldn't otherwise have*. 15 probes across 6 task types, each tested with both SMILES and code. Full data in `data/haiku-probes.json`.

### Master Results Table (n=15)

| # | Task | Molecule | Truth | SMILES | Code | Winner |
|---|------|----------|-------|--------|------|--------|
| 1 | Aromatic ring count | Purine+2 benzenes (row 27) | 4 | 3 ✗ | **4** ✓ | **Code** |
| 2 | Aromatic ring count | Benzodifuran (row 53) | 3 | 2 ✗ | **3** ✓ | **Code** |
| 3 | Aromatic ring count | Coumarin-furan (row 0) | 3 | 2 ✗ | **3** ✓ | **Code** |
| 4 | Aromatic ring count | Purine+benzene (row 26) | 3 | **3** ✓ | 4 ✗ | SMILES |
| 5 | Arom ring + relabel | Same molecule (row 26) | 3 | — | **3** ✓ | **Code+relabel** |
| 6 | Scaffold recognition | Diaminoquinazoline (row 37) | quinazoline | benzimidazole ✗ | **quinazoline** ✓ | **Code** |
| 7 | Func group detection | 4-group molecule (FG row 37) | hydroxyl,carboxyl,amide,nitro | **4/4** ✓ | 3/4 + 2 FP ✗ | SMILES |
| 8 | Molecule identification | Ergot alkaloid (BBBP row 16) | bromocriptine | indinavir ✗ | indinavir ✗ | Tie (both wrong) |
| 9 | Aromatic ring count | 1 arom + 2 non-arom fused (row 84) | 1 | 2 ✗ | **1** ✓ | **Code** |
| 10 | Scaffold recognition | Bis-indolyl uracil (FG row 18) | bis-indolyl-uracil | indazolopyrimidine ✗ | **bis-indolyl-uracil** ✓ | **Code** |
| 11 | Stereocenter count | Beta-lactam (BBBP row 17) | 3 | **3** ✓ | hallucinated ✗ | SMILES |
| 12 | H-bond count (peptide) | Pentapeptide (HB row 68) | hbd=7, hba=6 | hbd=12 ✗ | **hbd=7, hba=6** ✓ | **Code** |
| 13 | Scaffold recognition | Imidazole hub (FG row 13) | imidazole | ✓ (rambling) | ✓ (crisp) | Tie (code cleaner) |
| 14 | Amide bond count | Pentapeptide (FG row 53) | 5 | **5** ✓ | 3 ✗ | SMILES |
| 15 | Ring size discrimination | Thiohydantoin+benzene+oxazole (row 46) | 4 rings, mixed sizes | ✓ all correct | ✓ all correct | Tie |

### Scorecard

| | Code wins | SMILES wins | Tie |
|---|---|---|---|
| **Count** | **7** | **4** | 4 |

### When Code is the "High Heels" (7 cases)

Code wins follow **three clear patterns**:

**Pattern 1: Fused ring counting (probes 1, 2, 3, 9)**
When rings are fused, SMILES compresses them into `c1c2...c12` notation that Haiku can't parse reliably. Code's `FusedRing([ring1, ring2, ring3])` lists each ring as a discrete Fragment, making counting trivial. Especially powerful for:
- Heterocyclic fusions (furans, coumarins) where SMILES ring-closure digits are nested
- Mixed aromatic/non-aromatic fused systems (row 84: `Fragment('c1cc(ccc1)')` vs `Fragment('c2cOCC2')` — case difference is obvious in code)

**Pattern 2: Scaffold recognition (probes 6, 10)**
SMILES compresses fused ring systems into opaque strings. Code's `.fuse()` operation explicitly names what's being fused:
- `diaminopyrimidine.fuse(benzene)` → obviously quinazoline. SMILES `c1nc(N)c2c(...)cccc2n1` → Haiku guessed benzimidazole (wrong).
- `indole.fuse(benzene)` × 2 + `pyrimidinedione` → obviously bis-indolyl-uracil. SMILES `Cn1cc(...)c2ccccc21` → Haiku guessed indazolopyrimidine (wrong).

**Pattern 3: Counting repeating units in long chains (probe 12)**
Peptide chains in SMILES are walls of text. Haiku double-counted NH donors (12 vs 7). Code decomposed the chain into backbone fragments + 6 explicit `Linear(['O'],['='])` carbonyls, making the count mechanical.

### When SMILES Wins (4 cases)

SMILES wins follow **two clear patterns**:

**Pattern A: Functional groups and inline patterns (probes 7, 14)**
SMILES keeps functional groups recognizable as contiguous substrings: `C(=O)N` = amide, `[N+](=O)[O-]` = nitro, `C(=O)O` = carboxyl. Code splits these across fragments — `Fragment('NC')` looks like methylamine, `Linear(['O'],['='])` is just a carbonyl that could be anything.

**Pattern B: Stereocenters and atom-level notation (probe 11)**
`[C@H]` and `[C@@H]` are atom-level SMILES annotations. Code fragments still contain these same SMILES annotations internally — no structural advantage. The code wrapper just adds noise.

### When Code Overcounts (probes 4, and rows 26/29 from batch)

Code's `.fuse()` can confuse Haiku into counting the fused system as 2 separate rings AND the original fragments. The **code+relabel** condition fixes this (probe 5): forcing Haiku to name fragments (`pyrimidineRing`, `imidazoleRing`) before counting prevents double-counting.

### The "High Heels" Principle

Code representation helps Haiku when the task requires **enumerating structural units that SMILES compresses**:
- Rings inside fused systems (SMILES: `c1c2...c12` → opaque; Code: `FusedRing([a, b, c])` → countable)
- Named scaffolds from fused components (SMILES: one long string; Code: `pyrimidine.fuse(benzene)` → quinazoline)
- Repeating units in chains (SMILES: wall of text; Code: N × `Linear(['O'],['='])` → countable)

Code representation hurts when the task requires **pattern matching within atoms or bonds**:
- Functional group recognition (SMILES: `C(=O)N` is one token; Code: split across fragments)
- Stereocenter counting (SMILES: `@`/`@@` markers; Code: same markers buried in fragments)
- Amide bond counting (SMILES: `C(=O)N` repeats are greppable; Code: carbonyls detached from N)

**The fundamental tradeoff**: Code is a *tree decomposition* of a *string*. Trees are better for counting nodes (rings, units). Strings are better for pattern matching (functional groups, stereocenters).

### Implications for smiles-js

1. **Fragment granularity matters.** Splitting `C(=O)O` into `Fragment('CO')` + `Linear(['O'],['='])` destroys the carboxyl pattern. Preserving functional groups as atomic fragments would help.
2. **FusedRing() is the killer feature.** It's the primary driver of code advantage — explicitly enumerating constituent rings.
3. **Code+relabel is underrated.** It fixed code's overcounting problem (probe 5) by forcing semantic naming before reasoning. Worth testing at scale.
4. **Best of both worlds?** A hybrid representation — SMILES for atom-level patterns, code tree for ring/chain topology — could combine the strengths.

---

## Qwen 1.5B Results (partial, 5/9 conditions)

| Task | Condition | Score | Notes |
|------|-----------|-------|-------|
| Ring Count | smiles | 8% | Always answers "6" |
| Ring Count | code | 0% | |
| Ring Count | code+relabel | 1% | |
| BBBP | smiles | 50% | Degenerate — always "no" |
| BBBP | code | 48% | |

Qwen 1.5B is too small for any chemistry reasoning. Run aborted (GPU overheating at 82°C).

---

## Parser fixes applied

1. `parseInteger` — take **last** integer (CoT numbered lists polluted first-match).
2. `parseYesNo` — check **last line**, then last occurrence (CoT mentions both yes/no).
3. `parseSmiles` — backtick extraction + take last match (model wraps SMILES in inline backticks).
4. `max_tokens` — 256 → 1024 (CoT truncation).

---

## Pilot Run: n=5 (archived)

Initial pilot with 5 rows confirmed the same directional trends that held at n=100. Useful for fast iteration on parser bugs. Not statistically meaningful.

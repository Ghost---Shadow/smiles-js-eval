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

## Parser fixes applied

1. `parseInteger` — take **last** integer (CoT numbered lists polluted first-match).
2. `parseYesNo` — check **last line**, then last occurrence (CoT mentions both yes/no).
3. `parseSmiles` — backtick extraction + take last match (model wraps SMILES in inline backticks).
4. `max_tokens` — 256 → 1024 (CoT truncation).

---

## Pilot Run: n=5 (archived)

Initial pilot with 5 rows confirmed the same directional trends that held at n=100. Useful for fast iteration on parser bugs. Not statistically meaningful.

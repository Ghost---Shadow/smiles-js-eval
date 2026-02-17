"""
Local HuggingFace model runner for smiles-js-eval.
Loads model with 4-bit quantization, runs inference on GPU.
JS scoring module handles scoring separately.

Usage (run via conda):
  conda run -n base python src/eval/hf_runner.py --task ring-count --condition smiles --limit 5
  conda run -n base python src/eval/hf_runner.py --task ring-count
  conda run -n base python src/eval/hf_runner.py
"""

import argparse
import json
import os
import sys

import torch
from tqdm import tqdm
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct"
MAX_TOKENS = 1024

TASKS = ["bbbp", "func-group", "aromatic-rings", "hbond"]
CONDITIONS = ["smiles", "code", "code+relabel"]

PROMPTS = {
    "bbbp": 'Does the following molecule penetrate the blood-brain barrier?\n\n{molecule}\n\nRespond with "yes" or "no".\n\nAnswer:',
    "relabel": 'The following code constructs a molecule using the smiles-js library. The variable names are auto-generated and not meaningful. Rename all variables to reflect what each part of the molecule is (e.g., phenylRing, methylBranch, acetylGroup, amideBond). Do not change any logic, only variable names.\n\n{code}\n\nAnswer:',
    "func-group": 'Which of the following functional groups are present in this molecule?\n\n{molecule}\n\nPossible groups: hydroxyl (-OH), carboxyl (-COOH), amine (-NH2), amide (-C(=O)NH-), ester (-C(=O)O-C), ether (C-O-C), nitro (-NO2), halide (-F/-Cl/-Br/-I)\n\nRespond with ONLY a comma-separated list of the group names that are present. For example: hydroxyl, amine, halide\n\nAnswer:',
    "aromatic-rings": "How many aromatic rings are in the following molecule?\n\n{molecule}\n\nRespond with a single integer.\n\nAnswer:",
    "hbond": "How many hydrogen bond donors and hydrogen bond acceptors does this molecule have?\n\n{molecule}\n\nRespond in the format: donors=X, acceptors=Y\n\nAnswer:",
}


def load_model(model_id):
    print(f"Loading {model_id} with 4-bit quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
    )
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_config,
        device_map="auto",
    )
    print(f"Model loaded. Device: {model.device}")
    return model, tokenizer


def load_dataset(task):
    path = os.path.join("data", f"{task}.json")
    with open(path) as f:
        return json.load(f)


def get_prompt(task, condition, row):
    mol = row["smiles"] if condition == "smiles" else row["code"]
    return PROMPTS[task].format(molecule=mol)


def generate(model, tokenizer, prompt):
    messages = [{"role": "user", "content": prompt}]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_TOKENS,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    return response


def run_task(model, tokenizer, task, condition, dataset):
    results = []

    for i, row in enumerate(tqdm(dataset, desc=f"{task}/{condition}", unit="row")):
        try:
            if condition == "code+relabel":
                relabel_prompt = PROMPTS["relabel"].format(code=row["code"])
                relabeled = generate(model, tokenizer, relabel_prompt)
                task_prompt = get_prompt(task, "code", {**row, "code": relabeled})
                answer = generate(model, tokenizer, task_prompt)
                results.append({"index": i, "rawResponse": answer, "relabeled": relabeled, "parsed": None})
            else:
                prompt = get_prompt(task, condition, row)
                answer = generate(model, tokenizer, prompt)
                results.append({"index": i, "rawResponse": answer, "parsed": None})
        except Exception as e:
            print(f"  Error on row {i}: {e}", file=sys.stderr)
            results.append({"index": i, "error": str(e), "parsed": None})

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", choices=TASKS, default=None)
    parser.add_argument("--condition", choices=CONDITIONS, default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL)
    parser.add_argument("--skip-existing", action="store_true", help="Skip tasks whose result file already exists")
    args = parser.parse_args()

    tasks = [args.task] if args.task else TASKS
    conditions = [args.condition] if args.condition else CONDITIONS
    model_id = args.model

    model, tokenizer = load_model(model_id)
    model_tag = model_id.split("/")[-1].lower()
    os.makedirs("results", exist_ok=True)

    for task in tasks:
        print(f"\n=== Task: {task} ({model_tag}) ===")
        dataset = load_dataset(task)
        if args.limit:
            dataset = dataset[:args.limit]

        for condition in conditions:
            filename = f"results/{task}_{condition.replace('+', '-')}_{model_tag}.json"
            if args.skip_existing and os.path.exists(filename):
                print(f"\n--- Skipping {condition} (file exists: {filename}) ---")
                continue
            print(f"\n--- Condition: {condition} ---")
            results = run_task(model, tokenizer, task, condition, dataset)

            with open(filename, "w") as f:
                json.dump({"model": model_id, "results": results}, f, indent=2)
            print(f"  Wrote {filename}")


if __name__ == "__main__":
    main()

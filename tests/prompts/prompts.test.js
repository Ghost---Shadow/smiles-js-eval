import { describe, it, expect } from "bun:test";
import { ringCountPrompt } from "../../src/prompts/ring-count.js";
import { bbbpPrompt } from "../../src/prompts/bbbp.js";
import { smilesRepairPrompt, codeRepairPrompt } from "../../src/prompts/smiles-repair.js";
import { relabelPrompt } from "../../src/prompts/relabel.js";

describe("ringCountPrompt", () => {
  it("includes molecule in prompt", () => {
    const p = ringCountPrompt("c1ccccc1");
    expect(p).toContain("c1ccccc1");
    expect(p).toContain("How many rings");
    expect(p).toContain("single integer");
  });
});

describe("bbbpPrompt", () => {
  it("includes molecule in prompt", () => {
    const p = bbbpPrompt("CCO");
    expect(p).toContain("CCO");
    expect(p).toContain("blood-brain barrier");
    expect(p).toContain("yes");
  });
});

describe("smilesRepairPrompt", () => {
  it("includes corrupted SMILES", () => {
    const p = smilesRepairPrompt("c1ccccc");
    expect(p).toContain("c1ccccc");
    expect(p).toContain("invalid");
  });
});

describe("codeRepairPrompt", () => {
  it("includes corrupted code", () => {
    const p = codeRepairPrompt("Ring({ atoms: 'c', size: 5 })");
    expect(p).toContain("size: 5");
    expect(p).toContain("error");
  });
});

describe("relabelPrompt", () => {
  it("includes code and instructions", () => {
    const p = relabelPrompt("const molecule1 = Ring({ atoms: 'c', size: 6 });");
    expect(p).toContain("molecule1");
    expect(p).toContain("Rename all variables");
  });
});

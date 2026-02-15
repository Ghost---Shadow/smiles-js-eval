import { describe, it, expect } from "bun:test";
import { corruptSmiles, corruptCode } from "../../src/data-prep/corrupt-smiles.js";

describe("corruptSmiles", () => {
  it("produces a corrupted SMILES different from the original", () => {
    const result = corruptSmiles("c1ccccc1");
    expect(result).not.toBeNull();
    expect(result.corrupted).not.toBe("c1ccccc1");
    expect(result.corruptionType).toBeTruthy();
  });

  it("handles molecules with parentheses", () => {
    const result = corruptSmiles("CC(=O)O");
    expect(result).not.toBeNull();
    expect(result.corrupted).not.toBe("CC(=O)O");
  });
});

describe("corruptCode", () => {
  it("corrupts Ring size", () => {
    const code = "const r = Ring({ atoms: 'c', size: 6 });";
    const result = corruptCode(code);
    expect(result).not.toBeNull();
    expect(result.corrupted).not.toBe(code);
  });

  it("corrupts Linear elements", () => {
    const code = "const l = Linear(['C', 'C', 'O']);";
    const result = corruptCode(code);
    expect(result).not.toBeNull();
    expect(result.corrupted).not.toBe(code);
  });
});

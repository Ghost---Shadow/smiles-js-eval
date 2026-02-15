import { describe, it, expect } from "bun:test";
import { smilesToCode } from "../../src/data-prep/to-code.js";

describe("smilesToCode", () => {
  it("converts benzene SMILES to code", () => {
    const code = smilesToCode("c1ccccc1");
    expect(code).toContain("Ring");
    expect(code).toContain("size: 6");
  });

  it("converts linear chain to code", () => {
    const code = smilesToCode("CCC");
    expect(code).toContain("Linear");
  });

  it("returns null for invalid SMILES", () => {
    const code = smilesToCode("not_a_smiles_XYZ!!!");
    expect(code).toBeNull();
  });
});

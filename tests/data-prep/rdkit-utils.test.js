import { describe, it, expect } from "bun:test";
import { getRingCount, isValidSmiles, canonicalize } from "../../src/data-prep/rdkit-utils.js";

describe("getRingCount", () => {
  it("returns 1 for benzene", async () => {
    expect(await getRingCount("c1ccccc1")).toBe(1);
  });

  it("returns 2 for naphthalene", async () => {
    expect(await getRingCount("c1ccc2ccccc2c1")).toBe(2);
  });

  it("returns 0 for ethanol", async () => {
    expect(await getRingCount("CCO")).toBe(0);
  });

  it("returns null for invalid SMILES", async () => {
    expect(await getRingCount("invalid!!!")).toBeNull();
  });
});

describe("isValidSmiles", () => {
  it("returns true for valid SMILES", async () => {
    expect(await isValidSmiles("CCO")).toBe(true);
  });

  it("returns false for invalid SMILES", async () => {
    expect(await isValidSmiles("XYZ!!!")).toBe(false);
  });
});

describe("canonicalize", () => {
  it("canonicalizes SMILES", async () => {
    const canonical = await canonicalize("OCC");
    expect(canonical).toBe("CCO");
  });

  it("returns null for invalid SMILES", async () => {
    expect(await canonicalize("invalid!!!")).toBeNull();
  });
});

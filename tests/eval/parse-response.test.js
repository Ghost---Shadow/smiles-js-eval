import { describe, it, expect } from "bun:test";
import {
  parseInteger,
  parseYesNo,
  parseSmiles,
} from "../../src/eval/parse-response.js";

describe("parseInteger", () => {
  it("extracts integer from plain text", () => {
    expect(parseInteger("3")).toBe(3);
  });

  it("extracts integer from fenced code", () => {
    expect(parseInteger("```\n5\n```")).toBe(5);
  });

  it("extracts last integer from CoT response", () => {
    expect(
      parseInteger(
        "1. First ring is benzene\n2. Second ring is pyridine\n3. Third ring\n\nThe molecule has 3 rings.\n\n3",
      ),
    ).toBe(3);
  });

  it("extracts last integer from surrounding text", () => {
    expect(parseInteger("The molecule has 2 rings")).toBe(2);
  });

  it("returns null for non-numeric", () => {
    expect(parseInteger("no number here")).toBeNull();
  });
});

describe("parseYesNo", () => {
  it("extracts yes", () => {
    expect(parseYesNo("Yes")).toBe("yes");
  });

  it("extracts no from sentence", () => {
    expect(parseYesNo("No, the molecule does not...")).toBe("no");
  });

  it("extracts yes from fenced code", () => {
    expect(parseYesNo("```\nyes\n```")).toBe("yes");
  });

  it("extracts final yes from CoT with both yes and no", () => {
    expect(
      parseYesNo(
        "It does not have a large MW, which suggests no. But the logP is high.\n\nyes",
      ),
    ).toBe("yes");
  });

  it("returns null for ambiguous", () => {
    expect(parseYesNo("maybe")).toBeNull();
  });
});

describe("parseSmiles", () => {
  it("extracts SMILES from plain text", () => {
    expect(parseSmiles("c1ccccc1")).toBe("c1ccccc1");
  });

  it("extracts SMILES from fenced code", () => {
    expect(parseSmiles("```\nCCO\n```")).toBe("CCO");
  });

  it("extracts SMILES from multiline response", () => {
    expect(parseSmiles("The corrected SMILES is:\nCC(=O)O")).toBe("CC(=O)O");
  });

  it("extracts last backtick-wrapped SMILES from CoT", () => {
    expect(
      parseSmiles(
        "The original was `c1ccccc` which is missing closure.\n\nThe corrected SMILES is:\n\n`c1ccccc1`",
      ),
    ).toBe("c1ccccc1");
  });

  it("returns null for long prose", () => {
    expect(
      parseSmiles(
        "This is a very long description that does not contain any molecule and keeps going on and on with lots of words and spaces to exceed the length limit of two hundred characters so that the fallback also fails",
      ),
    ).toBeNull();
  });
});

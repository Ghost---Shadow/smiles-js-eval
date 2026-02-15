import { describe, it, expect } from "bun:test";
import { binaryMetrics } from "../../src/scoring/auc-roc.js";

describe("binaryMetrics", () => {
  it("computes perfect classification", () => {
    const result = binaryMetrics(
      ["yes", "yes", "no", "no"],
      ["yes", "yes", "no", "no"],
    );
    expect(result).toEqual({
      accuracy: 1,
      balancedAccuracy: 1,
      tp: 2,
      fp: 0,
      tn: 2,
      fn: 0,
      total: 4,
    });
  });

  it("computes all-wrong classification", () => {
    const result = binaryMetrics(
      ["yes", "yes", "no", "no"],
      ["no", "no", "yes", "yes"],
    );
    expect(result).toEqual({
      accuracy: 0,
      balancedAccuracy: 0,
      tp: 0,
      fp: 2,
      tn: 0,
      fn: 2,
      total: 4,
    });
  });

  it("computes mixed classification", () => {
    const result = binaryMetrics(
      ["yes", "no", "yes", "no"],
      ["yes", "yes", "no", "no"],
    );
    expect(result).toEqual({
      accuracy: 0.5,
      balancedAccuracy: 0.5,
      tp: 1,
      fp: 1,
      tn: 1,
      fn: 1,
      total: 4,
    });
  });
});

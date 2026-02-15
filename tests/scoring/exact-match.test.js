import { describe, it, expect } from "bun:test";
import { exactMatchAccuracy } from "../../src/scoring/exact-match.js";

describe("exactMatchAccuracy", () => {
  it("computes perfect accuracy", () => {
    expect(exactMatchAccuracy([1, 2, 3], [1, 2, 3])).toEqual({
      accuracy: 1,
      total: 3,
      correct: 3,
    });
  });

  it("computes partial accuracy", () => {
    expect(exactMatchAccuracy([1, 2, 3], [1, 2, 4])).toEqual({
      accuracy: 2 / 3,
      total: 3,
      correct: 2,
    });
  });

  it("handles empty arrays", () => {
    expect(exactMatchAccuracy([], [])).toEqual({
      accuracy: 0,
      total: 0,
      correct: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import { cosineSimilarity, euclideanDistance } from "./similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("handles normalized vectors correctly", () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    // cos(θ) = 0.6*0.8 + 0.8*0.6 = 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96);
  });
});

describe("euclideanDistance", () => {
  it("returns 0 for identical vectors", () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("returns correct distance for simple case", () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
  });

  it("returns Infinity for mismatched lengths", () => {
    expect(euclideanDistance([1], [1, 2])).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns Infinity for empty vectors", () => {
    expect(euclideanDistance([], [])).toBe(Number.POSITIVE_INFINITY);
  });
});

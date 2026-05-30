import type { EmbeddingRow } from "@radarboard/types/database";
import { describe, expect, it } from "vitest";
import { clusterEmbeddings } from "./clustering";

/** Create a mock embedding row with a known vector. */
function mockRow(id: string, text: string, vector: number[], source = "test"): EmbeddingRow {
  return {
    id,
    source,
    sourceId: id,
    text,
    embedding: JSON.stringify(vector),
    modelId: "text-embedding-3-small",
    dimensions: vector.length,
    projectSlug: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("clusterEmbeddings", () => {
  it("returns empty array for empty input", () => {
    expect(clusterEmbeddings([], { k: 3 })).toEqual([]);
  });

  it("creates 1 cluster when k=1", () => {
    const rows = [
      mockRow("1", "react hooks", [1, 0, 0]),
      mockRow("2", "react context", [0.9, 0.1, 0]),
      mockRow("3", "vue composition", [0, 1, 0]),
    ];

    const clusters = clusterEmbeddings(rows, { k: 1 });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.items).toHaveLength(3);
  });

  it("limits k to row count", () => {
    const rows = [mockRow("1", "aaa", [1, 0]), mockRow("2", "bbb", [0, 1])];

    const clusters = clusterEmbeddings(rows, { k: 10 });
    expect(clusters.length).toBeLessThanOrEqual(2);
  });

  it("separates clearly distinct vectors into different clusters", () => {
    // Two well-separated groups
    const rows = [
      mockRow("1", "react hooks", [1, 0, 0]),
      mockRow("2", "react context", [0.95, 0.05, 0]),
      mockRow("3", "react state", [0.9, 0.1, 0]),
      mockRow("4", "python ml", [0, 0, 1]),
      mockRow("5", "python deep learning", [0, 0.05, 0.95]),
      mockRow("6", "python tensorflow", [0, 0.1, 0.9]),
    ];

    const clusters = clusterEmbeddings(rows, { k: 2 });
    expect(clusters).toHaveLength(2);

    // Each cluster should have 3 items
    const sizes = clusters.map((c) => c.items.length).sort();
    expect(sizes).toEqual([3, 3]);

    // Items within a cluster should have the same source prefix pattern
    for (const cluster of clusters) {
      const texts = cluster.items.map((i) => i.text);
      const allReact = texts.every((t) => t.startsWith("react"));
      const allPython = texts.every((t) => t.startsWith("python"));
      expect(allReact || allPython).toBe(true);
    }
  });

  it("each cluster has a label from its most central item", () => {
    const rows = [
      mockRow("1", "topic A item 1", [1, 0]),
      mockRow("2", "topic A item 2", [0.99, 0.01]),
    ];

    const clusters = clusterEmbeddings(rows, { k: 1 });
    expect(clusters[0]?.label).toBeTruthy();
    expect(clusters[0]?.label.length).toBeGreaterThan(0);
  });

  it("clusters are sorted by size (largest first)", () => {
    const rows = [
      mockRow("1", "a", [1, 0, 0]),
      mockRow("2", "b", [0, 1, 0]),
      mockRow("3", "c", [0, 0.99, 0.01]),
      mockRow("4", "d", [0, 0.98, 0.02]),
    ];

    const clusters = clusterEmbeddings(rows, { k: 2 });
    // Sizes should be descending
    for (let i = 1; i < clusters.length; i++) {
      const previousLength = clusters[i - 1]?.items.length ?? 0;
      const currentLength = clusters[i]?.items.length ?? 0;
      expect(previousLength).toBeGreaterThanOrEqual(currentLength);
    }
  });

  it("items within a cluster have similarity scores", () => {
    const rows = [mockRow("1", "aaa", [1, 0]), mockRow("2", "bbb", [0.9, 0.1])];

    const clusters = clusterEmbeddings(rows, { k: 1 });
    for (const item of clusters[0]?.items ?? []) {
      expect(item.similarity).toBeGreaterThan(0);
      expect(item.similarity).toBeLessThanOrEqual(1);
    }
  });

  it("each cluster has a centroid", () => {
    const rows = [mockRow("1", "aaa", [1, 0, 0]), mockRow("2", "bbb", [0, 1, 0])];

    const clusters = clusterEmbeddings(rows, { k: 2 });
    for (const cluster of clusters) {
      expect(cluster.centroid).toBeDefined();
      expect(cluster.centroid.length).toBe(3);
    }
  });
});

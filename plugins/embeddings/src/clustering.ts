/**
 * Topic clustering using K-means over embedding vectors.
 *
 * Groups semantically similar items into clusters and assigns
 * each cluster a representative label from its most central item.
 */

import { cosineSimilarity } from "@radarboard/embedding-service/similarity";
import type { EmbeddingRow } from "@radarboard/types/database";
import type { ClusterItem, TopicCluster } from "./types";

// ---------------------------------------------------------------------------
// K-means clustering
// ---------------------------------------------------------------------------

export interface ClusterOptions {
  /** Target number of clusters. */
  k: number;
  /** Maximum iterations (default: 50). */
  maxIterations?: number;
  /** Minimum centroid movement to continue (default: 0.001). */
  convergenceThreshold?: number;
}

/**
 * Cluster embedding rows into k topic groups using K-means.
 * Returns clusters with labels derived from the most central item.
 */
export function clusterEmbeddings(rows: EmbeddingRow[], options: ClusterOptions): TopicCluster[] {
  const { k, maxIterations = 50, convergenceThreshold = 0.001 } = options;

  if (rows.length === 0) return [];

  // Effective k can't exceed row count
  const effectiveK = Math.min(k, rows.length);

  // Parse embedding vectors
  const vectors = rows.map((r) => JSON.parse(r.embedding) as number[]);

  // Initialize centroids using K-means++ seeding
  const centroids = initializeCentroids(vectors, effectiveK);

  // Run K-means iterations
  let assignments = new Array(rows.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each vector to nearest centroid
    const newAssignments = vectors.map((v) => findNearestCentroid(v, centroids));

    // Update centroids
    let maxMovement = 0;
    for (let c = 0; c < effectiveK; c++) {
      const members = vectors.filter((_, i) => newAssignments[i] === c);
      if (members.length === 0) continue;

      const newCentroid = computeCentroid(members);
      const movement = 1 - cosineSimilarity(centroids[c]!, newCentroid);
      maxMovement = Math.max(maxMovement, movement);
      centroids[c] = newCentroid;
    }

    assignments = newAssignments;

    // Check convergence
    if (maxMovement < convergenceThreshold) break;
  }

  // Build cluster objects
  const clusters: TopicCluster[] = [];

  for (let c = 0; c < effectiveK; c++) {
    const memberIndices = assignments.map((a, i) => (a === c ? i : -1)).filter((i) => i !== -1);

    if (memberIndices.length === 0) continue;

    // Score members by similarity to centroid
    const items: ClusterItem[] = memberIndices
      .map((i) => {
        const row = rows[i]!;
        return {
          id: row.id,
          text: row.text,
          source: row.source,
          sourceId: row.sourceId,
          similarity: cosineSimilarity(vectors[i]!, centroids[c]!),
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    // Label from most central item
    const label = items[0]?.text ?? `Cluster ${c + 1}`;

    clusters.push({
      id: crypto.randomUUID(),
      label: label.length > 80 ? `${label.slice(0, 77)}...` : label,
      items,
      centroid: centroids[c]!,
    });
  }

  // Sort clusters by size (largest first)
  return clusters.sort((a, b) => b.items.length - a.items.length);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** K-means++ initialization: spread initial centroids for better convergence. */
function initializeCentroids(vectors: number[][], k: number): number[][] {
  const centroids: number[][] = [];

  // Pick first centroid randomly
  const firstIdx = Math.floor(Math.random() * vectors.length);
  centroids.push([...vectors[firstIdx]!]);

  // Pick subsequent centroids weighted by distance
  for (let i = 1; i < k; i++) {
    const distances = vectors.map((v) => {
      const minDist = Math.min(...centroids.map((c) => 1 - cosineSimilarity(v, c)));
      return minDist * minDist; // Square for probability weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * totalDist;

    let selectedIdx = 0;
    for (let j = 0; j < distances.length; j++) {
      target -= distances[j]!;
      if (target <= 0) {
        selectedIdx = j;
        break;
      }
    }

    centroids.push([...vectors[selectedIdx]!]);
  }

  return centroids;
}

/** Find the index of the nearest centroid to a vector. */
function findNearestCentroid(vector: number[], centroids: number[][]): number {
  let bestIdx = 0;
  let bestSim = -Infinity;

  for (let i = 0; i < centroids.length; i++) {
    const sim = cosineSimilarity(vector, centroids[i]!);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/** Compute the mean centroid of a set of vectors. */
function computeCentroid(vectors: number[][]): number[] {
  const dims = vectors[0]?.length ?? 0;
  const centroid = new Array(dims).fill(0) as number[];

  for (const v of vectors) {
    for (let d = 0; d < dims; d++) {
      centroid[d]! += v[d]!;
    }
  }

  for (let d = 0; d < dims; d++) {
    centroid[d]! /= vectors.length;
  }

  return centroid;
}

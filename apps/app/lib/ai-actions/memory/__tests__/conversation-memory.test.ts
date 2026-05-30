import { afterEach, describe, expect, it } from "vitest";
import {
  deleteInsight,
  recallInsights,
  resetConversationMemory,
  saveInsight,
} from "../conversation-memory";

afterEach(() => {
  resetConversationMemory();
});

describe("conversation memory", () => {
  it("saves and recalls insights", () => {
    saveInsight("revenue_drop", "Revenue dropped 20% on March 15", "anomaly");
    saveInsight("user_pref", "User prefers daily briefings at 8am", "preference");

    const all = recallInsights();
    expect(all).toHaveLength(2);
  });

  it("filters by category", () => {
    saveInsight("a1", "anomaly 1", "anomaly");
    saveInsight("p1", "pref 1", "preference");

    const anomalies = recallInsights("anomaly");
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.category).toBe("anomaly");
  });

  it("respects limit", () => {
    for (let i = 0; i < 10; i++) {
      saveInsight(`key${i}`, `value ${i}`, "finding");
    }
    const limited = recallInsights(undefined, 3);
    expect(limited).toHaveLength(3);
  });

  it("returns most recent first", () => {
    saveInsight("old", "old insight", "finding");
    saveInsight("new", "new insight", "finding");

    const insights = recallInsights();
    expect(insights[0]?.key).toBe("new");
  });

  it("deletes an insight", () => {
    const insight = saveInsight("key", "value", "finding");
    expect(deleteInsight(insight.id)).toBe(true);
    expect(recallInsights()).toHaveLength(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};

const sessionStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};

describe("chat-response-feedback-storage", () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.stubGlobal("sessionStorage", sessionStorageMock);
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates legacy too_long to tooLong and persists", async () => {
    const { getFeedback } = await import("./chat-response-feedback-storage");
    const cid = "conv-1";
    const mid = "msg-1";
    sessionStorageMock.setItem(
      `radarboard.chatResponseFeedback.v1:${cid}`,
      JSON.stringify({
        [mid]: { vote: "down", reasonTag: "too_long", at: 100 },
      })
    );

    const read = getFeedback(cid, mid);
    expect(read?.reasonTag).toBe("tooLong");

    const raw = sessionStorageMock.getItem(`radarboard.chatResponseFeedback.v1:${cid}`);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as Record<string, { reasonTag?: string }>;
    expect(parsed[mid].reasonTag).toBe("tooLong");
  });

  it("drops invalid reason tags and rewrites storage", async () => {
    const { getFeedback } = await import("./chat-response-feedback-storage");
    const cid = "conv-2";
    const mid = "m1";
    sessionStorageMock.setItem(
      `radarboard.chatResponseFeedback.v1:${cid}`,
      JSON.stringify({
        [mid]: { vote: "up", reasonTag: "nope", at: 1 },
      })
    );

    const read = getFeedback(cid, mid);
    expect(read?.vote).toBe("up");
    expect(read?.reasonTag).toBeUndefined();

    const raw = sessionStorageMock.getItem(`radarboard.chatResponseFeedback.v1:${cid}`);
    const parsed = JSON.parse(raw as string) as Record<string, { reasonTag?: string }>;
    expect(parsed[mid].reasonTag).toBeUndefined();
  });

  it("setFeedback removes an entry", async () => {
    const { setFeedback, getFeedback } = await import("./chat-response-feedback-storage");
    const cid = "conv-3";
    const mid = "m2";
    setFeedback(cid, mid, { vote: "up", at: 1 });
    expect(getFeedback(cid, mid)?.vote).toBe("up");
    setFeedback(cid, mid, null);
    expect(getFeedback(cid, mid)).toBeNull();
  });
});

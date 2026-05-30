import type { IntegrationEvent } from "@radarboard/integration-sdk/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEventsSince, pruneExpiredEvents, storeEvents } from "../lib/store.js";

// Mock Redis
function createMockRedis() {
  return {
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
  };
}

const sampleEvent: IntegrationEvent = {
  source: "github",
  sourceEventId: "github:pr:1:opened",
  type: "pr.opened",
  severity: "info",
  title: "PR #1 opened: Test",
  body: "by @test-user",
};

describe("storeEvents", () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it("should not call ZADD when events array is empty", async () => {
    await storeEvents(redis as any, "github", []);
    expect(redis.zadd).not.toHaveBeenCalled();
  });

  it("should call ZADD with correct score and member for a single event", async () => {
    await storeEvents(redis as any, "github", [sampleEvent]);
    expect(redis.zadd).toHaveBeenCalledTimes(1);

    const [key, ...members] = redis.zadd.mock.calls[0] as unknown[];
    expect(key).toBe("relay:_default:events");
    expect(members).toHaveLength(1);

    const member = members[0] as { score: number; member: string };
    expect(member.score).toBeGreaterThan(0);

    const parsed = JSON.parse(member.member);
    expect(parsed.integration).toBe("github");
    expect(parsed.event).toEqual(sampleEvent);
    expect(parsed.id).toBeDefined();
    expect(parsed.receivedAt).toBeGreaterThan(0);
  });

  it("should store multiple events in one ZADD call", async () => {
    const events = [sampleEvent, { ...sampleEvent, type: "pr.merged" }];
    await storeEvents(redis as any, "github", events);

    const [, ...members] = redis.zadd.mock.calls[0] as unknown[];
    expect(members).toHaveLength(2);
  });
});

describe("getEventsSince", () => {
  it("should call zrange with byScore and correct range/limit", async () => {
    const redis = createMockRedis();
    const since = 1700000000000;

    await getEventsSince(redis as any, since, 50);

    expect(redis.zrange).toHaveBeenCalledWith("relay:_default:events", `(${since}`, "+inf", {
      byScore: true,
      count: 50,
      offset: 0,
    });
  });

  it("should return auto-deserialized RelayEvent objects from zrange", async () => {
    const relayEvent = {
      id: "test-id",
      integration: "github",
      event: sampleEvent,
      receivedAt: Date.now(),
    };

    const redis = createMockRedis();
    // @upstash/redis auto-deserializes JSON members, so zrange returns objects
    redis.zrange.mockResolvedValue([relayEvent]);

    const result = await getEventsSince(redis as any, 0, 100);
    expect(result).toHaveLength(1);
    expect(result[0]?.integration).toBe("github");
    expect(result[0]?.event.type).toBe("pr.opened");
  });
});

describe("pruneExpiredEvents", () => {
  it("should remove events older than 24 hours", async () => {
    const redis = createMockRedis();
    await pruneExpiredEvents(redis as any);

    expect(redis.zremrangebyscore).toHaveBeenCalledTimes(1);
    const [key, min, max] = redis.zremrangebyscore.mock.calls[0] as [string, number, number];
    expect(key).toBe("relay:_default:events");
    expect(min).toBe(0);
    // max should be approximately now - 24h
    const expectedCutoff = Date.now() - 24 * 60 * 60 * 1000;
    expect(Math.abs(max - expectedCutoff)).toBeLessThan(1000);
  });
});

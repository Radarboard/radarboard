import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = {
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
};

vi.mock("node:fs", () => ({
  default: {
    existsSync: (...args: unknown[]) => fsMock.existsSync(...args),
    readdirSync: (...args: unknown[]) => fsMock.readdirSync(...args),
    mkdirSync: (...args: unknown[]) => fsMock.mkdirSync(...args),
    writeFileSync: (...args: unknown[]) => fsMock.writeFileSync(...args),
  },
}));

vi.mock("@radarboard/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("@radarboard/logger/middleware", () => ({
  withLogging: (_name: string, handler: (...args: never[]) => unknown) => handler,
}));

import { handleListSounds as GET, handleDownloadSound as POST } from "../sounds";

const fetchMock = vi.fn();

beforeEach(() => {
  for (const fn of Object.values(fsMock)) fn.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */
describe("GET /api/notifications/sounds", () => {
  it("returns list of mp3 files", async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readdirSync.mockReturnValue(["notification-bell.mp3", "alert-chime.mp3", "readme.txt"]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sounds).toHaveLength(2);
    expect(body.sounds[0]).toEqual({
      id: "notification-bell",
      label: "Notification Bell",
      url: "/sounds/notification-bell.mp3",
    });
  });

  it("returns empty array when sounds directory does not exist", async () => {
    fsMock.existsSync.mockReturnValue(false);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sounds).toEqual([]);
  });

  it("capitalizes each word in label", async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readdirSync.mockReturnValue(["soft-ping.mp3"]);

    const res = await GET();
    const body = await res.json();

    expect(body.sounds[0].label).toBe("Soft Ping");
  });
});

/* ------------------------------------------------------------------ */
/*  POST                                                               */
/* ------------------------------------------------------------------ */
describe("POST /api/notifications/sounds", () => {
  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/notifications/sounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("rejects non-SoundCN URLs", async () => {
    const res = await POST(makeRequest({ url: "https://example.com/bad.json" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid/i);
  });

  it("rejects missing url", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 502 when SoundCN fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const res = await POST(makeRequest({ url: "https://www.soundcn.xyz/r/bell.json" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/SoundCN/);
  });

  it("returns 502 when registry JSON has no content", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ files: [{ name: "bell.ts" }] }),
    });

    const res = await POST(makeRequest({ url: "https://www.soundcn.xyz/r/bell.json" }));

    expect(res.status).toBe(502);
  });

  it("saves sound file when valid dataUri is in content", async () => {
    const base64Audio = Buffer.from("fake-audio-data").toString("base64");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            name: "bell.ts",
            content: `export const sound = { dataUri: "data:audio/mpeg;base64,${base64Audio}" }`,
          },
        ],
      }),
    });
    fsMock.existsSync.mockReturnValue(true);

    const res = await POST(makeRequest({ url: "https://www.soundcn.xyz/r/bell.json" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sound.id).toBe("bell");
    expect(body.sound.url).toBe("/sounds/bell.mp3");
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      "apps/app/public/sounds/bell.mp3",
      expect.any(Buffer)
    );
  });

  it("creates sounds directory if it does not exist", async () => {
    const base64Audio = Buffer.from("audio").toString("base64");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            name: "chime.ts",
            content: `export const sound = { dataUri: "data:audio/mpeg;base64,${base64Audio}" }`,
          },
        ],
      }),
    });
    fsMock.existsSync.mockReturnValue(false);

    await POST(makeRequest({ url: "https://www.soundcn.xyz/r/chime.json" }));

    expect(fsMock.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
      recursive: true,
    });
  });
});

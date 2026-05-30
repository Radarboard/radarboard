import { describe, expect, it } from "vitest";
import { parseGitHubUrl } from "../parse-github-url";

describe("parseGitHubUrl", () => {
  describe("full HTTPS URLs", () => {
    it("parses standard GitHub URL", () => {
      expect(parseGitHubUrl("https://github.com/acme/widget-foo")).toEqual({
        owner: "acme",
        repo: "widget-foo",
      });
    });

    it("parses URL with .git suffix", () => {
      expect(parseGitHubUrl("https://github.com/acme/repo.git")).toEqual({
        owner: "acme",
        repo: "repo",
      });
    });

    it("strips branch paths", () => {
      expect(parseGitHubUrl("https://github.com/acme/repo/tree/main")).toEqual({
        owner: "acme",
        repo: "repo",
      });
    });

    it("handles HTTP (non-HTTPS)", () => {
      expect(parseGitHubUrl("http://github.com/acme/repo")).toEqual({
        owner: "acme",
        repo: "repo",
      });
    });
  });

  describe("github.com prefix", () => {
    it("parses domain-prefixed shorthand", () => {
      expect(parseGitHubUrl("github.com/acme/widget-foo")).toEqual({
        owner: "acme",
        repo: "widget-foo",
      });
    });

    it("handles .git suffix", () => {
      expect(parseGitHubUrl("github.com/acme/repo.git")).toEqual({
        owner: "acme",
        repo: "repo",
      });
    });
  });

  describe("owner/repo shorthand", () => {
    it("parses simple shorthand", () => {
      expect(parseGitHubUrl("acme/widget-foo")).toEqual({
        owner: "acme",
        repo: "widget-foo",
      });
    });

    it("handles dots in repo name", () => {
      expect(parseGitHubUrl("acme/my.widget")).toEqual({
        owner: "acme",
        repo: "my.widget",
      });
    });

    it("handles underscores and hyphens", () => {
      expect(parseGitHubUrl("my_org/my-cool_repo")).toEqual({
        owner: "my_org",
        repo: "my-cool_repo",
      });
    });

    it("strips .git from shorthand", () => {
      expect(parseGitHubUrl("acme/repo.git")).toEqual({
        owner: "acme",
        repo: "repo",
      });
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(parseGitHubUrl("")).toBeNull();
    });

    it("returns null for whitespace-only", () => {
      expect(parseGitHubUrl("   ")).toBeNull();
    });

    it("returns null for single word", () => {
      expect(parseGitHubUrl("acme")).toBeNull();
    });

    it("returns null for non-GitHub URLs", () => {
      expect(parseGitHubUrl("https://gitlab.com/acme/repo")).toBeNull();
    });

    it("returns null for URLs without owner/repo", () => {
      expect(parseGitHubUrl("https://github.com/")).toBeNull();
    });

    it("returns null for URLs with only owner", () => {
      expect(parseGitHubUrl("https://github.com/acme")).toBeNull();
    });
  });

  describe("whitespace handling", () => {
    it("trims leading and trailing whitespace", () => {
      expect(parseGitHubUrl("  acme/repo  ")).toEqual({
        owner: "acme",
        repo: "repo",
      });
    });
  });
});

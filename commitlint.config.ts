export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    // Allow Changesets "Version Packages" commit on release branches
    (message: string) => message.startsWith("Version Packages"),
  ],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        // apps
        "app",
        "desktop",
        "docs",
        "storybook",
        "e2e",
        "webhook-relay",
        "marketing",
        // packages
        "charts",
        "feature-sdk",
        "hooks",
        "integration-sdk",
        "types",
        "ui",
        "utils",
        "widget-engine",
        "widget-sdk",
        "plugin-sdk",
        "widgets",
        "integrations",
        "plugins",
        "features",
        "notifications",
        "assistant-core",
        "assistant-ui",
        "mcp-tools",
        "devlogs",
        "logger",
        "llm",
        "llm-adapter-vercel",
        // meta
        "api",
        "deps",
        "ci",
        "repo",
      ],
    ],
    "scope-empty": [2, "never"],
    "subject-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};

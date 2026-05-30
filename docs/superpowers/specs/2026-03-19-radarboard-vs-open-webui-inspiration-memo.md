# Radarboard vs Open WebUI — Inspiration Memo

**Date:** 2026-03-19  
**Status:** Research memo  
**Scope:** Dashboard app package strategy, authoring UX, artifact UX, and workspace flow

---

## Overview

This memo compares Radarboard's current dashboard stack and interaction model with Open WebUI as inspected on 2026-03-19. The goal is not to chase feature parity or copy a general-purpose AI product wholesale. The goal is to identify what Open WebUI gets right that fits Radarboard's existing Next.js, React, Turborepo, and domain-specific dashboard architecture.

The main conclusion is straightforward:

- Radarboard is already stronger on product focus, modular workspace packages, and domain-specific monitoring workflows.
- Open WebUI is stronger on the authoring surface around chat: rich text input, artifacts, embedded viewers, and workspace-to-composer flow.
- The best inspiration path is to borrow the interaction model around authoring and artifacts, not the full execution stack.

Tiptap is the highest-leverage starting point because Radarboard already has multiple text-heavy surfaces that are still plain textarea or markdown-only interfaces.

---

## Radarboard Package Inventory By Subsystem

### Platform and Runtime

Radarboard's foundation is already modern and well-suited to incremental UI upgrades:

- `pnpm` workspace + Turborepo
- Next.js 16
- React 19
- Tailwind CSS 4
- TypeScript 5.9
- Biome
- Vitest

The package layout is lean and intentional. The root stays small while product logic lives in shared workspace packages:

- `packages/charts`
- `packages/devlogs`
- `packages/hooks`
- `packages/integrations`
- `packages/llm`
- `packages/llm-adapter-vercel`
- `packages/logger`
- `packages/mcp-tools`
- `packages/notifications`
- `packages/plugins`
- `packages/types`
- `packages/ui`
- `packages/utils`
- `packages/widgets`

### AI and Data

Radarboard already has a strong AI and typed-data foundation:

- Vercel AI SDK: `ai`, `@ai-sdk/react`, `@ai-sdk/mcp`
- MCP stack: `@modelcontextprotocol/sdk`
- validation: `zod`
- ORM and storage: `drizzle-orm`, `@libsql/client`
- multi-provider DB adapters already in place for assistant data and artifacts

This matters because Radarboard does not need Open WebUI's backend complexity to deliver a better authoring UX. The AI and persistence layers already exist.

### UI and Workspace

Radarboard's current dashboard UI stack is pragmatic and modular:

- shared primitives: Radix UI components in `packages/ui`
- interaction/state: TanStack hotkeys, store, and virtual
- layout/editing: `@dnd-kit/*`
- async data: `swr`
- rendering: `react-markdown`, `react-syntax-highlighter`

This is a good base for a richer internal workspace. The missing layer is not infrastructure. It is authoring ergonomics and richer artifact presentation.

---

## What Radarboard Already Does Better

Before copying anything, it is worth being explicit about what should not change.

### Product Focus

Radarboard is a focused monitoring and operations product. Its package graph reflects that:

- strong domain packages for integrations, widgets, and notifications
- project-aware dashboard workflows
- assistant artifacts tied to real monitoring work instead of general chat experimentation

Open WebUI is a broad AI platform. That breadth creates useful ideas, but it also introduces package weight and UX sprawl that Radarboard should avoid.

### Modularity

Radarboard already has a cleaner internal package boundary than Open WebUI's mostly app-centric frontend:

- shared UI in `packages/ui`
- dashboard data and rendering split across `packages/hooks`, `packages/widgets`, and `packages/types`
- assistant persistence already abstracted behind repository interfaces

That means the right move is a shared React-native authoring layer in `packages/ui`, not feature-specific editors sprinkled across `apps/app`.

### Existing Artifact Model

Radarboard already has durable assistant workflow artifacts and supporting APIs:

- [chat-artifacts.tsx](../../../apps/app/components/chat/chat-artifacts.tsx)
- [ai-tools.ts](../../../apps/app/lib/ai-tools.ts)
- [route.ts](../../../apps/app/app/api/chat/route.ts)
- [assistant-workflows.ts](../../../apps/app/lib/assistant-workflows.ts)

Open WebUI's artifact UI is richer, but Radarboard already has the more product-specific data model. The opportunity is to improve presentation, not rebuild storage.

---

## Current Authoring Surfaces That Are Still Lightweight

The strongest case for Tiptap is not theoretical. Radarboard has several active surfaces still using a plain textarea or markdown-only path.

### Chat Composer

- [chat-composer.tsx](../../../apps/app/components/chat/chat-composer.tsx)

Current behavior:

- textarea-based input
- basic `@project` mention autocomplete
- file content appended into markdown as fenced code blocks
- image attachments handled outside the text surface

This is functional but still treats authoring as a string buffer.

### Chat Output

- [chat-markdown.tsx](../../../apps/app/components/chat/chat-markdown.tsx)

Current behavior:

- markdown rendering is good for final output
- code blocks are nicely handled
- there is no richer viewer path for typed artifact content like HTML or Mermaid

### Notes Plugin

- [notes-overlay.tsx](../../../packages/plugins/src/plugins/notes/components/notes-overlay.tsx)

Current behavior:

- plain title input
- plain textarea for content
- useful persistence, minimal authoring experience

### Project Context Notes

- [project-context-editor.tsx](../../../apps/app/components/projects/project-context-editor/index.tsx)

Current behavior:

- free-form notes are stored as one markdown-ish string
- no rich formatting, inserts, structured callouts, or reuse flow

### Changelog Entry Form

- [changelog-overlay.tsx](../../../packages/plugins/src/plugins/changelog/components/changelog-overlay.tsx)

Current behavior:

- short-form plain textarea
- consistent with the rest of the app, but not reusable as a durable authoring surface

These are exactly the kind of surfaces where a shared editor pays off because the improvement can be reused across chat, notes, changelog, and project context without changing storage contracts.

---

## Open WebUI Capability Clusters Worth Studying

The most useful way to look at Open WebUI is by capability clusters, not raw dependency count.

### Rich Authoring

Primary references:

- [Open WebUI `package.json`](https://raw.githubusercontent.com/open-webui/open-webui/main/package.json)
- [Open WebUI `RichTextInput.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/common/RichTextInput.svelte)
- [Open WebUI `MessageInput.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/MessageInput.svelte)

Key packages:

- `@tiptap/core`
- `@tiptap/starter-kit`
- `@tiptap/extension-mention`
- `@tiptap/extension-link`
- `@tiptap/extension-file-handler`
- `@tiptap/extension-code-block-lowlight`
- `@tiptap/extensions`
- `lowlight`
- `turndown`
- `@joplin/turndown-plugin-gfm`

What Open WebUI gets right:

- the input is treated as a real authoring surface rather than a textarea
- mentions, formatting, pasted files, and structured content are first-class
- markdown storage is preserved through HTML-to-markdown conversion

### Executable and File Workspace

Primary references:

- [Open WebUI `CodeEditor.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/common/CodeEditor.svelte)
- [Open WebUI `FileNav.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/FileNav.svelte)
- [Open WebUI `XTerminal.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/XTerminal.svelte)

Key packages:

- `@codemirror/*`
- `@xterm/xterm`
- `pyodide`

These are useful as long-term inspiration for embedded analysis workflows, but they are not the first thing Radarboard should copy.

### Artifact and Media Rendering

Primary references:

- [Open WebUI `Artifacts.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Artifacts.svelte)
- [Open WebUI `FilePreview.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/FileNav/FilePreview.svelte)

Key packages:

- `mermaid`
- `pdfjs-dist`
- `mammoth`
- `vega`
- `vega-lite`
- `html2canvas-pro`
- `jspdf`

What Open WebUI gets right:

- artifact output is treated as something to inspect and reuse
- different content types get specialized rendering paths
- the artifact surface feels like part of the workspace, not a raw blob dump

### Collaboration and Workspace Extensibility

Primary references:

- [Open WebUI workspace routes](https://github.com/open-webui/open-webui/tree/main/src/routes/%28app%29/workspace)
- [Open WebUI `RichTextInput.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/common/RichTextInput.svelte)

Key packages:

- `yjs`
- `y-prosemirror`
- `@tiptap/suggestion`
- workspace-level tools, prompts, models, and knowledge flows

What matters for Radarboard is not live collaboration itself. The useful pattern is that saved knowledge, prompts, tools, and notes can feed the composer directly.

---

## Top 3 Wins For Radarboard

### 1. Shared Rich Authoring Layer

**Radarboard references**

- [chat-composer.tsx](../../../apps/app/components/chat/chat-composer.tsx)
- [notes-overlay.tsx](../../../packages/plugins/src/plugins/notes/components/notes-overlay.tsx)
- [project-context-editor.tsx](../../../apps/app/components/projects/project-context-editor/index.tsx)
- [changelog-overlay.tsx](../../../packages/plugins/src/plugins/changelog/components/changelog-overlay.tsx)

**Open WebUI references**

- [Open WebUI `RichTextInput.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/common/RichTextInput.svelte)
- [Open WebUI `MessageInput.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/MessageInput.svelte)

### Recommendation

Build a shared React-native authoring layer in `packages/ui`:

- `RichTextComposer`
- `RichTextViewer`

Phase 1 should keep storage markdown-first so current APIs, DB fields, tests, and AI prompts do not need a schema rewrite.

### Why This Is The Best First Move

- It upgrades four existing surfaces at once.
- It fits Radarboard's package architecture.
- It improves chat quality without requiring a new backend model.
- It is the cleanest way to bring Open WebUI's strongest UX pattern into a React app.

### Implementation Direction

- Start with chat composer, notes, and project context notes.
- Add changelog descriptions in the second pass.
- Keep plain-text fallback available for simple fields.
- Preserve markdown output as the source of truth.

---

### 2. Rich Artifact Workspace

**Radarboard references**

- [chat-artifacts.tsx](../../../apps/app/components/chat/chat-artifacts.tsx)
- [chat-markdown.tsx](../../../apps/app/components/chat/chat-markdown.tsx)
- [ai-tools.ts](../../../apps/app/lib/ai-tools.ts)
- [route.ts](../../../apps/app/app/api/chat/route.ts)

**Open WebUI references**

- [Open WebUI `Artifacts.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Artifacts.svelte)
- [Open WebUI `FilePreview.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/FileNav/FilePreview.svelte)

### Recommendation

Upgrade Radarboard's existing assistant artifact area from a markdown-only expander into a typed preview workspace.

Phase 1 should support:

- markdown
- HTML
- Mermaid

The artifact contract can grow with a type discriminator while keeping the current artifact IDs, workflow modes, and persistence model intact.

### Why This Is The Right Second Move

- Radarboard already stores durable artifacts.
- A better artifact surface makes plan, review, and QA modes more reusable.
- Mermaid is a natural fit for operational workflows, architecture sketches, and assistant-generated diagrams.

### Implementation Direction

- Keep the current artifact repository shape and routes.
- Extend content metadata, not workflow identity.
- Add typed preview rendering before adding heavier formats like PDF or Vega.

---

### 3. Lightweight Knowledge And Prompt Insertion Flow

**Radarboard references**

- [chat-composer.tsx](../../../apps/app/components/chat/chat-composer.tsx)
- [notes-overlay.tsx](../../../packages/plugins/src/plugins/notes/components/notes-overlay.tsx)
- [assistant-workflows.ts](../../../apps/app/lib/assistant-workflows.ts)

**Open WebUI references**

- [Open WebUI workspace routes](https://github.com/open-webui/open-webui/tree/main/src/routes/%28app%29/workspace)
- [Open WebUI `MessageInput.svelte`](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/MessageInput.svelte)

### Recommendation

Borrow Open WebUI's workspace-to-composer pattern, but implement it in a Radarboard way:

- saved notes can be inserted into chat
- project context blocks can be inserted into chat
- saved prompts or workflow templates can seed the composer
- integrations and artifacts can be referenced without manual copy-paste

This should remain lightweight. It does not require a full Open WebUI-style workspace admin console.

### Why This Fits Radarboard

- the chat composer already has `@project` mention behavior, so there is an insertion anchor
- Radarboard already stores reusable context in artifacts, notes, project settings, and integrations
- this improves daily usage without expanding the product into a general notebook IDE

### Implementation Direction

- use slash-command or insert-menu style entry points
- source items from existing Radarboard entities first
- avoid building a large parallel knowledge product until the insertion flow proves useful

---

## Suggested Package Matrix

The package recommendations below are intentionally biased toward React-native adoption, even when Open WebUI uses the same underlying capability from Svelte.

### Build Now

| Package(s) | Why it fits | Where it lands | Migration cost | What not to copy |
|---|---|---|---|---|
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-mention`, `@tiptap/extension-link` | Gives Radarboard a shared structured editor that matches the strongest part of Open WebUI's chat UX while fitting React directly. | `packages/ui` as `RichTextComposer`, then [chat-composer.tsx](../../../apps/app/components/chat/chat-composer.tsx), [notes-overlay.tsx](../../../packages/plugins/src/plugins/notes/components/notes-overlay.tsx), and [project-context-editor.tsx](../../../apps/app/components/projects/project-context-editor/index.tsx). | Medium | Do not copy Open WebUI's broad Svelte-specific editor wrapper or every toolbar/menu behavior in v1. |
| `@tiptap/extension-code-block-lowlight`, `lowlight` | Lets Radarboard handle richer code and structured snippets inside chat, notes, and artifacts without leaving markdown-first storage. | `packages/ui` viewer/composer layer and later artifact previews next to [chat-markdown.tsx](../../../apps/app/components/chat/chat-markdown.tsx). | Low to medium | Do not turn every text field into a mini IDE. Keep code formatting scoped to surfaces that need it. |
| `turndown`, `@joplin/turndown-plugin-gfm` | Preserves markdown as the source of truth while using a richer editor model. This is the cleanest bridge between Tiptap content and current Radarboard storage. | `packages/ui` editor serialization utilities and any future artifact save flow. | Low | Do not inherit Open WebUI's heavier HTML conversion pipeline or edge-case table handling until real Radarboard content demands it. |

### Later

| Package(s) | Why it fits | Where it lands | Migration cost | What not to copy |
|---|---|---|---|---|
| `mermaid` | The most natural first typed artifact upgrade for plans, reviews, QA flows, and architecture outputs. | Artifact preview UI built on top of [chat-artifacts.tsx](../../../apps/app/components/chat/chat-artifacts.tsx) and existing artifact routes. | Low | Do not add generic "render anything" support before typed artifact metadata exists. |
| `@codemirror/*` | Useful if Radarboard later wants embedded query or prompt editors for advanced workflows, especially in artifact review or plugin/tool editing. | Advanced editor surfaces only, not the default chat composer. | Medium | Do not copy Open WebUI's full file workspace or terminal-driven IDE posture unless Radarboard actually needs it. |

### Skip For Now

| Package(s) | Why it is interesting | Where it would land | Migration cost | What not to copy |
|---|---|---|---|---|
| `yjs`, `y-prosemirror` | Real-time collaborative editing is powerful, but Radarboard does not have a multi-user authoring problem yet. | Would sit inside a future shared editor layer. | High | Do not import collaboration complexity before single-user authoring is excellent. |
| `@xterm/xterm`, `pyodide` | In-browser terminal and code execution are impressive and useful in Open WebUI's general AI workspace. | Would become a separate execution workspace, not a simple dashboard enhancement. | High | Do not turn Radarboard into a browser IDE. |
| `pdfjs-dist`, `mammoth`, `vega`, `vega-lite`, `html2canvas-pro`, `jspdf` | These packages enable rich document and visualization handling, but they expand surface area quickly. | Future typed artifact viewers, if strong usage appears. | Medium to high | Do not front-load broad document support before markdown, HTML, and Mermaid prove valuable. |

---

## Recommended Public Interfaces To Lock

These interfaces are the right abstraction boundary if Radarboard adopts the recommendations above.

### `RichTextComposer`

Purpose:

- shared structured editor for chat and reusable text-heavy surfaces

Expected output:

- markdown string as the persisted source of truth
- optional HTML and JSON snapshots for preview and tooling only

### `RichTextViewer`

Purpose:

- reusable read surface for markdown plus future typed content

Expected responsibilities:

- render markdown consistently across chat, notes, and artifacts
- support progressive capability upgrades like Mermaid without changing every consumer

### Typed Artifact Content

Artifact identity should remain unchanged. If the artifact model grows, it should grow by content typing rather than by a new storage concept.

Suggested direction:

```ts
type ArtifactContentType = "markdown" | "html" | "mermaid";
```

The important part is not the exact type name. The important part is that artifact previews become explicit and typed without breaking current artifact IDs, workflow modes, or durable storage.

---

## What Not To Copy From Open WebUI

Open WebUI is valuable inspiration, but there are clear anti-goals for Radarboard.

- Do not copy Svelte-centric component patterns directly.
- Do not copy the whole "AI operating system" surface area.
- Do not add browser-side code execution just because it exists upstream.
- Do not add collaboration infrastructure before the single-user workflow is excellent.
- Do not bloat the dependency graph with PDF, Word, chart, and export packages before typed artifacts justify them.

The right mindset is selective borrowing:

- copy the authoring quality
- copy the artifact seriousness
- copy the workspace-to-composer flow
- do not copy the whole platform breadth

---

## Ranked Shortlist

### Build Now

1. Shared Tiptap-based `RichTextComposer` and `RichTextViewer` in `packages/ui`
2. Migrate chat composer, notes, and project-context notes to the shared editor
3. Keep markdown-first persistence using `turndown`

### Later

1. Typed artifact previews with `markdown | html | mermaid`
2. Lightweight workspace-to-composer insertion flow for notes, prompts, and project context
3. Limited CodeMirror adoption for advanced editor surfaces only

### Skip For Now

1. Yjs collaboration
2. xterm terminal embedding
3. Pyodide code execution
4. broad document and export support with PDF, DOCX, Vega, and screenshot tooling

---

## Final Take

If Radarboard wants to borrow one thing from Open WebUI, it should borrow the idea that chat is not just a message stream. It is an authoring surface connected to reusable artifacts, saved context, and focused workspace tools.

The best implementation path is to start with Tiptap in `packages/ui`, keep markdown as the persisted contract, and let richer artifact rendering follow from that foundation.

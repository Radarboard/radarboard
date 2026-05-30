# Design Spec: Chat UI Refinement (Integrated AI SDK Style)

Date: 2026-03-21
Status: Draft
Topic: Refinement of @radarboard/assistant-ui to align with Vercel AI SDK Elements patterns.

## 1. Purpose & Goals
The current chat UI feels "disconnected" with tool results (Artifacts) at the top and inconsistent message bubbles. We aim to:
- **Tighten the Visual Flow**: Move to a 640px centered lane with consistent vertical rhythm.
- **Integrated Reasoning**: Move tool calls/artifacts from the header into the message flow.
- **Modern Aesthetics**: Adopt the "bubbled user / bubble-less assistant" pattern common in top-tier AI interfaces (ChatGPT, Claude, Vercel AI).
- **Sticky Composer**: Ensure the input area is always accessible with a polished backdrop effect.

## 2. Structural Changes

### 2.1 Message Architecture
- **User Messages**:
  - Right-aligned.
  - Background: `bg-surface-raised` (Zinc-800 equivalent).
  - Shape: `rounded-panel` with a small sharp corner on the bottom right (`rounded-br-none` or similar).
  - Text: `text-w-base` (13px), standard foreground.
- **Assistant Messages**:
  - Left-aligned.
  - Background: Transparent (no bubble).
  - Text: `text-w-base` (13px), standard markdown rendering via `ChatMarkdown`.
  - Actions: Hover-triggered `MessageActions` toolbar below the text.

### 2.2 Inline Reasoning & Tool Calls
- **Workflow Artifacts**: No longer a fixed header.
- **New Component: `MessageReasoning`**:
  - Appears above or below the assistant text.
  - Displays as a vertical sequence of "steps" with small icons (e.g., a spinner for pending, checkmark for complete).
  - Style: `text-w-xs` (10px) or `text-w-sm` (11px), `text-dim`.
  - Collapsible: Detailed tool outputs remain hidden in a `details` block by default.

### 2.3 Suggested Actions
- **New Component: `SuggestedActions`**:
  - Appears at the very bottom of the conversation flow, just above the composer.
  - Renders as a row of horizontal chips (e.g., "Explore Idea", "Turn Into Plan").
  - Style: `bg-accent/10`, `text-accent`, `hover:bg-accent/20`, `rounded-item`.

### 2.4 Sticky Composer Refinement
- The `Prompt` container will be fixed/sticky at the bottom.
- **Visuals**: Add a gradient mask or `backdrop-blur-md` to the bottom area so messages scroll behind it gracefully.
- **Width**: Max-width `640px`, centered.

## 3. Design Tokens (Strict Adherence)
- **Typography**: `text-w-base` for primary chat, `text-w-sm` for metadata/actions.
- **Colors**: `bg-surface` (base), `bg-surface-raised` (user bubbles), `text-foreground` (primary), `text-dim` (metadata).
- **Radius**: `rounded-panel` (0px by default, following project-wide square aesthetic).

## 4. Implementation Strategy
1. **Update `chat-ui.tsx`**: Add `MessageReasoning` and `SuggestedActions` primitives.
2. **Modify `chat-messages.tsx`**:
   - Update `MessageItem` to handle the new bubble logic.
   - Inject `MessageReasoning` for tool calls.
   - Insert `SuggestedActions` at the end of the message list.
3. **Modify `chat-drawer.tsx`**: Remove the top `ChatArtifacts` header to allow it to flow inline.
4. **Refine `chat-composer.tsx`**: Apply sticky positioning and backdrop effects.

## 5. Success Criteria
- The chat lane is centered and exactly 640px wide on desktop.
- Tool calls appear as discrete "steps" in the conversation flow.
- Assistant text has no background bubble, while user text does.
- All "Plan" mode buttons are moved to the `SuggestedActions` chip row.

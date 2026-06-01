"use client";

import { cn } from "@radarboard/utils/cn";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
  BoldIcon,
  Code2Icon,
  Heading2Icon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  Undo2Icon,
} from "lucide-react";
import { marked } from "marked";
import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import TurndownService from "turndown";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

const lowlight = createLowlight(common);
const turndown = new TurndownService({
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

marked.use({ breaks: true, gfm: true });

export interface RichTextComposerChangeMeta {
  editor: Editor;
  html: string;
  json: JSONContent;
  plainText: string;
  selection: { from: number; to: number };
  textBeforeCursor: string;
}

export interface RichTextComposerHandle {
  clear: () => void;
  focus: () => void;
  getMarkdown: () => string;
  insertText: (text: string) => void;
  replaceRange: (from: number, to: number, text: string) => void;
  setMarkdown: (markdown: string) => void;
}

interface RichTextComposerEventMeta {
  editor: Editor;
}

export interface RichTextComposerProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onChange" | "onKeyDown" | "onPaste"> {
  value: string;
  onChange: (markdown: string, meta: RichTextComposerChangeMeta) => void;
  placeholder?: string;
  disabled?: boolean;
  showToolbar?: boolean;
  editorClassName?: string;
  contentClassName?: string;
  autoFocus?: boolean;
  onKeyDown?: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    meta: RichTextComposerEventMeta
  ) => boolean | undefined;
  onPaste?: (
    event: ReactClipboardEvent<HTMLDivElement>,
    meta: RichTextComposerEventMeta
  ) => boolean | undefined;
}

function markdownToHtml(value: string): string {
  if (!value.trim()) return "<p></p>";
  const html = marked.parse(value);
  return typeof html === "string" ? html : "<p></p>";
}

function htmlToMarkdown(html: string): string {
  return turndown
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function buildChangeMeta(editor: Editor): Omit<RichTextComposerChangeMeta, "html" | "json"> {
  const { from, to } = editor.state.selection;
  const textBeforeCursor = editor.state.doc.textBetween(Math.max(0, from - 120), from, "\n", "\0");

  return {
    editor,
    plainText: editor.getText(),
    selection: { from, to },
    textBeforeCursor,
  };
}

function ToolbarButton({
  active = false,
  disabled = false,
  className,
  tooltip,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  active?: boolean;
  tooltip: string;
}) {
  const button = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-item border text-dim transition-colors",
        active
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-transparent hover:border-border hover:bg-surface-raised hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export const RichTextComposer = ({
  value,
  onChange,
  placeholder = "Write here...",
  disabled = false,
  showToolbar = true,
  className,
  editorClassName,
  contentClassName,
  autoFocus = false,
  onKeyDown,
  onPaste,
  ref,
  ...props
}: RichTextComposerProps & { ref?: RefObject<RichTextComposerHandle | null> }) => {
  const lastSyncedValueRef = useRef(value);
  const applyingExternalUpdateRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const onKeyDownRef = useRef(onKeyDown);
  const onPasteRef = useRef(onPaste);

  useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
    onPasteRef.current = onPaste;
  }, [onChange, onKeyDown, onPaste]);

  const syncExternalValue = useCallback((editor: Editor, nextValue: string) => {
    applyingExternalUpdateRef.current = true;
    editor.commands.setContent(markdownToHtml(nextValue));
    applyingExternalUpdateRef.current = false;
    lastSyncedValueRef.current = nextValue;
  }, []);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !disabled,
      autofocus: autoFocus,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: false,
        }),
        CodeBlockLowlight.configure({ lowlight }),
        Link.configure({
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
        }),
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: markdownToHtml(value),
      onCreate: ({ editor: nextEditor }) => {
        editorRef.current = nextEditor;
      },
      onDestroy: () => {
        editorRef.current = null;
      },
      editorProps: {
        attributes: {
          class: cn(
            "min-h-[140px] w-full px-3 py-3 text-w-base font-mono leading-relaxed text-foreground-secondary outline-none",
            "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-w-xl [&_h1]:font-semibold",
            "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-w-lg [&_h2]:font-semibold",
            "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
            "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
            "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
            "[&_pre]:my-2 [&_pre]:rounded-item [&_pre]:border [&_pre]:border-border [&_pre]:bg-background [&_pre]:p-3 [&_pre]:whitespace-pre-wrap [&_pre]:break-words",
            "[&_code]:rounded-item [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-w-base",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
            "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
            editorClassName
          ),
        },
        handleDOMEvents: {
          keydown: (_view, event): boolean => {
            if (!onKeyDownRef.current || !editorRef.current) return false;
            return Boolean(
              onKeyDownRef.current(event as unknown as ReactKeyboardEvent<HTMLDivElement>, {
                editor: editorRef.current,
              })
            );
          },
          paste: (_view, event): boolean => {
            if (!onPasteRef.current || !editorRef.current) return false;
            return Boolean(
              onPasteRef.current(event as unknown as ReactClipboardEvent<HTMLDivElement>, {
                editor: editorRef.current,
              })
            );
          },
        },
      },
      onUpdate: ({ editor: nextEditor }) => {
        if (applyingExternalUpdateRef.current) return;
        const html = nextEditor.getHTML();
        const markdown = htmlToMarkdown(html);
        lastSyncedValueRef.current = markdown;
        onChangeRef.current(markdown, {
          html,
          json: nextEditor.getJSON(),
          ...buildChangeMeta(nextEditor),
        });
      },
    },
    [disabled, placeholder, autoFocus, editorClassName]
  );

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        if (!editor) return;
        syncExternalValue(editor, "");
      },
      focus: () => {
        editor?.commands.focus();
      },
      getMarkdown: () => {
        if (!editor) return lastSyncedValueRef.current;
        return htmlToMarkdown(editor.getHTML());
      },
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      replaceRange: (from: number, to: number, text: string) => {
        editor?.chain().focus().insertContentAt({ from, to }, text).run();
      },
      setMarkdown: (markdown: string) => {
        if (!editor) return;
        syncExternalValue(editor, markdown);
      },
    }),
    [editor, syncExternalValue]
  );

  useEffect(() => {
    if (!editor) return;
    if (value === lastSyncedValueRef.current) return;

    const currentMarkdown = htmlToMarkdown(editor.getHTML());
    if (value === currentMarkdown) {
      lastSyncedValueRef.current = value;
      return;
    }

    syncExternalValue(editor, value);
  }, [editor, value, syncExternalValue]);

  const canRunCommands = useMemo(() => Boolean(editor && !disabled), [editor, disabled]);
  const showPlaceholder = !value.trim() && (editor?.isEmpty ?? true);

  const setLink = () => {
    if (!editor || disabled) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const nextUrl = window.prompt("Enter URL", previousUrl ?? "https://");
    if (nextUrl === null) return;
    if (!nextUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: nextUrl.trim() }).run();
  };

  return (
    <div
      className={cn("overflow-hidden rounded-item border border-border bg-surface", className)}
      {...props}
    >
      {Boolean(showToolbar) && (
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-wrap items-center gap-1 border-border border-b px-2 py-1.5">
            <ToolbarButton
              active={editor?.isActive("bold")}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              aria-label="Bold"
              tooltip="Bold"
            >
              <BoldIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("italic")}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              aria-label="Italic"
              tooltip="Italic"
            >
              <ItalicIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("heading", { level: 2 })}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-label="Heading"
              tooltip="Heading"
            >
              <Heading2Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("bulletList")}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              aria-label="Bulleted list"
              tooltip="Bulleted list"
            >
              <ListIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("orderedList")}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              aria-label="Numbered list"
              tooltip="Numbered list"
            >
              <ListOrderedIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("blockquote")}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              aria-label="Blockquote"
              tooltip="Blockquote"
            >
              <QuoteIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("codeBlock")}
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              aria-label="Code block"
              tooltip="Code block"
            >
              <Code2Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor?.isActive("link")}
              disabled={!canRunCommands}
              onClick={setLink}
              aria-label="Link"
              tooltip="Link"
            >
              <Link2Icon size={14} />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-secondary" />
            <ToolbarButton
              disabled={!canRunCommands}
              onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              aria-label="Clear formatting"
              tooltip="Clear formatting"
            >
              <RemoveFormattingIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              disabled={!editor?.can().chain().focus().undo().run()}
              onClick={() => editor?.chain().focus().undo().run()}
              aria-label="Undo"
              tooltip="Undo"
            >
              <Undo2Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
              disabled={!editor?.can().chain().focus().redo().run()}
              onClick={() => editor?.chain().focus().redo().run()}
              aria-label="Redo"
              tooltip="Redo"
            >
              <Redo2Icon size={14} />
            </ToolbarButton>
          </div>
        </TooltipProvider>
      )}

      <div className="relative">
        <EditorContent
          editor={editor}
          className={cn(
            "scrollbar-thin max-h-[320px] overflow-y-auto",
            disabled && "cursor-not-allowed opacity-70",
            contentClassName
          )}
        />
        {Boolean(showPlaceholder) && (
          <div className="pointer-events-none absolute top-3 left-3 font-mono text-muted-foreground text-w-base">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};

RichTextComposer.displayName = "RichTextComposer";

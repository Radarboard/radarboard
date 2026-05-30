"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Textarea } from "@radarboard/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { mergeTemplates } from "../templates";
import type { NoteTemplate } from "../types";

interface TemplateManagerProps {
  open: boolean;
  onClose: () => void;
  userTemplates: NoteTemplate[];
  onAdd: (
    input: Pick<NoteTemplate, "name" | "description" | "content" | "tags" | "icon">
  ) => Promise<NoteTemplate>;
  onUpdate: (
    id: string,
    changes: Partial<Pick<NoteTemplate, "name" | "description" | "content" | "tags" | "icon">>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

type EditorState = {
  mode: "create" | "edit";
  id?: string;
  name: string;
  description: string;
  content: string;
};

export function TemplateManager({
  open,
  onClose,
  userTemplates,
  onAdd,
  onUpdate,
  onRemove,
}: TemplateManagerProps) {
  const templates = mergeTemplates(userTemplates);
  const [editor, setEditor] = useState<EditorState | null>(null);

  function startCreate() {
    setEditor({
      mode: "create",
      name: "",
      description: "",
      content: "",
    });
  }

  function startEdit(tpl: NoteTemplate) {
    setEditor({
      mode: "edit",
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      content: tpl.content,
    });
  }

  async function handleSave() {
    if (!editor || !editor.name.trim()) return;
    if (editor.mode === "create") {
      await onAdd({
        name: editor.name.trim(),
        description: editor.description.trim(),
        content: editor.content,
        tags: [],
        icon: undefined,
      });
    } else if (editor.id) {
      await onUpdate(editor.id, {
        name: editor.name.trim(),
        description: editor.description.trim(),
        content: editor.content,
      });
    }
    setEditor(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" className="rounded-none border-border bg-secondary">
        <DialogHeader>
          <DialogTitle>Template Manager</DialogTitle>
          <DialogDescription>
            Create, edit, and remove note templates. Built-in templates can be customized.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 overflow-x-hidden">
          {editor ? (
            <div className="space-y-3">
              <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
                {editor.mode === "create" ? "New Template" : "Edit Template"}
              </div>
              <div className="space-y-2">
                <Input
                  type="text"
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  placeholder="Template name"
                  variant="surface"
                  size="lg"
                  className="bg-surface text-sm"
                />
                <Input
                  type="text"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder="Short description"
                  variant="surface"
                  size="lg"
                  className="bg-surface text-sm"
                />
                <Textarea
                  value={editor.content}
                  onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                  placeholder="Template content (Markdown, use {date} for date placeholder)"
                  rows={10}
                  className="resize-y bg-surface font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={!editor.name.trim()}
                  variant="secondary"
                  uppercase={false}
                >
                  {editor.mode === "create" ? "Create" : "Save"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setEditor(null)}
                  variant="ghost"
                  uppercase={false}
                  className="text-dim hover:text-foreground-secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-dim text-w-sm">
                  {templates.length} template{templates.length !== 1 ? "s" : ""}
                </div>
                <Button
                  type="button"
                  onClick={startCreate}
                  variant="outline"
                  uppercase={false}
                  className="gap-1.5"
                >
                  <Plus className="icon-sm" />
                  New Template
                </Button>
              </div>

              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-start gap-3 border border-border bg-surface p-3"
                  >
                    <FileText className="icon-sm mt-0.5 shrink-0 text-dim" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground-secondary text-sm">
                        {tpl.name}
                      </div>
                      <div className="mt-0.5 text-dim text-w-sm">{tpl.description}</div>
                      {Boolean(tpl.builtIn) && (
                        <span className="mt-1 inline-block border border-border px-1.5 py-0.5 font-mono text-dim text-w-xs">
                          built-in
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            onClick={() => startEdit(tpl)}
                            variant="ghost"
                            size="icon"
                            uppercase={false}
                            className="text-dim hover:text-foreground-secondary"
                            aria-label={`Edit ${tpl.name}`}
                          >
                            <Pencil className="icon-sm" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      {!tpl.builtIn && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              onClick={() => onRemove(tpl.id)}
                              variant="ghost"
                              size="icon"
                              uppercase={false}
                              className="text-dim hover:text-rose-400"
                              aria-label={`Delete ${tpl.name}`}
                            >
                              <Trash2 className="icon-sm" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

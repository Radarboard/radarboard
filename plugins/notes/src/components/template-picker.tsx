"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  FileCode,
  FileText,
  Plus,
  Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { hydrateTemplate, mergeTemplates } from "../templates";
import type { NoteTemplate } from "../types";

const ICON_MAP: Record<string, React.ReactNode> = {
  users: <Users className="icon-sm" />,
  alertTriangle: <AlertTriangle className="icon-sm" />,
  calendar: <Calendar className="icon-sm" />,
  fileCode: <FileCode className="icon-sm" />,
};

interface TemplatePickerProps {
  userTemplates: NoteTemplate[];
  onSelect: (template: { title: string; content: string; tags: string[] }) => void;
  onBlankNote: () => void;
  onManage?: () => void;
}

export function TemplatePicker({
  userTemplates,
  onSelect,
  onBlankNote,
  onManage,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const templates = mergeTemplates(userTemplates);

  return (
    <div className="relative">
      <div className="flex items-center">
        {/* Main button — blank note */}
        <Button
          type="button"
          onClick={onBlankNote}
          variant="outline"
          uppercase={false}
          rounded="none"
          className="gap-1.5 rounded-l-item text-muted-foreground"
        >
          <Plus className="icon-base" />
          New Note
        </Button>
        {/* Dropdown trigger */}
        <Button
          type="button"
          onClick={() => setOpen(!open)}
          variant="outline"
          size="sm"
          uppercase={false}
          rounded="none"
          className="rounded-r-item border-l-0 px-1.5 text-dim hover:text-foreground-secondary"
          aria-label="Choose template"
        >
          <ChevronDown className={cn("icon-xs transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {Boolean(open) && (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 h-full w-full rounded-none p-0 hover:bg-transparent"
            aria-label="Close template menu"
          />
          <div className="absolute top-full left-0 z-20 mt-1 min-w-[220px] rounded border border-border bg-surface-raised py-1 shadow-lg">
            <Button
              type="button"
              onClick={() => {
                onBlankNote();
                setOpen(false);
              }}
              variant="ghost"
              uppercase={false}
              fullWidth
              className="h-auto justify-start gap-2 px-3 py-2 text-foreground-secondary"
            >
              <FileText className="icon-xs text-dim" />
              <div>
                <div>Blank Note</div>
                <div className="text-dim text-w-xs">Start from scratch</div>
              </div>
            </Button>

            <div className="my-1 border-border border-t" />
            <div className="px-3 py-1 font-mono text-dim text-w-xs uppercase tracking-widest">
              Templates
            </div>

            {templates.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onSelect({
                    title: tpl.name,
                    content: hydrateTemplate(tpl.content),
                    tags: tpl.tags,
                  });
                  setOpen(false);
                }}
                variant="ghost"
                uppercase={false}
                fullWidth
                className="h-auto justify-start gap-2 px-3 py-2 text-foreground-secondary"
              >
                <span className="text-dim">
                  {ICON_MAP[tpl.icon ?? ""] ?? <FileText className="icon-sm" />}
                </span>
                <div className="text-left">
                  <div>{tpl.name}</div>
                  <div className="text-dim text-w-xs">{tpl.description}</div>
                </div>
              </Button>
            ))}

            {Boolean(onManage) && (
              <>
                <div className="my-1 border-border border-t" />
                <Button
                  type="button"
                  onClick={() => {
                    onManage?.();
                    setOpen(false);
                  }}
                  variant="ghost"
                  uppercase={false}
                  fullWidth
                  className="h-auto justify-start gap-2 px-3 py-2 text-dim hover:text-foreground-secondary"
                >
                  Manage Templates
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

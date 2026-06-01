"use client";

import type { ModalSize } from "@radarboard/types/ui";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { NativeSelect } from "@radarboard/ui/select";
import { Textarea } from "@radarboard/ui/textarea";
import { cn } from "@radarboard/utils/cn";
import type React from "react";
import type { Ref } from "react";

export interface PluginFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Dialog title (e.g. "New Task", "Add Bookmark") */
  title: string;
  /** Form fields — rendered inside the dialog body */
  children: React.ReactNode;
  /** Submit handler */
  onSubmit: (e: React.FormEvent) => void;
  /** Submit button label (default: "Create") */
  submitLabel?: string;
  /** Whether the submit button is disabled */
  submitDisabled?: boolean;
  /** Optional extra actions in the footer (before cancel/submit) */
  footerExtra?: React.ReactNode;
  /** Shared dialog shell size */
  size?: ModalSize;
}

/**
 * Shared modal dialog for creating/editing items across all plugins.
 *
 * Replaces inline forms (tasks, bookmarks, status-page) and custom
 * modals (rss-reader) with a consistent Dialog-based pattern.
 *
 * ```
 * ┌─────────────────────────────────┐
 * │ Title                        ✕  │
 * ├─────────────────────────────────┤
 * │                                 │
 * │  [Form fields — children]       │
 * │                                 │
 * ├─────────────────────────────────┤
 * │              Cancel    [Create] │
 * └─────────────────────────────────┘
 * ```
 */
export function PluginFormDialog({
  open,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = "Create",
  submitDisabled,
  footerExtra,
  size = "sm",
}: PluginFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent size={size}>
        <div>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-3">{children}</DialogBody>

          <DialogFooter>
            {footerExtra}
            <div className="flex-1" />
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="default"
              uppercase={false}
              className="text-dim hover:text-foreground-secondary"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(event) => onSubmit(event as unknown as React.FormEvent)}
              disabled={submitDisabled}
              variant="secondary"
              size="default"
              uppercase={false}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shared form field components
// ---------------------------------------------------------------------------

export interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Labeled form field wrapper. */
export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="tracking-widest">{label}</Label>
      {children}
    </div>
  );
}

/** Standard text input for form dialogs. */
export function FormInput({
  className,
  ref,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <Input
      ref={ref}
      variant="surface"
      size="lg"
      className={cn("text-w-sm", className)}
      {...props}
    />
  );
}

/** Standard textarea for form dialogs. */
export function FormTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Textarea
      className={cn("min-h-[120px] resize-none bg-surface text-w-sm", className)}
      {...props}
    />
  );
}

/** Standard select for form dialogs. */
export function FormSelect({
  className,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">) {
  return (
    <NativeSelect variant="surface" size="lg" className={cn("text-w-sm", className)} {...props} />
  );
}

"use client";

import type { ModalSize } from "@radarboard/types/ui";
import { cn } from "@radarboard/utils/cn";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  Dialog as BaseDialog,
  DialogClose as BaseDialogClose,
  DialogContent as BaseDialogContent,
  DialogOverlay as BaseDialogOverlay,
  DialogTrigger as BaseDialogTrigger,
  DetailLink,
  DetailRow,
  DialogBody,
  DialogCancelButton,
  DialogDescription,
  DialogDestructiveButton,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { emitUiToast } from "../toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

export interface ConfirmationToast {
  title: string;
  description?: string;
}

export const APP_DIALOG_SIZES: ModalSize[] = ["sm", "md", "lg"];

export const APP_DIALOG_SIZE_LABELS: Record<ModalSize, string> = {
  sm: "S",
  md: "M",
  lg: "L",
};

export const APP_DIALOG_SIZE_TOOLTIPS: Record<ModalSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

export const APP_DIALOG_PANEL_CLASS: Record<ModalSize, string> = {
  sm: "rb-dialog-size-sm",
  md: "rb-dialog-size-md",
  lg: "rb-dialog-size-lg",
};

export const APP_DRAWER_PANEL_CLASS: Record<ModalSize, string> = {
  sm: "rb-drawer-size-sm",
  md: "rb-drawer-size-md",
  lg: "rb-drawer-size-lg",
};

export const Dialog = BaseDialog;
export const DialogTrigger = BaseDialogTrigger;
export const DialogClose = BaseDialogClose;
export const DialogOverlay = BaseDialogOverlay;
export {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogCancelButton,
  DialogDescription,
  DialogDestructiveButton,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};

export function DialogContent({
  className,
  size,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof BaseDialogContent>, "size"> & {
  size: ModalSize;
}) {
  return (
    <BaseDialogContent
      size={size}
      className={cn("scrollbar-thin overflow-x-hidden", className)}
      {...props}
    />
  );
}

function showConfirmationToast(variant: "success" | "error", message: ConfirmationToast | string) {
  if (typeof message === "string") {
    emitUiToast({ variant, title: message });
    return;
  }

  emitUiToast({
    variant,
    title: message.title,
    description: message.description,
  });
}

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  successToast: ConfirmationToast | string;
  errorToast?: ConfirmationToast | string;
  cancelLabel?: string;
  className?: string;
  bodyClassName?: string;
  nested?: boolean;
  hideCloseButton?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  successToast,
  errorToast = "Action failed",
  cancelLabel = "Cancel",
  className,
  bodyClassName,
  nested = false,
  hideCloseButton = false,
}: ConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;

    let isAsync = false;
    try {
      const result = onConfirm();
      if (result && typeof result.then === "function") {
        isAsync = true;
        setIsSubmitting(true);
        await result;
      }
      onOpenChange(false);
      showConfirmationToast("success", successToast);
    } catch {
      showConfirmationToast("error", errorToast);
    } finally {
      if (isAsync) {
        setIsSubmitting(false);
      }
    }
  }, [errorToast, isSubmitting, onConfirm, onOpenChange, successToast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BaseDialogContent
        size="sm"
        nested={nested}
        hideCloseButton={hideCloseButton}
        className={cn("scrollbar-thin overflow-x-hidden", className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className={bodyClassName}>{children}</DialogBody>
        <DialogFooter className="justify-end">
          <DialogCancelButton onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </DialogCancelButton>
          <DialogDestructiveButton onClick={handleConfirm} disabled={isSubmitting}>
            {confirmLabel}
          </DialogDestructiveButton>
        </DialogFooter>
      </BaseDialogContent>
    </Dialog>
  );
}

export function DialogSizeToggle({
  size,
  onSizeChange,
  className,
  ariaLabel = "Dialog size",
  sizes = APP_DIALOG_SIZES,
}: {
  size: ModalSize;
  onSizeChange: (size: ModalSize) => void;
  className?: string;
  ariaLabel?: string;
  sizes?: readonly ModalSize[];
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <fieldset
        className={cn(
          "m-0 flex items-center gap-0.5 rounded-item border border-border p-0.5",
          className
        )}
        aria-label={ariaLabel}
      >
        {sizes.map((option) => (
          <Tooltip key={option}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSizeChange(option)}
                aria-label={APP_DIALOG_SIZE_TOOLTIPS[option]}
                aria-pressed={size === option}
                className={cn(
                  "rounded-item px-1.5 py-0.5 font-mono text-w-sm uppercase tracking-wider transition-colors",
                  size === option
                    ? "bg-secondary text-foreground-secondary"
                    : "text-dim hover:bg-surface-raised hover:text-dim"
                )}
              >
                {APP_DIALOG_SIZE_LABELS[option]}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {APP_DIALOG_SIZE_TOOLTIPS[option]}
            </TooltipContent>
          </Tooltip>
        ))}
      </fieldset>
    </TooltipProvider>
  );
}

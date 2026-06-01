"use client";

import { cn } from "@radarboard/utils/cn";
import {
  Close as DialogPrimitiveClose,
  Content as DialogPrimitiveContent,
  Description as DialogPrimitiveDescription,
  Overlay as DialogPrimitiveOverlay,
  Portal as DialogPrimitivePortal,
  Root as DialogPrimitiveRoot,
  Title as DialogPrimitiveTitle,
  Trigger as DialogPrimitiveTrigger,
} from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type React from "react";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode, RefObject } from "react";
import { createContext, useContext } from "react";

/** Canonical modal sizes for consistent overlays across the system. */
export type ModalSize = import("@radarboard/types/ui").ModalSize;
/** Backward-compatible alias for dialog content size. */
export type ModalContentSize = import("@radarboard/types/ui").ModalContentSize;

export const DIALOG_SIZE_CLASS: Record<ModalContentSize, string> = {
  sm: "rb-dialog-size-sm",
  md: "rb-dialog-size-md",
  lg: "rb-dialog-size-lg",
};

export const Dialog = DialogPrimitiveRoot;
export const DialogTrigger = DialogPrimitiveTrigger;
export const DialogClose = DialogPrimitiveClose;

const DialogChromeContext = createContext<{ hideCloseButton: boolean }>({
  hideCloseButton: false,
});

export const DialogOverlay = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitiveOverlay> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DialogPrimitiveOverlay
    ref={ref}
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-modal bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = ({
  className,
  children,
  size = "sm",
  hideCloseButton = false,
  nested = false,
  overlayClassName,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitiveContent> & {
  size?: ModalContentSize;
  hideCloseButton?: boolean;
  nested?: boolean;
  overlayClassName?: string;
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DialogChromeContext.Provider value={{ hideCloseButton }}>
    <DialogPrimitivePortal>
      <DialogOverlay
        className={cn(nested ? "z-[var(--z-modal-nested)]" : undefined, overlayClassName)}
      />
      <DialogPrimitiveContent
        ref={ref}
        className={cn(
          "rb-dialog-shell",
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          nested ? "z-[var(--z-modal-nested)]" : "z-modal",
          "overflow-hidden",
          "border border-border bg-surface shadow-2xl",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=open]:animate-in",
          "flex flex-col",
          DIALOG_SIZE_CLASS[size],
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitiveContent>
    </DialogPrimitivePortal>
  </DialogChromeContext.Provider>
);
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { hideCloseButton } = useContext(DialogChromeContext);

  return (
    <div className={cn("border-border border-b px-4 py-3", className)} {...props}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">{children}</div>
        {hideCloseButton ? null : (
          <DialogPrimitiveClose className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center self-start text-dim transition-colors hover:text-foreground-secondary">
            <X className="icon-lg" />
            <span className="sr-only">Close</span>
          </DialogPrimitiveClose>
        )}
      </div>
    </div>
  );
};

export const DialogTitle = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitiveTitle> & {
  ref?: RefObject<HTMLHeadingElement | null>;
}) => (
  <DialogPrimitiveTitle
    ref={ref}
    className={cn(
      "font-bold font-mono text-foreground text-w-sm uppercase tracking-wider",
      className
    )}
    {...props}
  />
);
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitiveDescription> & {
  ref?: RefObject<HTMLParagraphElement | null>;
}) => (
  <DialogPrimitiveDescription
    ref={ref}
    className={cn("font-mono text-muted-foreground text-w-sm leading-relaxed", className)}
    {...props}
  />
);
DialogDescription.displayName = "DialogDescription";

export const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-4 py-3", className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex items-center gap-2 border-border border-t px-4 py-3", className)}
    {...props}
  />
);

export function DialogCancelButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer px-3 py-1.5 font-mono text-muted-foreground text-w-xs transition-colors hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function DialogDestructiveButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer rounded-item bg-destructive px-3 py-1.5 font-mono text-destructive-foreground text-w-xs transition-colors hover:bg-destructive/90",
        className
      )}
      {...props}
    />
  );
}

/** Reusable detail row for key-value pairs in detail modals */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-border border-b py-1.5 last:border-0">
      <span className="shrink-0 font-mono text-dim text-w-sm uppercase tracking-wider">
        {label}
      </span>
      <span className="text-right font-mono text-foreground-secondary text-w-xs">{children}</span>
    </div>
  );
}

/** External link styled for detail modal footers */
export function DetailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-accent text-w-sm transition-colors hover:text-accent/80"
    >
      {children} &rarr;
    </a>
  );
}

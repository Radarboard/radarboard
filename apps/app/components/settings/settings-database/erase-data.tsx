"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogDestructiveButton,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { SettingsPanel } from "../settings-page-layout";

const CONFIRM_WORD = "ERASE";

/**
 * Danger Zone — full factory reset. Distinct from onboarding's "Start fresh"
 * (which only clears cached/demo data and keeps connected services): this wipes
 * everything and returns the app to first-run.
 */
export function EraseAllDataPanel() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [erasing, setErasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canErase = confirmText.trim().toUpperCase() === CONFIRM_WORD && !erasing;

  async function handleErase() {
    if (!canErase) return;
    setErasing(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.factoryReset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to erase data.");
      }
      // Hard reload so the app re-initializes straight into first-run onboarding.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to erase data.");
      setErasing(false);
    }
  }

  return (
    <SettingsPanel
      title="Danger Zone"
      description="Irreversible actions. Use these only when you want to completely start over."
    >
      <div className="space-y-3 rounded-item border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="icon-sm shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="font-mono text-foreground text-w-sm">Erase all data</p>
            <p className="font-mono text-dim text-w-xs">
              Permanently deletes everything — connected services and credentials, dashboard
              layouts, plugin data, assistant history, notifications, and all settings — and returns
              Radarboard to first-run onboarding. Unlike "Start fresh", this also removes your
              connections. This cannot be undone.
            </p>
          </div>
        </div>
        <Button
          variant="outline-destructive"
          size="sm"
          uppercase={false}
          onClick={() => {
            setConfirmText("");
            setError(null);
            setOpen(true);
          }}
        >
          Erase all data
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!erasing) setOpen(next);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Erase all data?</DialogTitle>
            <DialogDescription>
              This permanently deletes all connections, credentials, layouts, plugin data, assistant
              history, notifications, and settings. You'll start over from onboarding. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <label htmlFor="erase-confirm" className="block font-mono text-dim text-w-xs">
              Type <span className="font-bold text-foreground">{CONFIRM_WORD}</span> to confirm
            </label>
            <Input
              id="erase-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {error && <p className="font-mono text-destructive text-w-xs">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogCancelButton onClick={() => setOpen(false)} disabled={erasing}>
              Cancel
            </DialogCancelButton>
            <DialogDestructiveButton
              disabled={!canErase}
              onClick={() => {
                handleErase().catch(() => undefined);
              }}
            >
              {erasing ? "Erasing…" : "Erase everything"}
            </DialogDestructiveButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}

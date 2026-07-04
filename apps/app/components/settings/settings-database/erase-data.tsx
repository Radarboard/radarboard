"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { ConfirmationDialog } from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { SettingsPanel } from "../settings-page-layout";

const CONFIRM_WORD = "ERASE";

/**
 * Danger Zone — full factory reset. Distinct from onboarding's "Start fresh"
 * (which only clears cached/demo data and keeps connected services): this wipes
 * everything and returns the app to first-run.
 *
 * Uses the shared ConfirmationDialog (per the modal contract) with a
 * type-to-confirm gate on top, since a full wipe warrants extra friction.
 */
export function EraseAllDataPanel() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  async function handleErase() {
    const res = await fetch(API_ROUTES.factoryReset, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: CONFIRM_WORD }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      // Thrown so ConfirmationDialog surfaces the failure instead of closing;
      // this also covers a partial wipe (the route returns a non-2xx then).
      throw new Error(body?.error ?? "Failed to erase data.");
    }
    // Hard reload so the app re-initializes straight into first-run onboarding.
    window.location.assign("/");
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
            setOpen(true);
          }}
        >
          Erase all data
        </Button>
      </div>

      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText("");
        }}
        title="Erase all data?"
        confirmLabel="Erase everything"
        confirmDisabled={!confirmed}
        onConfirm={handleErase}
        successToast="All data erased"
        errorToast={{
          title: "Couldn't erase all data",
          description: "Some data may not have been removed — check the app and try again.",
        }}
      >
        <div className="space-y-2">
          <p className="font-mono text-dim text-w-xs">
            This permanently deletes all connections, credentials, layouts, plugin data, assistant
            history, notifications, and settings. You'll start over from onboarding. This action
            cannot be undone.
          </p>
          <Label
            htmlFor="erase-confirm"
            className="block text-dim text-w-xs normal-case tracking-normal"
          >
            Type <span className="font-bold text-foreground">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="erase-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
      </ConfirmationDialog>
    </SettingsPanel>
  );
}

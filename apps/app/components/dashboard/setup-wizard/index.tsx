"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { DatabaseProvider, ProviderInfo } from "@radarboard/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { cn } from "@radarboard/utils/cn";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useState } from "react";
import { DATABASE_PROVIDERS } from "@/lib/providers";
import { DatabaseProviderCard } from "../provider-card";

const SETUP_STEPS = ["1", "2", "3"] as const;

interface SetupWizardProps {
  open: boolean;
  onComplete: () => void;
  presentation?: "dialog" | "inline";
}

function SetupWizardHeader({
  title,
  description,
  presentation,
}: {
  title: string;
  description?: string;
  presentation: "dialog" | "inline";
}) {
  if (presentation === "inline") {
    return (
      <div className="space-y-1 border-border border-b px-4 py-4">
        <div className="text-foreground text-w-lg">{title}</div>
        {description ? <p className="font-mono text-dim text-w-sm">{description}</p> : null}
      </div>
    );
  }

  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      {description ? <p className="mt-1 font-mono text-dim text-w-sm">{description}</p> : null}
    </DialogHeader>
  );
}

// -- Step sub-components to reduce complexity --

interface Step1Props {
  presentation: "dialog" | "inline";
  selectedProvider: DatabaseProvider;
  onSelectProvider: (id: DatabaseProvider) => void;
  onContinue: () => void;
}

function SetupWizardStep1({
  presentation,
  selectedProvider,
  onSelectProvider,
  onContinue,
}: Step1Props) {
  return (
    <>
      <SetupWizardHeader
        title="Database Setup"
        description="Choose where to store your dashboard data."
        presentation={presentation}
      />

      <div className="grid grid-cols-2 gap-3 p-4">
        {DATABASE_PROVIDERS.map((p) => (
          <DatabaseProviderCard
            key={p.id}
            provider={p}
            selected={selectedProvider === p.id}
            onSelect={() => onSelectProvider(p.id)}
          />
        ))}
      </div>

      <div className="flex justify-end px-4 pb-4">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </>
  );
}

interface Step2Props {
  presentation: "dialog" | "inline";
  provider: ProviderInfo;
  isSqlite: boolean;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
  testing: boolean;
  testResult: { success: boolean; error?: string } | null;
  onTestConnection: () => void;
  onBack: () => void;
  onSaveAndContinue: () => void;
  canContinue: boolean;
  migrating: boolean;
}

function SetupWizardStep2({
  presentation,
  provider,
  isSqlite,
  credentials,
  onCredentialChange,
  testing,
  testResult,
  onTestConnection,
  onBack,
  onSaveAndContinue,
  canContinue,
  migrating,
}: Step2Props) {
  return (
    <>
      <SetupWizardHeader title={`Configure ${provider.name}`} presentation={presentation} />

      <div className="space-y-4 p-4">
        {isSqlite ? (
          <p className="font-mono text-dim text-w-sm">
            No configuration needed. SQLite stores data locally.
          </p>
        ) : (
          provider.fields.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
              <Input
                id={`field-${field.key}`}
                type={field.type}
                placeholder={field.placeholder}
                required={field.required}
                value={credentials[field.key] ?? ""}
                onChange={(e) => onCredentialChange(field.key, e.target.value)}
                className="w-full"
              />
              {Boolean(field.helpText) && (
                <p className="mt-1 font-mono text-dim text-w-sm">{field.helpText}</p>
              )}
            </div>
          ))
        )}

        {!isSqlite && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onTestConnection}
              disabled={testing}
              uppercase={false}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            {Boolean(testResult) && (
              <span
                className={cn(
                  "font-mono text-w-sm",
                  testResult?.success ? "text-success" : "text-destructive"
                )}
              >
                {testResult?.success ? "Connected" : (testResult?.error ?? "Failed")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between px-4 pb-4">
        <Button variant="ghost" onClick={onBack} uppercase={false}>
          Back
        </Button>
        <Button onClick={onSaveAndContinue} disabled={!canContinue || migrating} uppercase={false}>
          {migrating ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </>
  );
}

interface Step3Props {
  presentation: "dialog" | "inline";
  migrationResult: { executed?: boolean; migrationSql?: string } | null;
  onComplete: () => void;
}

function SetupWizardStep3({ presentation, migrationResult, onComplete }: Step3Props) {
  return (
    <>
      <SetupWizardHeader title="Setup Complete" presentation={presentation} />

      <div className="space-y-3 p-4">
        {Boolean(migrationResult?.executed) && (
          <p className="font-mono text-success text-w-sm">Tables created.</p>
        )}
        {Boolean(migrationResult?.migrationSql) && (
          <div>
            <p className="mb-2 font-mono text-dim text-w-sm">Run this SQL in your database:</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-item border border-border bg-surface p-3 font-mono text-muted-foreground text-w-sm">
              {migrationResult?.migrationSql}
            </pre>
          </div>
        )}
        {!migrationResult?.executed && !migrationResult?.migrationSql && (
          <p className="font-mono text-dim text-w-sm">Configuration saved. Database is ready.</p>
        )}
      </div>

      <div className="flex justify-end px-4 pb-4">
        <Button onClick={onComplete} uppercase={false}>
          Go to Dashboard
        </Button>
      </div>
    </>
  );
}

export function SetupWizard({ open, onComplete, presentation = "dialog" }: SetupWizardProps) {
  const [setupStep, setSetupStep] = useQueryState("setup", parseAsStringLiteral(SETUP_STEPS));
  const step = open ? (Number(setupStep ?? "1") as 1 | 2 | 3) : 1;
  const setStep = useCallback(
    (s: 1 | 2 | 3) => {
      setSetupStep(open ? (String(s) as (typeof SETUP_STEPS)[number]) : null);
    },
    [open, setSetupStep]
  );

  // Sync: when wizard opens, ensure URL has setup=1
  if (open && setupStep === null) {
    setSetupStep("1");
  }

  const [wizardState, setWizardState] = useState<{
    credentials: Record<string, string>;
    migrating: boolean;
    migrationResult: { executed?: boolean; migrationSql?: string } | null;
    selectedProvider: DatabaseProvider;
    testResult: { success: boolean; error?: string } | null;
    testing: boolean;
  }>({
    credentials: {},
    migrating: false,
    migrationResult: null,
    selectedProvider: "sqlite",
    testResult: null,
    testing: false,
  });
  const { credentials, migrating, migrationResult, selectedProvider, testResult, testing } =
    wizardState;

  const provider: ProviderInfo =
    DATABASE_PROVIDERS.find((p) => p.id === selectedProvider) ??
    (DATABASE_PROVIDERS[0] as ProviderInfo);
  const isSqlite = selectedProvider === "sqlite";

  const handleTestConnection = useCallback(async () => {
    setWizardState((current) => ({ ...current, testing: true, testResult: null }));
    try {
      const res = await fetch(API_ROUTES.databaseTest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, config: credentials }),
      });
      const data = await res.json();
      setWizardState((current) => ({ ...current, testResult: data }));
    } catch {
      setWizardState((current) => ({
        ...current,
        testResult: { success: false, error: "Network error" },
      }));
    } finally {
      setWizardState((current) => ({ ...current, testing: false }));
    }
  }, [selectedProvider, credentials]);

  const handleSaveAndContinue = useCallback(async () => {
    setWizardState((current) => ({ ...current, migrating: true }));
    try {
      await fetch(API_ROUTES.databaseConfig, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, config: credentials }),
      });
      const migrateRes = await fetch(API_ROUTES.databaseMigrate, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, config: credentials }),
      });
      const migrateData = await migrateRes.json();
      setWizardState((current) => ({ ...current, migrationResult: migrateData }));
    } catch {
      setWizardState((current) => ({
        ...current,
        migrationResult: { executed: false, migrationSql: undefined },
      }));
    } finally {
      setWizardState((current) => ({ ...current, migrating: false }));
      setStep(3);
    }
  }, [selectedProvider, credentials, setStep]);

  const handleSelectProvider = useCallback((id: DatabaseProvider) => {
    setWizardState((current) => ({
      ...current,
      selectedProvider: id,
      credentials: {},
      testResult: null,
    }));
  }, []);

  const handleCredentialChange = useCallback((key: string, value: string) => {
    setWizardState((current) => ({
      ...current,
      credentials: { ...current.credentials, [key]: value },
    }));
  }, []);

  const handleBackToStep1 = useCallback(() => {
    setStep(1);
    setWizardState((current) => ({ ...current, testResult: null }));
  }, [setStep]);

  const canContinueStep2 = isSqlite || testResult?.success === true;

  const content = (
    <>
      {step === 1 && (
        <SetupWizardStep1
          presentation={presentation}
          selectedProvider={selectedProvider}
          onSelectProvider={handleSelectProvider}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <SetupWizardStep2
          presentation={presentation}
          provider={provider}
          isSqlite={isSqlite}
          credentials={credentials}
          onCredentialChange={handleCredentialChange}
          testing={testing}
          testResult={testResult}
          onTestConnection={handleTestConnection}
          onBack={handleBackToStep1}
          onSaveAndContinue={handleSaveAndContinue}
          canContinue={canContinueStep2}
          migrating={migrating}
        />
      )}

      {step === 3 && (
        <SetupWizardStep3
          presentation={presentation}
          migrationResult={migrationResult}
          onComplete={() => {
            setSetupStep(null);
            onComplete();
          }}
        />
      )}
    </>
  );

  if (presentation === "inline") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl border border-border bg-surface">{content}</div>
      </div>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent
        size="sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogDescription className="sr-only">Database setup wizard</DialogDescription>
        {content}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { AlertTriangle, CheckCircle2, Download, Github, Loader2, XCircle } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useReducer, useRef, useState } from "react";
import useSWR from "swr";

interface SingleValidationResult {
  valid: boolean;
  category: string | null;
  id: string | null;
  name: string | null;
  description: string | null;
  errors: string[];
  warnings: string[];
}

interface PackageExtensionResult {
  name: string;
  type: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface PackageValidationResult {
  isPackage: true;
  valid: boolean;
  manifest: { name: string; extensions: Array<{ type: string; name: string }> } | null;
  extensions: PackageExtensionResult[];
  errors: string[];
  warnings: string[];
}

type UnifiedValidationResult =
  | { kind: "package"; result: PackageValidationResult }
  | { kind: "single"; result: SingleValidationResult };

/** Normalized shape for display. */
interface ValidationDisplay {
  valid: boolean;
  name: string | null;
  description: string | null;
  category: string | null;
  isPackage: boolean;
  extensionCount: number;
  extensionTypes: string[];
  errors: string[];
  warnings: string[];
}

interface InstallProgress {
  step: string;
  status: "running" | "done" | "error";
  message?: string;
}

interface InstallResultEvent {
  success: boolean;
  error?: string;
}

type Phase = "idle" | "validating" | "valid" | "invalid" | "installing" | "installed" | "error";

type InstallState = {
  installError: string | null;
  phase: Extract<Phase, "idle" | "installing" | "installed" | "error">;
  progress: InstallProgress[];
};

type InstallAction =
  | { type: "reset" }
  | { type: "start-install" }
  | { type: "progress"; progress: InstallProgress }
  | { type: "install-error"; error: string }
  | { type: "install-complete" };

const CATEGORY_LABELS: Record<string, string> = {
  integration: "Integration",
  plugin: "Plugin",
  widget: "Widget",
};

function mergeInstallProgress(
  previous: InstallProgress[],
  next: InstallProgress
): InstallProgress[] {
  const index = previous.findIndex((progress) => progress.step === next.step);
  if (index >= 0) {
    const updated = [...previous];
    updated[index] = next;
    return updated;
  }

  return [...previous, next];
}

async function readInstallStream(
  stream: ReadableStream<Uint8Array>,
  onProgress: (progress: InstallProgress) => void,
  onResult: (result: InstallResultEvent) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (!chunk.startsWith("data: ")) continue;

      const data = JSON.parse(chunk.slice(6)) as
        | ({ type: "progress" } & InstallProgress)
        | { type: "result"; success: boolean; error?: string };

      if (data.type === "progress") {
        onProgress(data);
        continue;
      }

      onResult({ success: data.success, error: data.error });
    }
  }
}

function installStateReducer(state: InstallState, action: InstallAction): InstallState {
  switch (action.type) {
    case "reset":
      return {
        installError: null,
        phase: "idle",
        progress: [],
      };
    case "start-install":
      return {
        installError: null,
        phase: "installing",
        progress: [],
      };
    case "progress":
      return {
        ...state,
        progress: mergeInstallProgress(state.progress, action.progress),
      };
    case "install-error":
      return {
        ...state,
        installError: action.error,
        phase: "error",
      };
    case "install-complete":
      return {
        ...state,
        installError: null,
        phase: "installed",
      };
    default:
      return state;
  }
}

function normalizeValidation(unified: UnifiedValidationResult): ValidationDisplay {
  if (unified.kind === "package") {
    const pkg = unified.result;
    const types = pkg.manifest?.extensions.map((e) => e.type) ?? [];
    return {
      valid: pkg.valid,
      name: pkg.manifest?.name ?? null,
      description: null,
      category: null,
      isPackage: true,
      extensionCount: pkg.manifest?.extensions.length ?? 0,
      extensionTypes: [...new Set(types)],
      errors: [
        ...pkg.errors,
        ...pkg.extensions.flatMap((e) => e.errors.map((err) => `${e.name}: ${err}`)),
      ],
      warnings: [
        ...pkg.warnings,
        ...pkg.extensions.flatMap((e) => e.warnings.map((w) => `${e.name}: ${w}`)),
      ],
    };
  }

  const single = unified.result;
  return {
    valid: single.valid,
    name: single.name,
    description: single.description,
    category: single.category,
    isPackage: false,
    extensionCount: 1,
    extensionTypes: single.category ? [single.category] : [],
    errors: single.errors,
    warnings: single.warnings,
  };
}

async function validateExtension([url, githubUrl]: [
  url: string,
  githubUrl: string,
]): Promise<ValidationDisplay> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubUrl }),
  });
  const result = (await response.json()) as UnifiedValidationResult & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Validation failed.");
  }

  return normalizeValidation(result);
}

function derivePhase(params: {
  trimmedGithubUrl: string;
  installPhase: InstallState["phase"];
  validation: ValidationDisplay | undefined;
  validationLoading: boolean;
  validationRequestError: unknown;
}): Phase {
  const { trimmedGithubUrl, installPhase, validation, validationLoading, validationRequestError } =
    params;

  if (installPhase === "installing" || installPhase === "installed" || installPhase === "error") {
    return installPhase;
  }

  if (!trimmedGithubUrl?.includes("/")) {
    return "idle";
  }

  if (validationLoading) {
    return "validating";
  }

  if (validation) {
    return validation.valid ? "valid" : "invalid";
  }

  if (validationRequestError) {
    return "invalid";
  }

  return "idle";
}

function deriveInstallError(params: {
  installError: string | null;
  validationRequestError: unknown;
  validation: ValidationDisplay | undefined;
}): string | null {
  const { installError, validationRequestError, validation } = params;

  if (installError) {
    return installError;
  }

  if (validationRequestError instanceof Error) {
    return validationRequestError.message;
  }

  if (validation && !validation.valid) {
    return validation.errors?.join("\n") ?? "Validation failed.";
  }

  return null;
}

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === "validating") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (phase === "valid") {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }

  if (phase === "invalid") {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }

  return <Github className="h-4 w-4 text-muted-foreground" />;
}

function ValidationDetails({
  phase,
  installError,
  validation,
  onInstall,
}: {
  phase: Phase;
  installError: string | null;
  validation: ValidationDisplay | undefined;
  onInstall: () => void;
}) {
  if (phase === "invalid" && installError) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-w-sm">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <pre className="whitespace-pre-wrap font-sans">{installError}</pre>
      </div>
    );
  }

  if (phase !== "valid" || !validation) {
    return null;
  }

  const typeLabels = validation.extensionTypes.map((t) => CATEGORY_LABELS[t] ?? t);
  const installLabel = validation.isPackage
    ? "Install Package"
    : `Install ${CATEGORY_LABELS[validation.category ?? ""] ?? "Item"}`;

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{validation.name}</p>
          {validation.description ? (
            <p className="text-muted-foreground text-w-sm">{validation.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {typeLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-accent px-2.5 py-0.5 font-medium text-accent-foreground text-w-xs"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {validation.warnings.length > 0 ? (
        <div className="space-y-1 border-border border-t pt-2">
          {validation.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 text-muted-foreground text-w-xs">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        onClick={onInstall}
        fullWidth
        variant="default"
        uppercase={false}
        className="gap-2 rounded-card font-medium text-w-sm"
      >
        <Download className="h-4 w-4" />
        {installLabel}
      </Button>
    </div>
  );
}

function GithubRepositoryField({
  githubUrl,
  inputRef,
  onGithubUrlChange,
  phase,
  installError,
  validation,
  onInstall,
}: {
  githubUrl: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onGithubUrlChange: (value: string) => void;
  phase: Phase;
  installError: string | null;
  validation: ValidationDisplay | undefined;
  onInstall: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label
          htmlFor="extension-installer-github-url"
          className="font-medium text-foreground text-w-sm normal-case tracking-normal"
        >
          GitHub Repository
        </Label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <PhaseIcon phase={phase} />
          </div>
          <Input
            ref={inputRef}
            id="extension-installer-github-url"
            type="text"
            value={githubUrl}
            onChange={(event) => onGithubUrlChange(event.target.value)}
            placeholder="owner/repo"
            variant="surface"
            size="lg"
            className="bg-background pr-3 pl-9 text-w-sm"
          />
        </div>
        <p className="text-muted-foreground text-w-xs">
          Paste a GitHub URL or use the owner/repo shorthand.
        </p>
      </div>

      <ValidationDetails
        phase={phase}
        installError={installError}
        validation={validation}
        onInstall={onInstall}
      />
    </>
  );
}

function InstallProgressList({ progress }: { progress: InstallProgress[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-medium text-w-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Installing...
      </div>
      <div className="space-y-2">
        {progress.map((step) => (
          <div key={step.step} className="flex items-center gap-2 text-w-sm">
            {step.status === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
            {step.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : null}
            {step.status === "error" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : null}
            <span className={step.status === "done" ? "text-muted-foreground" : "text-foreground"}>
              {step.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstallErrorState({
  installError,
  onReset,
}: {
  installError: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-w-sm">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{installError}</span>
      </div>
      <Button
        type="button"
        onClick={onReset}
        variant="outline"
        uppercase={false}
        className="rounded-card text-w-sm"
      >
        Try again
      </Button>
    </div>
  );
}

function InstallSuccessState({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-success/50 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div className="space-y-1">
          <p className="font-medium text-success">Installed successfully</p>
          <p className="text-muted-foreground text-w-sm">
            Restart the dev server or trigger a new build for the extension to take effect.
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={onDone}
        fullWidth
        variant="default"
        uppercase={false}
        className="rounded-card font-medium text-w-sm"
      >
        Done
      </Button>
    </div>
  );
}

export function InstallExtensionDialog({
  open,
  onOpenChange,
  initialGithubUrl = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGithubUrl?: string;
}) {
  const [githubUrl, setGithubUrl] = useState("");
  const [installState, dispatch] = useReducer(installStateReducer, {
    installError: null,
    phase: "idle",
    progress: [],
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trimmedGithubUrl = githubUrl.trim();
  const deferredGithubUrl = useDeferredValue(trimmedGithubUrl);
  const shouldValidate =
    open && trimmedGithubUrl.includes("/") && installState.phase !== "installing";
  const validationKey = shouldValidate
    ? (["/api/extensions/validate", deferredGithubUrl] as const)
    : null;
  const {
    data: validation,
    error: validationRequestError,
    isLoading: validationLoading,
  } = useSWR(validationKey, validateExtension, {
    revalidateOnFocus: false,
  });

  const phase = derivePhase({
    trimmedGithubUrl,
    installPhase: installState.phase,
    validation,
    validationLoading,
    validationRequestError,
  });
  const installError = deriveInstallError({
    installError: installState.installError,
    validationRequestError,
    validation,
  });

  const reset = useCallback(() => {
    setGithubUrl("");
    dispatch({ type: "reset" });
  }, []);

  useEffect(() => {
    if (!open || phase === "installing" || phase === "installed") return;
    inputRef.current?.focus();
  }, [open, phase]);

  useEffect(() => {
    if (!open) return;
    setGithubUrl(initialGithubUrl);
    dispatch({ type: "reset" });
  }, [initialGithubUrl, open]);

  const handleInstall = useCallback(async () => {
    dispatch({ type: "start-install" });

    try {
      const res = await fetch(API_ROUTES.extensionsInstall, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: githubUrl.trim() }),
      });

      if (!res.body) {
        dispatch({ type: "install-error", error: "No response stream" });
        return;
      }

      await readInstallStream(
        res.body,
        (progressEvent) => {
          dispatch({ type: "progress", progress: progressEvent });
        },
        (resultEvent) => {
          dispatch(
            resultEvent.success
              ? { type: "install-complete" }
              : { type: "install-error", error: resultEvent.error ?? "Installation failed." }
          );
        }
      );
    } catch (err) {
      dispatch({
        type: "install-error",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [githubUrl]);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Install from GitHub
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {phase !== "installing" && phase !== "installed" ? (
            <GithubRepositoryField
              githubUrl={githubUrl}
              inputRef={inputRef}
              onGithubUrlChange={setGithubUrl}
              phase={phase}
              installError={installError}
              validation={validation}
              onInstall={handleInstall}
            />
          ) : null}

          {phase === "installing" ? <InstallProgressList progress={installState.progress} /> : null}

          {phase === "error" && installError ? (
            <InstallErrorState installError={installError} onReset={reset} />
          ) : null}

          {phase === "installed" ? <InstallSuccessState onDone={() => handleClose(false)} /> : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { AlertTriangle, CheckCircle2, Info, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useResolvedData } from "../../data-resolver";
import type { AlertSectionConfig } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { evaluateCondition } from "../../utils/evaluate-condition";
import { formatValue } from "../../utils/format-value";
import { getByPath } from "../../utils/get-by-path";

const SEVERITY_STYLES = {
  error: {
    container: "border-[#421515] bg-[#1a0808] text-[#f0b4b4]",
    icon: AlertTriangle,
    iconClassName: "text-destructive",
  },
  warning: {
    container: "border-[#403200] bg-[#1a1500] text-[#f0dd9f]",
    icon: AlertTriangle,
    iconClassName: "text-[#d3a438]",
  },
  info: {
    container: "border-[#203449] bg-[#0d1720] text-[#b4d5f4]",
    icon: Info,
    iconClassName: "text-accent",
  },
  success: {
    container: "border-[#1f3a2b] bg-[#0c1710] text-[#b9e3c9]",
    icon: CheckCircle2,
    iconClassName: "text-success",
  },
  setup: {
    container: "border-[#243652] bg-[#101827] text-[#bfd0ee]",
    icon: Wrench,
    iconClassName: "text-[#7aa2ff]",
  },
} as const;

function interpolateMessage(
  message: string,
  sourceData: unknown,
  options: { locale: string; timeZone: string }
): string {
  return message.replaceAll(/\{\{([^}]+)\}\}/g, (_, token: string) => {
    if (token.trim() === "value") {
      return formatValue(sourceData, undefined, options);
    }
    const value = getByPath(sourceData, token.trim());
    return formatValue(value, undefined, options);
  });
}

export function AlertSection({ config }: { config: AlertSectionConfig }) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const { locale, timeZone } = useTemplateFormatting();
  const sourceData = useResolvedData(config.source, { disableItemContext: true });
  const conditionValue = useResolvedData(config.condition?.source, {
    disableItemContext: true,
  });

  const isVisible = useMemo(() => {
    if (!config.condition) return true;
    return evaluateCondition(conditionValue, config.condition.operator, config.condition.value);
  }, [conditionValue, config.condition]);

  const message = useMemo(() => {
    if (!config.source) return config.message;
    return interpolateMessage(config.message, sourceData, { locale, timeZone });
  }, [config.message, config.source, locale, sourceData, timeZone]);

  const hasRenderableMessage = useMemo(() => {
    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed !== "—";
  }, [message]);
  const isDismissed = dismissedMessage === message;

  if (!isVisible || isDismissed || !hasRenderableMessage) {
    return null;
  }

  const style = SEVERITY_STYLES[config.severity];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-item border px-3 py-2 font-mono text-w-sm",
        style.container
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={cn("icon-xs mt-0.5 shrink-0", style.iconClassName)} />
        <div className="min-w-0 leading-relaxed">{message}</div>
      </div>

      <div className="flex items-center gap-2">
        {config.action?.href ? (
          <a
            href={config.action.href}
            className="shrink-0 text-[#f4f4f4] underline decoration-[#555] underline-offset-2 hover:decoration-[#bbb]"
          >
            {config.action.label}
          </a>
        ) : null}

        {config.dismissible ? (
          <Button
            type="button"
            variant="ghost-link"
            spacing="none"
            uppercase={false}
            onClick={() => setDismissedMessage(message)}
            className="shrink-0 text-dim transition-colors hover:text-foreground-secondary"
            aria-label="Dismiss alert"
          >
            <X className="icon-xs" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

export type InfoRowDensity = "compact" | "default";

interface BaseInfoRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleStart?: ReactNode;
  subtitleEnd?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  trailingBottom?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  subtitleStartClassName?: string;
  subtitleEndClassName?: string;
  trailingClassName?: string;
  density?: InfoRowDensity;
  divider?: boolean;
  active?: boolean;
}

interface LinkInfoRowProps extends BaseInfoRowProps {
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  onClick?: never;
}

interface ButtonInfoRowProps extends BaseInfoRowProps {
  href?: never;
  onClick: () => void;
}

interface PassiveInfoRowProps extends BaseInfoRowProps {
  href?: never;
  onClick?: never;
}

export type InfoRowProps = LinkInfoRowProps | ButtonInfoRowProps | PassiveInfoRowProps;

function Subtitle({
  subtitle,
  subtitleStart,
  subtitleEnd,
  subtitleClassName,
  subtitleStartClassName,
  subtitleEndClassName,
}: Pick<
  InfoRowProps,
  | "subtitle"
  | "subtitleStart"
  | "subtitleEnd"
  | "subtitleClassName"
  | "subtitleStartClassName"
  | "subtitleEndClassName"
>) {
  if (subtitle) {
    return (
      <div className={cn("mt-0.5 truncate text-dim text-w-xs", subtitleClassName)}>{subtitle}</div>
    );
  }

  if (subtitleStart || subtitleEnd) {
    return (
      <div
        className={cn("mt-1 flex min-w-0 items-center justify-between gap-3", subtitleClassName)}
      >
        <div className={cn("flex min-w-0 items-center gap-1.5", subtitleStartClassName)}>
          {subtitleStart}
        </div>
        <div className={cn("shrink-0 whitespace-nowrap", subtitleEndClassName)}>{subtitleEnd}</div>
      </div>
    );
  }

  return null;
}

function Trailing({
  trailing,
  trailingBottom,
  trailingClassName,
}: Pick<InfoRowProps, "trailing" | "trailingBottom" | "trailingClassName">) {
  if (!trailing && !trailingBottom) return null;

  return (
    <div
      className={cn("ml-auto flex shrink-0 flex-col items-end gap-1 text-right", trailingClassName)}
    >
      {Boolean(trailing) && <div>{trailing}</div>}
      {Boolean(trailingBottom) && <div className="text-dim text-w-xs">{trailingBottom}</div>}
    </div>
  );
}

export function InfoRow(props: InfoRowProps) {
  const {
    leading,
    title,
    subtitle,
    subtitleStart,
    subtitleEnd,
    meta,
    trailing,
    trailingBottom,
    className,
    titleClassName,
    subtitleClassName,
    subtitleStartClassName,
    subtitleEndClassName,
    trailingClassName,
    density = "default",
    divider = false,
    active = false,
  } = props;

  const interactive = typeof props.href === "string" || typeof props.onClick === "function";
  const getComponent = () => {
    if (props.href) return "a" as const;
    if (props.onClick) return "button" as const;
    return "div" as const;
  };
  const Component = getComponent();

  return (
    <Component
      {...(props.href ? { href: props.href, target: props.target, rel: props.rel } : {})}
      {...(props.onClick ? { onClick: props.onClick, type: "button" } : {})}
      className={cn(
        "group flex w-full items-start gap-3 rounded-none text-left transition-interactive",
        density === "compact" ? "px-3 py-1.5" : "px-3 py-2.5",
        divider && "border-border border-b",
        interactive && "cursor-pointer hover:bg-surface-raised",
        active && "bg-surface-raised",
        className
      )}
    >
      {Boolean(leading) && <div className="mt-0.5 shrink-0">{leading}</div>}

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate font-medium text-foreground",
            density === "compact" ? "text-w-sm" : "text-w-base",
            titleClassName
          )}
        >
          {title}
        </div>

        <Subtitle
          subtitle={subtitle}
          subtitleStart={subtitleStart}
          subtitleEnd={subtitleEnd}
          subtitleClassName={subtitleClassName}
          subtitleStartClassName={subtitleStartClassName}
          subtitleEndClassName={subtitleEndClassName}
        />

        {Boolean(meta) && (
          <div className={cn("mt-1 shrink-0 font-mono text-dim text-w-xs", subtitleClassName)}>
            {meta}
          </div>
        )}
      </div>

      <Trailing
        trailing={trailing}
        trailingBottom={trailingBottom}
        trailingClassName={trailingClassName}
      />
    </Component>
  );
}

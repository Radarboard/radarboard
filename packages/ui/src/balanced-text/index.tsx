"use client";

import { type CSSProperties, createElement, type ReactNode, useEffect, useState } from "react";
import Balancer from "react-wrap-balancer";

export interface BalancedTextProps {
  children: ReactNode;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4";
  className?: string;
  style?: CSSProperties;
  ratio?: number;
  preferNative?: boolean;
}

export function BalancedText({
  children,
  as = "span",
  className,
  style,
  ratio,
  preferNative = true,
}: BalancedTextProps) {
  const [shouldUseFallback, setShouldUseFallback] = useState(false);

  useEffect(() => {
    if (!preferNative || typeof CSS === "undefined" || !CSS.supports("text-wrap", "balance")) {
      setShouldUseFallback(true);
    }
  }, [preferNative]);

  if (shouldUseFallback) {
    return (
      <Balancer as={as} className={className} ratio={ratio}>
        {children}
      </Balancer>
    );
  }

  return createElement(as, {
    className,
    style: { ...style, textWrap: "balance" },
    children,
  });
}

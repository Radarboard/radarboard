"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";

export function useTemplateFormatting() {
  const locale = useEffectiveLocale();
  const timeZone = useEffectiveTimeZone();

  return { locale, timeZone } as const;
}

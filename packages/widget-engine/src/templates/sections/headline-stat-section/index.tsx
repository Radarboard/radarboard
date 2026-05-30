"use client";

import { HeadlineStat } from "../../../components/headline-stat";
import { useResolvedData } from "../../data-resolver";
import type { HeadlineStatSectionConfig } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue } from "../../utils/format-value";

export function HeadlineStatSection({ config }: { config: HeadlineStatSectionConfig }) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(config.source);

  return (
    <HeadlineStat
      value={formatValue(value, config.source.format, {
        locale,
        normalize: config.source.normalize,
        timeZone,
      })}
      label={config.label}
      indicatorColor={config.indicatorColor}
    />
  );
}

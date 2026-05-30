"use client";

import { SettingsSectionNav } from "../section-nav";

interface SettingsCategoryTabsProps {
  categories: ReadonlyArray<{ id: string; label: string }>;
  activeCategoryId: string | null;
  onChange: (categoryId: string | null) => void;
}

export function SettingsCategoryTabs({
  categories,
  activeCategoryId,
  onChange,
}: SettingsCategoryTabsProps) {
  return (
    <SettingsSectionNav
      items={categories}
      activeId={activeCategoryId}
      onChange={onChange}
      includeAll
    />
  );
}

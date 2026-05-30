export interface CategorySection<TItemId extends string = string> {
  id: string;
  label: string;
  itemIds: TItemId[];
}

export function normalizeCategoryId(
  categoryId: string | null | undefined,
  categories: ReadonlyArray<{ id: string }>
): string | null {
  if (!categoryId) return null;
  return categories.some((category) => category.id === categoryId) ? categoryId : null;
}

export function filterCategorySections<TItemId extends string>({
  categories,
  activeCategoryId,
  matchingIds,
}: {
  categories: ReadonlyArray<CategorySection<TItemId>>;
  activeCategoryId: string | null;
  matchingIds: ReadonlySet<TItemId> | null;
}): CategorySection<TItemId>[] {
  const baseSections =
    activeCategoryId === null
      ? categories
      : categories.filter((category) => category.id === activeCategoryId);

  const filteredSections =
    matchingIds === null
      ? baseSections.map((category) => ({ ...category, itemIds: [...category.itemIds] }))
      : baseSections.map((category) => ({
          ...category,
          itemIds: category.itemIds.filter((itemId) => matchingIds.has(itemId)),
        }));

  return activeCategoryId === null
    ? filteredSections.filter((category) => category.itemIds.length > 0)
    : filteredSections;
}

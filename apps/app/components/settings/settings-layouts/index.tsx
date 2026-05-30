"use client";

import { createDefaultDashboardPage } from "@radarboard/hooks/dashboard-layout";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { LayoutDefinition } from "@radarboard/types/database";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { DemoGuard } from "@radarboard/ui/demo-guard";
import type { LayoutBlueprintDescriptor } from "@radarboard/widget-engine/blueprints";
import { applyBlueprint } from "@radarboard/widget-engine/blueprints/apply";
import {
  BASIC_3X3,
  createEqualColumnRowSizes,
  createEqualTrackSizes,
  generateCellId,
  getLayoutDimensions,
  resolveColSizes,
  resolveColumnRowSizes,
  summarizeColumnRowSizes,
} from "@radarboard/widget-engine/layouts";
import { parseAsString, useQueryState } from "nuqs";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  readStoredSettingsLayoutSelection,
  writeStoredSettingsLayoutSelection,
} from "../settings-storage";
import { DuplicateLayoutDialog, type DuplicateTarget } from "./clone-dialog";
import { LayoutDetailPanel, type LayoutUpdateMeta, MiniGridPreview } from "./layout-detail-panel";
import { LayoutListPanel } from "./layout-list-panel";
import { LayoutPresetPicker } from "./preset-picker";

// Re-export MiniGridPreview for external consumers
export { MiniGridPreview };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneLayoutWithFreshCellIds(layout: LayoutDefinition): LayoutDefinition {
  const columnRowSizes = resolveColumnRowSizes(layout);
  return {
    ...layout,
    cells: layout.cells.map((cell) => ({ ...cell, id: generateCellId() })),
    colSizes: [...resolveColSizes(layout)],
    rowSizes: [...summarizeColumnRowSizes(columnRowSizes)],
    columnRowSizes: columnRowSizes.map((sizes) => [...sizes]),
  };
}

/**
 * Build widget assignments with cell IDs remapped from a source layout to a cloned layout.
 * Source and clone must have the same number of cells (just different IDs).
 */
function remapWidgetAssignments(
  sourceLayout: LayoutDefinition,
  clonedLayout: LayoutDefinition,
  assignments: Record<string, string | null>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (let i = 0; i < sourceLayout.cells.length; i++) {
    const sourceCell = sourceLayout.cells[i];
    const clonedCell = clonedLayout.cells[i];
    if (sourceCell && clonedCell) {
      result[clonedCell.id] = assignments[sourceCell.id] ?? null;
    }
  }
  return result;
}

/**
 * Resolve the initial layout selection from URL param or localStorage.
 * Returns the id to select, or null if no change is needed.
 */
function resolveInitialLayoutId(
  urlParam: string | null,
  layouts: LayoutDefinition[],
  currentId: string
): string | null {
  if (urlParam && layouts.some((l) => l.id === urlParam) && urlParam !== currentId) {
    return urlParam;
  }
  if (typeof window === "undefined") return null;
  const stored = readStoredSettingsLayoutSelection(window.localStorage);
  if (stored && layouts.some((l) => l.id === stored) && stored !== currentId) {
    return stored;
  }
  return null;
}

function LayoutsWorkspace({
  activeLayoutId,
  deleteDialogOpen,
  duplicateDialogOpen,
  editorNotice,
  filteredLayouts,
  handleBalanceColumns,
  handleBalanceRows,
  handleBalanceTracks,
  handleAssignLayoutToTarget,
  handleCreateLayout,
  handleDelete,
  handleDuplicateConfirm,
  handleDuplicateLayout,
  handlePresetSelect,
  handleBlueprintSelect,
  handleResetLayout,
  handleUpdateLayout,
  handleUpdateName,
  isDefault,
  layouts,
  presetPickerOpen,
  projectLayouts,
  projects,
  search,
  setSearch,
  selectedLayout,
  selectedUsageCount,
  setEditorNotice,
  setLayoutDialogParam,
  setSelectedId,
  sourcePageName,
  sourceProjectName,
  usageMap,
  preferences,
  defaultAssignmentTargetKey,
}: {
  activeLayoutId: string | null;
  deleteDialogOpen: boolean;
  duplicateDialogOpen: boolean;
  editorNotice: string | null;
  filteredLayouts: LayoutDefinition[];
  handleBalanceColumns: () => void;
  handleBalanceRows: () => void;
  handleBalanceTracks: () => void;
  handleAssignLayoutToTarget: (ownerSlug: string, pageSlug: string) => void;
  handleCreateLayout: () => void;
  handleDelete: () => void;
  handleDuplicateConfirm: (target: DuplicateTarget, pageName: string) => void;
  handleDuplicateLayout: () => void;
  handlePresetSelect: (baseLayout: LayoutDefinition) => void;
  handleBlueprintSelect: (blueprint: LayoutBlueprintDescriptor) => void;
  handleResetLayout: () => void;
  handleUpdateLayout: (nextLayout: LayoutDefinition, meta?: LayoutUpdateMeta) => void;
  handleUpdateName: (name: string) => void;
  isDefault: boolean;
  layouts: LayoutDefinition[];
  presetPickerOpen: boolean;
  preferences: ReturnType<typeof useDashboard>["preferences"];
  projectLayouts: ReturnType<typeof useDashboard>["projectLayouts"];
  projects: ReturnType<typeof useDashboard>["projects"];
  search: string;
  setSearch: (value: string) => void;
  selectedLayout: LayoutDefinition;
  selectedUsageCount: number;
  setEditorNotice: (value: string | null) => void;
  setLayoutDialogParam: (value: string | null) => void;
  setSelectedId: (id: string) => void;
  sourcePageName: string;
  sourceProjectName: string;
  usageMap: Record<string, number>;
  defaultAssignmentTargetKey: string | null;
}) {
  const assignmentTargets = useMemo(() => {
    const ownerSlugs = Array.from(
      new Set([
        ALL_PROJECTS_SLUG,
        ...projects.map((project) => project.slug),
        ...Object.keys(projectLayouts),
      ])
    );

    return ownerSlugs.flatMap((ownerSlug) => {
      const ownerName =
        ownerSlug === ALL_PROJECTS_SLUG
          ? "All Projects"
          : (projects.find((project) => project.slug === ownerSlug)?.name ?? ownerSlug);
      const pages = projectLayouts[ownerSlug]?.pages ?? [createDefaultDashboardPage()];

      return pages.map((page) => {
        const currentLayout = layouts.find((layout) => layout.id === page.layoutId) ?? BASIC_3X3;
        return {
          key: `${ownerSlug}:${page.slug}`,
          ownerSlug,
          ownerName,
          pageSlug: page.slug,
          pageName: page.name,
          currentLayoutId: currentLayout.id,
          currentLayoutName: currentLayout.name,
          currentAssignments: page.widgetLayouts?.[currentLayout.id] ?? {},
        };
      });
    });
  }, [layouts, projectLayouts, projects]);

  return (
    <div className="relative flex h-full min-h-0">
      <LayoutListPanel
        filteredLayouts={filteredLayouts}
        selectedLayoutId={selectedLayout.id}
        defaultLayoutId={BASIC_3X3.id}
        activeLayoutId={activeLayoutId ?? BASIC_3X3.id}
        usageMap={usageMap}
        search={search}
        onSearchChange={setSearch}
        onCreateLayout={handleCreateLayout}
        onSelectLayout={(id) => {
          setSelectedId(id);
          setLayoutDialogParam(null);
          setEditorNotice(null);
        }}
        onClearNotice={() => setEditorNotice(null)}
      />

      <LayoutDetailPanel
        selectedLayout={selectedLayout}
        isDefault={isDefault}
        selectedUsageCount={selectedUsageCount}
        editorNotice={editorNotice}
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={(open) => setLayoutDialogParam(open ? "delete" : null)}
        onUpdateName={handleUpdateName}
        onUpdateLayout={handleUpdateLayout}
        onDuplicateLayout={handleDuplicateLayout}
        onBalanceColumns={handleBalanceColumns}
        onBalanceRows={handleBalanceRows}
        onBalanceTracks={handleBalanceTracks}
        onResetLayout={handleResetLayout}
        onDelete={handleDelete}
        assignmentTargets={assignmentTargets}
        defaultAssignmentTargetKey={defaultAssignmentTargetKey}
        onAssignLayoutToTarget={handleAssignLayoutToTarget}
      />

      <LayoutPresetPicker
        open={presetPickerOpen}
        onOpenChange={(open) => setLayoutDialogParam(open ? "preset" : null)}
        onSelect={handlePresetSelect}
        onSelectBlueprint={handleBlueprintSelect}
        personas={preferences.userProfile ? [preferences.userProfile] : []}
      />

      <DuplicateLayoutDialog
        open={duplicateDialogOpen}
        onOpenChange={(open) => setLayoutDialogParam(open ? "duplicate" : null)}
        layout={selectedLayout}
        sourceProjectName={sourceProjectName}
        sourcePageName={sourcePageName}
        projects={projects}
        onDuplicate={handleDuplicateConfirm}
      />
    </div>
  );
}

function useLayoutCreationHandlers({
  addProjectPage,
  layouts,
  pendingBlueprintWidgets,
  pendingSelectionRef,
  projects,
  selectedLayout,
  setEditorNotice,
  setLayoutDialogParam,
  setSelectedId,
  sourceAssignments,
  sourceOwnerSlug,
  sourceProjectName,
  updateLayouts,
  updateProjectLayout,
}: {
  addProjectPage: ReturnType<typeof useDashboard>["addProjectPage"];
  layouts: LayoutDefinition[];
  pendingBlueprintWidgets: MutableRefObject<{
    layoutId: string;
    assignments: Record<string, string | null>;
  } | null>;
  pendingSelectionRef: MutableRefObject<string | null>;
  projects: ReturnType<typeof useDashboard>["projects"];
  selectedLayout: LayoutDefinition;
  setEditorNotice: (value: string | null) => void;
  setLayoutDialogParam: (value: string | null) => void;
  setSelectedId: (id: string) => void;
  sourceAssignments: Record<string, string | null>;
  sourceOwnerSlug: string;
  sourceProjectName: string;
  updateLayouts: ReturnType<typeof useDashboard>["updateLayouts"];
  updateProjectLayout: ReturnType<typeof useDashboard>["updateProjectLayout"];
}) {
  const handlePresetSelect = useCallback(
    (baseLayout: LayoutDefinition) => {
      const newLayout = {
        ...cloneLayoutWithFreshCellIds(baseLayout),
        id: crypto.randomUUID(),
        name: baseLayout.name,
      };
      pendingSelectionRef.current = newLayout.id;
      updateLayouts([...layouts, newLayout]);
      setSelectedId(newLayout.id);
      setLayoutDialogParam(null);
      setEditorNotice(null);
    },
    [
      layouts,
      pendingSelectionRef,
      setEditorNotice,
      setLayoutDialogParam,
      setSelectedId,
      updateLayouts,
    ]
  );

  const handleBlueprintSelect = useCallback(
    (blueprint: LayoutBlueprintDescriptor) => {
      const result = applyBlueprint(blueprint, []);
      const newLayout = {
        ...cloneLayoutWithFreshCellIds(result.layout),
        id: crypto.randomUUID(),
        name: blueprint.name,
      };

      pendingBlueprintWidgets.current = {
        layoutId: newLayout.id,
        assignments: remapWidgetAssignments(result.layout, newLayout, result.widgetAssignments),
      };

      pendingSelectionRef.current = newLayout.id;
      updateLayouts([...layouts, newLayout]);
      setSelectedId(newLayout.id);
      setLayoutDialogParam(null);
      setEditorNotice(
        result.missingIntegrations.length > 0
          ? `Blueprint created. Missing integrations: ${result.missingIntegrations.join(", ")}. Click "Apply to current page" to use it.`
          : `Blueprint created. Click "Apply to current page" to use it.`
      );
    },
    [
      layouts,
      pendingBlueprintWidgets,
      pendingSelectionRef,
      setEditorNotice,
      setLayoutDialogParam,
      setSelectedId,
      updateLayouts,
    ]
  );

  const handleDuplicateConfirm = useCallback(
    (target: DuplicateTarget, pageName: string) => {
      const clonedLayout = {
        ...cloneLayoutWithFreshCellIds(selectedLayout),
        id: crypto.randomUUID(),
        name: `Copy of ${selectedLayout.name}`,
      };
      const remappedAssignments = remapWidgetAssignments(
        selectedLayout,
        clonedLayout,
        sourceAssignments
      );
      const updatedLayouts = [...layouts, clonedLayout];
      updateLayouts(updatedLayouts);

      const pageSlug =
        pageName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "copy";
      const newPage = createDefaultDashboardPage(
        {
          name: pageName,
          slug: pageSlug,
          layoutId: clonedLayout.id,
          widgetLayouts: { [clonedLayout.id]: remappedAssignments },
        },
        updatedLayouts
      );

      if (target.type === "same-project") {
        addProjectPage(sourceOwnerSlug, newPage);
        toast.success(`Layout duplicated as "${pageName}" in ${sourceProjectName}`);
      } else if (target.type === "existing-project") {
        addProjectPage(target.projectSlug, newPage);
        const targetProject = projects.find((project) => project.slug === target.projectSlug);
        toast.success(
          `Layout duplicated as "${pageName}" in ${targetProject?.name ?? target.projectSlug}`
        );
      } else {
        const newSlug =
          target.projectName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "new-project";
        updateProjectLayout(newSlug, { pages: [newPage] });
        toast.success(`Layout duplicated as "${pageName}" in new project "${target.projectName}"`);
      }

      pendingSelectionRef.current = clonedLayout.id;
      setSelectedId(clonedLayout.id);
      setEditorNotice(null);
      setLayoutDialogParam(null);
    },
    [
      addProjectPage,
      layouts,
      pendingSelectionRef,
      projects,
      selectedLayout,
      setEditorNotice,
      setLayoutDialogParam,
      setSelectedId,
      sourceAssignments,
      sourceOwnerSlug,
      sourceProjectName,
      updateLayouts,
      updateProjectLayout,
    ]
  );

  return { handleBlueprintSelect, handleDuplicateConfirm, handlePresetSelect };
}

// ---------------------------------------------------------------------------
// SettingsLayouts
// ---------------------------------------------------------------------------

export function SettingsLayouts() {
  const { isDemoMode } = useDemoMode();
  const {
    layouts,
    projectLayouts,
    updateLayouts,
    updateProjectLayout,
    addProjectPage,
    activeProjectSlug,
    activePageSlug,
    activePage,
    activeLayoutId,
    updateProjectPageLayout,
    preferences,
    projects,
  } = useDashboard();
  const [selectedLayoutParam, setSelectedLayoutParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.layout,
    parseAsString
  );
  const [layoutDialogParam, setLayoutDialogParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.layoutDialog,
    parseAsString
  );
  const [selectedId, setSelectedId] = useState<string>(BASIC_3X3.id);
  const deleteDialogOpen = layoutDialogParam === "delete";
  const duplicateDialogOpen = layoutDialogParam === "duplicate";
  const presetPickerOpen = layoutDialogParam === "preset";
  const [search, setSearch] = useState("");
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const hasHydratedSelectedLayout = useRef(false);
  // Track IDs that were just created but may not yet appear in `layouts`
  // (which is async via useDashboard). Prevents the "not found → reset" effect
  // from overwriting the selection before the new layout propagates.
  const pendingSelectionRef = useRef<string | null>(null);
  // Pending widget assignments from a blueprint selection, applied when
  // the user clicks "Apply to current page".
  const pendingBlueprintWidgets = useRef<{
    layoutId: string;
    assignments: Record<string, string | null>;
  } | null>(null);

  const selectedLayout =
    layouts.find((layout) => layout.id === selectedId) ?? layouts[0] ?? BASIC_3X3;
  const isDefault = selectedLayout.id === BASIC_3X3.id;

  const usageMap = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const config of Object.values(projectLayouts)) {
      for (const page of config.pages ?? []) {
        if (!page.layoutId) continue;
        counts[page.layoutId] = (counts[page.layoutId] ?? 0) + 1;
      }
    }
    return counts;
  }, [projectLayouts]);

  const filteredLayouts = useMemo(() => {
    if (!search.trim()) return layouts;
    const query = search.trim().toLowerCase();
    return layouts.filter((layout) => layout.name.toLowerCase().includes(query));
  }, [layouts, search]);

  // Hydrate selectedId once from URL param or localStorage on mount.
  // Skips entirely when a newly created layout is still propagating.
  useEffect(() => {
    if (layouts.length === 0) return;
    if (pendingSelectionRef.current) return;
    if (hasHydratedSelectedLayout.current) return;
    hasHydratedSelectedLayout.current = true;

    const resolved = resolveInitialLayoutId(selectedLayoutParam, layouts, selectedId);
    if (resolved) setSelectedId(resolved);
  }, [layouts, selectedId, selectedLayoutParam]);

  useEffect(() => {
    if (layouts.length === 0) return;
    if (layouts.some((layout) => layout.id === selectedId)) {
      // Clear the pending flag once the layout appears in the list
      if (pendingSelectionRef.current === selectedId) {
        pendingSelectionRef.current = null;
      }
      return;
    }
    // Don't reset if we're waiting for a newly created layout to propagate
    if (pendingSelectionRef.current === selectedId) return;
    setSelectedId(layouts[0]?.id ?? BASIC_3X3.id);
  }, [layouts, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip URL/storage sync while waiting for a newly created layout to
    // propagate through useDashboard — selectedLayout would be a stale
    // fallback and syncing it would trigger cascading effect loops.
    if (pendingSelectionRef.current) return;
    writeStoredSettingsLayoutSelection(window.localStorage, selectedLayout.id);
    if (selectedLayoutParam !== selectedLayout.id) {
      setSelectedLayoutParam(selectedLayout.id);
    }
  }, [selectedLayout.id, selectedLayoutParam, setSelectedLayoutParam]);

  const updateSelectedLayout = useCallback(
    (updater: (layout: LayoutDefinition) => LayoutDefinition) => {
      updateLayouts(layouts.map((layout) => (layout.id === selectedId ? updater(layout) : layout)));
    },
    [layouts, selectedId, updateLayouts]
  );

  const handleCreateLayout = useCallback(() => {
    setLayoutDialogParam("preset");
  }, [setLayoutDialogParam]);

  const handleDuplicateLayout = useCallback(() => {
    setLayoutDialogParam("duplicate");
  }, [setLayoutDialogParam]);

  const sourceOwnerSlug = activeProjectSlug ?? "__all__";
  const sourceProjectName =
    projects.find((p) => p.slug === activeProjectSlug)?.name ?? "All Projects";
  const sourcePageName = activePage?.name ?? "Overview";

  // Resolve widget assignments for the selected layout from the active page
  const sourceAssignments = useMemo<Record<string, string | null>>(() => {
    const pageWidgetLayouts = activePage?.widgetLayouts ?? {};
    return pageWidgetLayouts[selectedLayout.id] ?? {};
  }, [activePage, selectedLayout.id]);

  const { handleBlueprintSelect, handleDuplicateConfirm, handlePresetSelect } =
    useLayoutCreationHandlers({
      addProjectPage,
      layouts,
      pendingBlueprintWidgets,
      pendingSelectionRef,
      projects,
      selectedLayout,
      setEditorNotice,
      setLayoutDialogParam,
      setSelectedId,
      sourceAssignments,
      sourceOwnerSlug,
      sourceProjectName,
      updateLayouts,
      updateProjectLayout,
    });

  const handleUpdateName = useCallback(
    (name: string) => {
      if (isDefault) return;
      updateSelectedLayout((layout) => ({ ...layout, name }));
    },
    [isDefault, updateSelectedLayout]
  );

  const handleUpdateLayout = useCallback(
    (nextLayout: LayoutDefinition, meta?: LayoutUpdateMeta) => {
      updateSelectedLayout(() => nextLayout);
      if ((meta?.removedCellIds?.length ?? 0) > 0 && (usageMap[selectedId] ?? 0) > 0) {
        setEditorNotice(
          `${meta?.removedCellIds?.length} cell${meta?.removedCellIds?.length === 1 ? "" : "s"} removed. Pages using this layout may now have unassigned widgets.`
        );
        return;
      }
      setEditorNotice(null);
    },
    [selectedId, updateSelectedLayout, usageMap]
  );

  const handleResetLayout = useCallback(() => {
    updateSelectedLayout(() => ({
      ...cloneLayoutWithFreshCellIds(BASIC_3X3),
      id: selectedLayout.id,
      name: selectedLayout.name,
    }));
    setEditorNotice(null);
  }, [selectedLayout.id, selectedLayout.name, updateSelectedLayout]);

  const handleBalanceColumns = useCallback(() => {
    updateSelectedLayout((layout) => {
      const { colCount } = getLayoutDimensions(layout);
      return {
        ...layout,
        colSizes: createEqualTrackSizes(colCount),
      };
    });
    setEditorNotice("Column widths balanced.");
  }, [updateSelectedLayout]);

  const handleBalanceRows = useCallback(() => {
    updateSelectedLayout((layout) => {
      const { rowCount, colCount } = getLayoutDimensions(layout);
      const columnRowSizes = createEqualColumnRowSizes(colCount, rowCount);
      return {
        ...layout,
        rowSizes: summarizeColumnRowSizes(columnRowSizes),
        columnRowSizes,
      };
    });
    setEditorNotice("Row heights balanced.");
  }, [updateSelectedLayout]);

  const handleBalanceTracks = useCallback(() => {
    updateSelectedLayout((layout) => {
      const { colCount, rowCount } = getLayoutDimensions(layout);
      const columnRowSizes = createEqualColumnRowSizes(colCount, rowCount);
      return {
        ...layout,
        colSizes: createEqualTrackSizes(colCount),
        rowSizes: summarizeColumnRowSizes(columnRowSizes),
        columnRowSizes,
      };
    });
    setEditorNotice("Track sizes balanced.");
  }, [updateSelectedLayout]);

  const handleDelete = useCallback(() => {
    if (isDefault) return;
    updateLayouts(layouts.filter((layout) => layout.id !== selectedId));
    setSelectedId(BASIC_3X3.id);
    setLayoutDialogParam(null);
    setEditorNotice(null);
  }, [isDefault, layouts, selectedId, setLayoutDialogParam, updateLayouts]);

  const defaultAssignmentTargetKey = activePageSlug
    ? `${activeProjectSlug ?? ALL_PROJECTS_SLUG}:${activePageSlug}`
    : null;

  const handleAssignLayoutToTarget = useCallback(
    (ownerSlug: string, pageSlug: string) => {
      updateProjectPageLayout(ownerSlug, pageSlug, selectedLayout.id);
      const ownerName =
        ownerSlug === ALL_PROJECTS_SLUG
          ? "All Projects"
          : (projects.find((project) => project.slug === ownerSlug)?.name ?? ownerSlug);
      const pageName =
        projectLayouts[ownerSlug]?.pages?.find((page) => page.slug === pageSlug)?.name ?? pageSlug;
      setEditorNotice(`Assigned "${selectedLayout.name}" to ${ownerName} / ${pageName}.`);
    },
    [projectLayouts, projects, selectedLayout.id, selectedLayout.name, updateProjectPageLayout]
  );

  const selectedUsageCount = usageMap[selectedLayout.id] ?? 0;

  return (
    <DemoGuard isDemoMode={isDemoMode}>
      <LayoutsWorkspace
        activeLayoutId={activeLayoutId}
        deleteDialogOpen={deleteDialogOpen}
        duplicateDialogOpen={duplicateDialogOpen}
        editorNotice={editorNotice}
        filteredLayouts={filteredLayouts}
        handleBalanceColumns={handleBalanceColumns}
        handleBalanceRows={handleBalanceRows}
        handleBalanceTracks={handleBalanceTracks}
        handleAssignLayoutToTarget={handleAssignLayoutToTarget}
        handleCreateLayout={handleCreateLayout}
        handleDelete={handleDelete}
        handleDuplicateConfirm={handleDuplicateConfirm}
        handleDuplicateLayout={handleDuplicateLayout}
        handlePresetSelect={handlePresetSelect}
        handleBlueprintSelect={handleBlueprintSelect}
        handleResetLayout={handleResetLayout}
        handleUpdateLayout={handleUpdateLayout}
        handleUpdateName={handleUpdateName}
        isDefault={isDefault}
        layouts={layouts}
        projectLayouts={projectLayouts}
        presetPickerOpen={presetPickerOpen}
        preferences={preferences}
        projects={projects}
        search={search}
        setSearch={setSearch}
        selectedLayout={selectedLayout}
        selectedUsageCount={selectedUsageCount}
        setEditorNotice={setEditorNotice}
        setLayoutDialogParam={setLayoutDialogParam}
        setSelectedId={setSelectedId}
        defaultAssignmentTargetKey={defaultAssignmentTargetKey}
        sourcePageName={sourcePageName}
        sourceProjectName={sourceProjectName}
        usageMap={usageMap}
      />
    </DemoGuard>
  );
}

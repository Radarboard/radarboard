"use client";

import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@radarboard/ui/app-dialog";
// Import from local detail-renderers (not SDK directly) to trigger side-effect registrations.
import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import type {
  DataSource,
  SectionConfig,
  TemplateSelectionConfig,
} from "@radarboard/widget-sdk/types";
import { getByPath } from "@radarboard/widget-sdk/utils/get-by-path";
import { parseSelectionValue } from "@radarboard/widget-sdk/utils/selection";
import { useCallback, useMemo } from "react";
import { DEFAULT_WIDGET_MODAL_SIZE, WidgetModalDialogContent } from "../../widget-modal";
import { useResolvedData, useResolvedSourceData } from "../data-resolver";

interface SelectionTarget {
  sectionType: "list" | "row-list" | "table" | "dense-ranked-table";
  sectionSource: DataSource;
  selection: TemplateSelectionConfig;
}

function collectSelectionTargets(
  sections: SectionConfig[],
  targets = new Map<string, SelectionTarget>()
): Map<string, SelectionTarget> {
  for (const section of sections) {
    switch (section.type) {
      case "list":
      case "row-list":
      case "table":
      case "dense-ranked-table": {
        const selection = section.selection;
        if (!selection) break;
        if (targets.has(selection.selectionId)) {
          throw new Error(`Duplicate template selectionId "${selection.selectionId}"`);
        }
        targets.set(selection.selectionId, {
          sectionType: section.type,
          sectionSource: section.source,
          selection,
        });
        break;
      }
      case "tabs":
        for (const tab of section.tabs) {
          collectSelectionTargets(tab.sections, targets);
        }
        break;
      case "stack":
      case "grid":
        collectSelectionTargets(section.sections, targets);
        break;
      case "split":
        if (section.left) {
          collectSelectionTargets(section.left, targets);
        }
        collectSelectionTargets(section.right, targets);
        break;
      default:
        break;
    }
  }

  return targets;
}

function findSelectedItem(items: unknown, keyField: string, itemKey: string): unknown {
  if (!Array.isArray(items)) return null;

  for (const item of items) {
    const value = getByPath(item, keyField);
    if (value != null && String(value) === itemKey) {
      return item;
    }
  }

  return null;
}

function FallbackDetail({ title, body }: { title: string; body: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="font-mono text-dim text-w-base">{body}</p>
      </DialogBody>
    </>
  );
}

function ResolvedTemplateDetailHost({
  selectionTarget,
  itemKey,
  projectSlug,
  close,
}: {
  selectionTarget: SelectionTarget;
  itemKey: string;
  projectSlug: string | null;
  close: () => void;
}) {
  const lookupSource = selectionTarget.selection.source ?? selectionTarget.sectionSource;
  const items = useResolvedData(lookupSource, { disableItemContext: true });
  const sourceData = useResolvedSourceData(lookupSource.sourceId);
  const item = useMemo(
    () => findSelectedItem(items, selectionTarget.selection.keyField, itemKey),
    [items, selectionTarget.selection.keyField, itemKey]
  );

  const Renderer = DETAIL_RENDERER_REGISTRY.get(selectionTarget.selection.detailRendererId);

  if (!Renderer) {
    return (
      <FallbackDetail
        title={selectionTarget.selection.dialog?.title ?? "Detail unavailable"}
        body={`No template detail renderer is registered for "${selectionTarget.selection.detailRendererId}".`}
      />
    );
  }

  if (!item) {
    return (
      <FallbackDetail
        title={selectionTarget.selection.dialog?.title ?? "Item unavailable"}
        body="The selected item is no longer available in the resolved dataset."
      />
    );
  }

  return <Renderer item={item} sourceData={sourceData} projectSlug={projectSlug} close={close} />;
}

interface TemplateDetailHostProps {
  widgetId?: string | null;
  sections: SectionConfig[];
  selectedDetailId?: string | null;
  onSelectedDetailIdChange?: (id: string | null) => void;
  projectSlug: string | null;
}

export function TemplateDetailHost({
  widgetId,
  sections,
  selectedDetailId,
  onSelectedDetailIdChange,
  projectSlug,
}: TemplateDetailHostProps) {
  const parsedSelection = useMemo(() => parseSelectionValue(selectedDetailId), [selectedDetailId]);
  const selectionTargets = useMemo(() => collectSelectionTargets(sections), [sections]);
  const selectionTarget = parsedSelection
    ? (selectionTargets.get(parsedSelection.selectionId) ?? null)
    : null;

  const close = useCallback(() => {
    onSelectedDetailIdChange?.(null);
  }, [onSelectedDetailIdChange]);

  const resizable = selectionTarget?.selection.dialog?.resizable ?? false;

  if (!parsedSelection || !selectionTarget) {
    return null;
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <WidgetModalDialogContent
        widgetId={widgetId}
        modalId={selectionTarget.selection.selectionId}
        defaultSize={selectionTarget.selection.dialog?.size ?? DEFAULT_WIDGET_MODAL_SIZE}
        resizable={resizable}
      >
        <ResolvedTemplateDetailHost
          selectionTarget={selectionTarget}
          itemKey={parsedSelection.itemKey}
          projectSlug={projectSlug}
          close={close}
        />
      </WidgetModalDialogContent>
    </Dialog>
  );
}

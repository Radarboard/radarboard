"use client";
import { ActivityChartSection } from "../sections/activity-chart-section";
import { AlertSection } from "../sections/alert-section";
import { CardListSection } from "../sections/card-list-section";
import { ChartSection } from "../sections/chart-section";
import { DenseRankedTableSection } from "../sections/dense-ranked-table-section";
import { FilterBarSection } from "../sections/filter-bar-section";
import { GridSection } from "../sections/grid-section";
import { HeadlineStatSection } from "../sections/headline-stat-section";
import { KPIRowSection } from "../sections/kpi-row-section";
import { ListSection } from "../sections/list-section";
import { OverviewPanelSection } from "../sections/overview-panel-section";
import { RowListSection } from "../sections/row-list-section";
import { SplitSection } from "../sections/split-section";
import { StackSection } from "../sections/stack-section";
import { StreamListSection } from "../sections/stream-list-section";
import { SummaryQuadSection } from "../sections/summary-quad-section";
import { TableSection } from "../sections/table-section";
import { TabsSection } from "../sections/tabs-section";
import type { SectionConfig } from "../types";

interface SectionRendererProps {
  sections: SectionConfig[];
  depth?: number;
  onSelectedDetailIdChange?: (id: string | null) => void;
}

export function SectionRenderer({
  sections,
  depth = 0,
  onSelectedDetailIdChange,
}: SectionRendererProps) {
  return (
    <>
      {sections.map((section, index) => {
        const key = `${section.type}:${index}`;

        switch (section.type) {
          case "alert":
            return <AlertSection key={key} config={section} />;
          case "headline-stat":
            return <HeadlineStatSection key={key} config={section} />;
          case "overview-panel":
            return <OverviewPanelSection key={key} config={section} />;
          case "kpi-row":
            return <KPIRowSection key={key} config={section} />;
          case "summary-quad":
            return <SummaryQuadSection key={key} config={section} />;
          case "list":
            return (
              <ListSection
                key={key}
                config={section}
                onSelectedDetailIdChange={onSelectedDetailIdChange}
              />
            );
          case "filter-bar":
            return <FilterBarSection key={key} config={section} />;
          case "row-list":
            return (
              <RowListSection
                key={key}
                config={section}
                onSelectedDetailIdChange={onSelectedDetailIdChange}
              />
            );
          case "stream-list":
            return <StreamListSection key={key} config={section} />;
          case "dense-ranked-table":
            return (
              <DenseRankedTableSection
                key={key}
                config={section}
                onSelectedDetailIdChange={onSelectedDetailIdChange}
              />
            );
          case "table":
            return (
              <TableSection
                key={key}
                config={section}
                onSelectedDetailIdChange={onSelectedDetailIdChange}
              />
            );
          case "card-list":
            return (
              <CardListSection
                key={key}
                config={section}
                onSelectedDetailIdChange={onSelectedDetailIdChange}
              />
            );
          case "chart":
            return <ChartSection key={key} config={section} />;
          case "activity-chart":
            return <ActivityChartSection key={key} config={section} />;
          case "stack":
            return (
              <StackSection key={key} config={section}>
                <SectionRenderer
                  sections={section.sections}
                  depth={depth}
                  onSelectedDetailIdChange={onSelectedDetailIdChange}
                />
              </StackSection>
            );
          case "grid":
            return (
              <GridSection key={key} config={section}>
                <SectionRenderer
                  sections={section.sections}
                  depth={depth}
                  onSelectedDetailIdChange={onSelectedDetailIdChange}
                />
              </GridSection>
            );
          case "split":
            return (
              <SplitSection
                key={key}
                config={section}
                leftContent={
                  <SectionRenderer
                    sections={section.left ?? []}
                    depth={depth}
                    onSelectedDetailIdChange={onSelectedDetailIdChange}
                  />
                }
                rightContent={
                  <SectionRenderer
                    sections={section.right}
                    depth={depth}
                    onSelectedDetailIdChange={onSelectedDetailIdChange}
                  />
                }
              />
            );
          case "tabs":
            return (
              <TabsSection
                key={key}
                config={section}
                depth={depth}
                renderedTabs={Object.fromEntries(
                  section.tabs.map((tab) => [
                    tab.id,
                    <SectionRenderer
                      key={tab.id}
                      sections={tab.sections}
                      depth={depth + 1}
                      onSelectedDetailIdChange={onSelectedDetailIdChange}
                    />,
                  ])
                )}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}

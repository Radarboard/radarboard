import { createPageMetadata } from "@/app/metadata";
import { WidgetCompositionGallery } from "@/components/debug/widget-composition-gallery";

export const metadata = createPageMetadata({
  title: "Widget Composition Gallery",
});

export default function WidgetCompositionPage() {
  return <WidgetCompositionGallery />;
}

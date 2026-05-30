import { createPageMetadata } from "@/app/metadata";
import { KnowledgeHealthDashboard } from "@/components/debug/knowledge-health";

export const metadata = createPageMetadata({
  title: "Knowledge Health",
});

export default function KnowledgeHealthPage() {
  return <KnowledgeHealthDashboard />;
}

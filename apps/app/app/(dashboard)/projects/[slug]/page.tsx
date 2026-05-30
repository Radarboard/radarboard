import { notFound } from "next/navigation";
import { PROJECTS } from "@/config/projects";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = PROJECTS.find((candidate) => candidate.slug === slug);

  if (!project) {
    notFound();
  }

  return null;
}

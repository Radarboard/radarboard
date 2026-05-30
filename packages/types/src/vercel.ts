/**
 * Types for Vercel-specific dashboard widgets.
 *
 * Used by: vercel-deployments, vercel-projects, vercel-build-perf, vercel-domains widgets.
 */

export interface VercelDeploymentItem {
  id: string;
  url: string;
  inspectorUrl: string;
  state: string;
  readyState: string;
  target: string | null;
  created: number;
  buildingAt: number;
  ready: number;
  /** Build duration in milliseconds (ready - buildingAt). 0 if not yet ready. */
  buildDuration: number;
  commitMessage: string | null;
  commitSha: string | null;
  commitAuthor: string | null;
  branch: string | null;
  projectId: string;
  projectName: string;
  projectColor: string;
  creatorUsername: string;
}

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework: string | null;
  latestProductionState: string | null;
  latestProductionUrl: string | null;
  latestProductionReady: number | null;
  primaryDomain: string | null;
  projectColor: string;
}

export interface VercelDomainItem {
  name: string;
  verified: boolean;
  configured: boolean;
  projectId: string;
  projectName: string;
  projectColor: string;
}

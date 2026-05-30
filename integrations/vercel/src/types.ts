/**
 * Vercel — Data types
 *
 * Config and API response types for the Vercel REST API.
 */

export interface VercelConfig {
  token: string;
  teamId?: string;
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: "BUILDING" | "ERROR" | "INITIALIZING" | "QUEUED" | "READY" | "CANCELED";
  readyState: "BUILDING" | "ERROR" | "INITIALIZING" | "QUEUED" | "READY" | "CANCELED";
  created: number;
  buildingAt: number;
  ready: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorLogin?: string;
    githubCommitRef?: string;
    githubDeployment?: string;
    githubOrg?: string;
    githubRepo?: string;
  };
  target: "production" | "staging" | null;
  inspectorUrl: string;
  creator: {
    uid: string;
    username: string;
  };
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  latestDeployments: VercelDeployment[];
  targets: Record<string, VercelDeployment> | null;
  link?: {
    type: "github" | "gitlab" | "bitbucket";
    org: string;
    repo: string;
  };
}

export interface VercelDomain {
  name: string;
  verified: boolean;
  configured: boolean;
}

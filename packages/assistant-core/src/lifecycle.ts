import type { AssistantRunStatus, RetrievalActionStatus } from "./contracts";

export function isTerminalRunStatus(status: AssistantRunStatus): boolean {
  return status !== "started";
}

export function isTerminalRetrievalStatus(status: RetrievalActionStatus): boolean {
  return status !== "started";
}

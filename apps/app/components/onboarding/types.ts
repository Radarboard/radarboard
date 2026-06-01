import type { UserProfile } from "@radarboard/types/database";

export interface OnboardingState {
  demoMode: boolean;
  profile: UserProfile | null;
  databaseProvider: string;
  credentials: Record<string, string>;
  connectedIntegrations: string[];
  enabledPlugins: string[];
  blueprintId: string | null;
  restoredFromBackup?: boolean;
  keepExisting?: boolean;
}

export interface OnboardingStepProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

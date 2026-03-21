export type PriorityBias = "access" | "momentum" | "signal" | "coherence";
export type ReportingFrequency = "low" | "normal" | "high";

export interface PolicySettings {
  riskTolerance: number;
  spendingLimit: number;
  escalationThreshold: number;
  reportingFrequency: ReportingFrequency;
  priorityBias: PriorityBias;
}

export const DEFAULT_POLICY: PolicySettings = {
  riskTolerance: 0.5,
  spendingLimit: 100,
  escalationThreshold: 3,
  reportingFrequency: "normal",
  priorityBias: "momentum",
};

export function normalizePolicySettings(
  policy: Partial<PolicySettings>,
  current: PolicySettings = DEFAULT_POLICY,
): PolicySettings {
  return {
    riskTolerance: clampNumber(
      policy.riskTolerance ?? current.riskTolerance,
      0,
      1,
    ),
    spendingLimit: Math.max(0, policy.spendingLimit ?? current.spendingLimit),
    escalationThreshold: clampNumber(
      policy.escalationThreshold ?? current.escalationThreshold,
      1,
      6,
    ),
    reportingFrequency: policy.reportingFrequency ?? current.reportingFrequency,
    priorityBias: policy.priorityBias ?? current.priorityBias,
  };
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

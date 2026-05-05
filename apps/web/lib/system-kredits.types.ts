type LooseRecord = Record<string, unknown>;

export type SystemKreditDirectoryRow = LooseRecord & {
  userId: string;
  userName: string;
  email: string;
  sponsorId: string;
  sponsorName: string;
  teamId: string;
  teamName: string;
  workspaceId: string;
  workspaceName: string;
  kreditBalance: string;
};

export type SystemKreditInjectionRequest = {
  targetType: "team" | "sponsor";
  targetId: string;
  amountDecimal: string;
  reason?: string;
  note?: string;
};

export type SystemKreditBalanceSnapshot = LooseRecord & {
  account_id: string;
  unit_code: string;
  unit_scale: number;
  balance: string;
  held_amount: string;
  available_balance: string;
  updated_at: string;
};

export type SystemKreditInjectionResponse = LooseRecord & {
  target: LooseRecord & {
    targetType: "team" | "sponsor";
    targetId: string;
    tenantId: string;
    teamId: string;
    teamName: string;
    sponsorId: string | null;
    sponsorName: string | null;
    workspaceId: string;
    workspaceName: string;
  };
  accountId: string;
  requestedAmount: string;
  referenceId: string;
  balance: SystemKreditBalanceSnapshot;
  ledgerEntry: LooseRecord & {
    id: string;
    account_id: string;
    movement_type: string;
    amount: string;
    balance_after: string;
    unit_code: string;
    unit_scale: number;
    created_at: string;
  };
};

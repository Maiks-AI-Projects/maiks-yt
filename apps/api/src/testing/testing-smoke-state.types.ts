export type TestingSmokeStateActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type TestingSmokeStateStatus = "passing" | "failing" | "unknown";

export type TestingSmokeStateSnapshot = {
  status: TestingSmokeStateStatus;
  stateAvailable: boolean;
  hadActiveFailure: boolean | null;
  lastSuccessAt: string | null;
  lastFailureNotifiedAt: string | null;
  lastFailureSignaturePresent: boolean;
};

export type TestingSmokeStateResult =
  | {
    ok: true;
    readOnly: true;
    checkedAt: string;
    stateFileConfigured: boolean;
    state: TestingSmokeStateSnapshot;
  }
  | {
    ok: false;
    reason: "testing_smoke_state_user_unlinked" | "testing_smoke_state_forbidden";
  };

export interface TestingSmokeStateRepository {
  resolveActor(authUserId: string): Promise<TestingSmokeStateActor | null>;
}

import type { CreateSystemIndividualAccountFormValues } from "@/lib/system-tenant-form.schema";
import type { CreateSystemIndividualAccountResponse } from "@/lib/system-tenants.types";

type OperationRequest = <T>(path: string, init: RequestInit) => Promise<T>;

export const createSystemIndividualAccount = (
  payload: CreateSystemIndividualAccountFormValues,
  operationRequest: OperationRequest,
) =>
  operationRequest<CreateSystemIndividualAccountResponse>(
    "/system/tenants/individual",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

const RESOURCE_STATUS_KEYS: Record<string, string> = {
  ACTIVE: "resourceStatusActive",
  INACTIVE: "resourceStatusInactive",
  ASSIGNED: "resourceStatusAssigned",
  UNASSIGNED: "resourceStatusUnassigned",
  AVAILABLE: "resourceStatusAvailable",
  PENDING: "resourceStatusPending",
  SUSPENDED: "resourceStatusSuspended",
  CANCELLED: "resourceStatusCancelled",
  CANCELED: "resourceStatusCancelled",
  REDEEMED: "resourceStatusRedeemed",
  PAID: "invoiceStatusPaid",
  OVERDUE: "invoiceStatusOverdue",
};

/** Maps API resource status codes to localized labels; falls back to the raw code. */
export function formatResourceStatus(status: string, t: (key: never) => string): string {
  const translate = t as (key: string) => string;
  const key = RESOURCE_STATUS_KEYS[status.toUpperCase()];
  if (!key) return status;
  const translated = translate(key);
  return translated !== key ? translated : status;
}

/**
 * Domain registration / registry status → i18n keys.
 * Keep in sync with lib/services/domains/domain-status-label.ts (web).
 */

const DOMAIN_STATUS_I18N_KEYS: Record<string, string> = {
  ACTIVE: "domainStatusActive",
  REGISTERED: "domainStatusActive",
  OK: "domainStatusActive",
  TRANSFER_PENDING: "domainStatusTransferPending",
  PENDING_TRANSFER: "domainStatusTransferPending",
  PENDINGTRANSFER: "domainStatusTransferPending",
  PENDING: "domainStatusPending",
  EXPIRED: "domainStatusExpired",
  EXPIRING: "domainStatusExpiring",
  REDEMPTION_GRACE: "domainStatusRedemptionGrace",
  REDEMPTION_PERIOD: "domainStatusRedemptionGrace",
  REDEMPTIONPERIOD: "domainStatusRedemptionGrace",
  RESTORED: "domainStatusRestored",
  FAILED: "domainStatusFailed",
  CANCELED: "domainStatusCanceled",
  CANCELLED: "domainStatusCanceled",
  PROVISIONING: "domainStatusProvisioning",
  HOLD: "domainStatusHold",
  LOCK: "domainStatusLock",
  HOLD_LOCK: "domainStatusHoldLock",
  AUTO: "domainStatusAuto",
  LOCK_OWNER: "domainStatusLockOwner",
  LOCK_UPDATE: "domainStatusLockUpdate",
  NONE: "domainStatusNone",
  PENDING_DELETE: "domainStatusPendingDelete",
  PENDINGDELETE: "domainStatusPendingDelete",
  CLIENT_HOLD: "domainStatusClientHold",
  CLIENTHOLD: "domainStatusClientHold",
  SERVER_HOLD: "domainStatusServerHold",
  SERVERHOLD: "domainStatusServerHold",
  CLIENT_TRANSFER_PROHIBITED: "domainStatusTransferLocked",
  CLIENTTRANSFERPROHIBITED: "domainStatusTransferLocked",
  SERVER_TRANSFER_PROHIBITED: "domainStatusTransferLocked",
  SERVERTRANSFERPROHIBITED: "domainStatusTransferLocked",
  ADD_PERIOD: "domainStatusAddPeriod",
  ADDPERIOD: "domainStatusAddPeriod",
  AUTO_RENEW_PERIOD: "domainStatusAutoRenewPeriod",
  AUTORENEWPERIOD: "domainStatusAutoRenewPeriod",
  INACTIVE: "domainStatusInactive",
  SUSPENDED: "domainStatusSuspended",
};

export function normalizeDomainStatus(status: string | null | undefined): string {
  return String(status || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toUpperCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function formatDomainStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
): string {
  const raw = String(status || "").trim();
  if (!raw) return "—";

  const i18nKey = DOMAIN_STATUS_I18N_KEYS[normalizeDomainStatus(raw)];
  if (i18nKey) {
    const translated = t(i18nKey);
    if (translated && translated !== i18nKey) return translated;
  }

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isDomainStatusTransferPending(status: string | null | undefined): boolean {
  const key = normalizeDomainStatus(status);
  return (
    key === "TRANSFER_PENDING" ||
    key === "PENDING_TRANSFER" ||
    key === "PENDINGTRANSFER" ||
    key === "PENDING"
  );
}

export function isDomainStatusActive(status: string | null | undefined): boolean {
  const key = normalizeDomainStatus(status);
  return key === "ACTIVE" || key === "REGISTERED" || key === "OK";
}

const PENDING_TRANSFER_KEYS = new Set([
  "PENDING_TRANSFER",
  "PENDINGTRANSFER",
  "TRANSFER_PENDING",
  "PENDING",
]);

const UNHEALTHY_LIVE_KEYS = new Set([
  ...PENDING_TRANSFER_KEYS,
  "EXPIRED",
  "EXPIRING",
  "CLIENT_HOLD",
  "CLIENTHOLD",
  "SERVER_HOLD",
  "SERVERHOLD",
  "HOLD",
  "HOLD_LOCK",
  "PENDING_DELETE",
  "PENDINGDELETE",
  "REDEMPTION_GRACE",
  "REDEMPTION_PERIOD",
  "REDEMPTIONPERIOD",
  "INACTIVE",
  "SUSPENDED",
  "FAILED",
]);

export function liveStatusesIncludePendingTransfer(statuses: string[]): boolean {
  return statuses.some((s) => PENDING_TRANSFER_KEYS.has(normalizeDomainStatus(s)));
}

export function isLiveRegistryStatusHealthy(statuses: string[]): boolean {
  if (!statuses.length) return false;
  return !statuses.some((s) => UNHEALTHY_LIVE_KEYS.has(normalizeDomainStatus(s)));
}

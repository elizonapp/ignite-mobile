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
  INACTIVE: "domainStatusInactive",
  SUSPENDED: "domainStatusSuspended",
};

export function normalizeDomainStatus(status: string | null | undefined): string {
  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
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

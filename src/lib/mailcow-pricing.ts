export type MailcowLimits = {
  maxDomains: number;
  maxMailboxesPerDomain: number;
  storagePerMailboxGb: number;
  maxAliasesPerDomain: number;
};

export type MailcowPricing = {
  maxDomains?: { upgradePrice?: number };
  maxMailboxesPerDomain?: { upgradePrice?: number };
  storagePerMailboxGb?: { upgradePrice?: number };
  maxAliasesPerDomain?: { upgradePrice?: number };
};

export function calculateMailcowSurcharge(
  base: MailcowLimits,
  configured: MailcowLimits,
  pricing: MailcowPricing,
): number {
  const domains = Math.max(0, configured.maxDomains - base.maxDomains);
  const baseMailboxTotal = base.maxDomains * base.maxMailboxesPerDomain;
  const configuredMailboxTotal = configured.maxDomains * configured.maxMailboxesPerDomain;
  const mailboxesTotal = Math.max(0, configuredMailboxTotal - baseMailboxTotal);
  const baseStorageTotal = baseMailboxTotal * base.storagePerMailboxGb;
  const configuredStorageTotal = configuredMailboxTotal * configured.storagePerMailboxGb;
  const storageTotalGb = Math.max(0, configuredStorageTotal - baseStorageTotal);
  const baseAliasesTotal = base.maxDomains * base.maxAliasesPerDomain;
  const configuredAliasesTotal = configured.maxDomains * configured.maxAliasesPerDomain;
  const aliasesTotal = Math.max(0, configuredAliasesTotal - baseAliasesTotal);

  return (
    domains * (pricing.maxDomains?.upgradePrice ?? 0) +
    mailboxesTotal * (pricing.maxMailboxesPerDomain?.upgradePrice ?? 0) +
    storageTotalGb * (pricing.storagePerMailboxGb?.upgradePrice ?? 0) +
    aliasesTotal * (pricing.maxAliasesPerDomain?.upgradePrice ?? 0)
  );
}

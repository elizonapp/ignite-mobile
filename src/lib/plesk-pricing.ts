export type PleskLimits = {
  maxDomains: number;
  storagePerDomainGb: number;
  maxMailboxesPerDomain: number;
  storagePerMailboxGb: number;
  dnsManagement: number;
};

export type PleskPricing = {
  maxDomains?: { upgradePrice?: number };
  storagePerDomainGb?: { upgradePrice?: number };
  maxMailboxesPerDomain?: { upgradePrice?: number };
  storagePerMailboxGb?: { upgradePrice?: number };
  dnsManagement?: { upgradePrice?: number };
};

function activeOrZero(value: number): number {
  return value >= 0 ? value : 0;
}

export function calculatePleskSurcharge(
  base: PleskLimits,
  configured: PleskLimits,
  pricing: PleskPricing,
): number {
  const baseDomains = Math.max(0, base.maxDomains);
  const configuredDomains = Math.max(0, configured.maxDomains);
  const baseStoragePerDomain = Math.max(0, base.storagePerDomainGb);
  const configuredStoragePerDomain = Math.max(0, configured.storagePerDomainGb);
  const baseMailboxesPerDomain = activeOrZero(base.maxMailboxesPerDomain);
  const configuredMailboxesPerDomain = activeOrZero(configured.maxMailboxesPerDomain);
  const baseStoragePerMailbox = activeOrZero(base.storagePerMailboxGb);
  const configuredStoragePerMailbox = activeOrZero(configured.storagePerMailboxGb);

  const baseMailboxTotal = baseDomains * baseMailboxesPerDomain;
  const configuredMailboxTotal = configuredDomains * configuredMailboxesPerDomain;
  const baseStorageWeb = baseDomains * baseStoragePerDomain;
  const configuredStorageWeb = configuredDomains * configuredStoragePerDomain;
  const baseStorageMail = baseMailboxTotal * baseStoragePerMailbox;
  const configuredStorageMail = configuredMailboxTotal * configuredStoragePerMailbox;
  const baseDns = base.dnsManagement >= 1 ? 1 : 0;
  const configuredDns = configured.dnsManagement >= 1 ? 1 : 0;

  return (
    Math.max(0, configuredDomains - baseDomains) * (pricing.maxDomains?.upgradePrice ?? 0) +
    Math.max(0, configuredStorageWeb - baseStorageWeb) * (pricing.storagePerDomainGb?.upgradePrice ?? 0) +
    Math.max(0, configuredMailboxTotal - baseMailboxTotal) *
      (pricing.maxMailboxesPerDomain?.upgradePrice ?? 0) +
    Math.max(0, configuredStorageMail - baseStorageMail) *
      (pricing.storagePerMailboxGb?.upgradePrice ?? 0) +
    Math.max(0, configuredDns - baseDns) * (pricing.dnsManagement?.upgradePrice ?? 0)
  );
}

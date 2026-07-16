export const RECORD_TYPES = ["A", "AAAA", "CNAME", "SRV"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type SubdomainServiceItem = {
  id: string;
  name: string;
  status?: string;
  providerType?: string | null;
  dnsRecordSupport?: {
    A?: boolean;
    AAAA?: boolean;
    CNAME?: boolean;
    SRV?: boolean;
  };
  hostname?: string;
  ipv4?: string;
  ipv6?: string;
};

export type SubdomainRecordItem = {
  id: string;
  domainId: string;
  domain: string;
  subdomain: string;
  fqdn: string;
  type: string;
  serviceId: string;
};

export const SRV_PRESETS = [
  {
    id: "minecraft",
    labelKey: "subdomainSrvPresetMinecraft" as const,
    port: 25565,
    service: "minecraft",
    protocol: "tcp" as const,
  },
  {
    id: "ts3",
    labelKey: "subdomainSrvPresetTs3" as const,
    port: 9987,
    service: "ts3",
    protocol: "udp" as const,
  },
];

export function isPterodactyl(service: SubdomainServiceItem | undefined): boolean {
  return service?.providerType?.toUpperCase() === "PTERODACTYL";
}

export function serviceSupportsType(service: SubdomainServiceItem, type: RecordType): boolean {
  const support = service.dnsRecordSupport;
  if (support && typeof support[type] === "boolean") {
    return support[type] === true;
  }
  if (type === "AAAA") return Boolean(service.ipv6);
  if (type === "SRV") return !service.ipv4;
  return true;
}

export function canSelectRecordType(
  type: RecordType,
  service: SubdomainServiceItem | undefined,
  serviceId: string,
  domainId: string,
  records: SubdomainRecordItem[],
): boolean {
  if (!serviceId || !service) return false;
  if (isPterodactyl(service)) return type === "SRV";
  if (type === "A") return serviceSupportsType(service, "A");
  if (type === "AAAA") return serviceSupportsType(service, "AAAA");
  if (type === "CNAME") {
    return serviceSupportsType(service, "CNAME") && records.length > 0;
  }
  if (type === "SRV") {
    if (!serviceSupportsType(service, "SRV")) return false;
    return records.some(
      (r) =>
        (r.type === "CNAME" || r.type === "A" || r.type === "AAAA") &&
        r.serviceId === serviceId &&
        r.domainId === domainId,
    );
  }
  return false;
}

export function parseServicesFromListResponse(data: unknown): SubdomainServiceItem[] {
  if (!Array.isArray(data)) return [];
  return data as SubdomainServiceItem[];
}

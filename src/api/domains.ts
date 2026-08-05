import { ResourceClient } from "./resource-client";

export type DomainContactRole = "owner" | "admin" | "tech" | "zone";

export type DomainStoredContact = {
  handleId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string | null;
  street: string;
  zip: string;
  city: string;
  countryCode: string;
  phone: string;
};

export type DomainRegistrationByService = {
  id: string;
  domain: string;
  status: string;
  registrar?: string;
  autoRenew?: boolean;
  whoisPrivacyEnabled?: boolean;
  nameserverMode?: string;
  nameserversJson?: string | null;
  metadataJson?: string | null;
  expiresAt?: string | null;
  restoreEligibleUntil?: string | null;
  domainOrder?: {
    id?: string;
    provider?: string | null;
    registrantJson?: string | null;
  };
};

export type LiveRegistryStatus = {
  source: "whois" | "domain-robot" | "whois+domain-robot" | "none";
  fetchedAt: string;
  statuses: string[];
  transferLock?: boolean | null;
  error?: string | null;
  fromCache?: boolean;
};

export class DomainsResource extends ResourceClient {
  list() {
    return this.get<{ success: boolean; data: Array<{ id: string; domain: string; [key: string]: unknown }> }>("/api/domains");
  }

  add(domain: string) {
    return this.post<{ success: boolean; error?: string }>("/api/domains/add", { domain });
  }

  records(domainId: string) {
    return this.get<{ success: boolean; data: unknown[] }>(`/api/domains/${domainId}/records`);
  }

  createRecord(domainId: string, body: Record<string, unknown>) {
    return this.post<{ success: boolean }>(`/api/domains/${domainId}/records`, body);
  }

  deleteRecord(domainId: string, recordId: string) {
    return this.delete<{ success: boolean }>(`/api/domains/${domainId}/records/${recordId}`);
  }

  registrationByService(serviceId: string) {
    return this.get<{
      success: boolean;
      registration?: DomainRegistrationByService;
      liveRegistryStatus?: LiveRegistryStatus | null;
      error?: string;
    }>(`/api/domains/registrations/by-service/${encodeURIComponent(serviceId)}`);
  }

  registrationAction(
    registrationId: string,
    body: {
      action: "set_contact" | "set_nameservers" | "set_whois_privacy" | "set_auto_renew";
      role?: DomainContactRole;
      contact?: Partial<DomainStoredContact>;
      nameservers?: string[];
      whoisPrivacyEnabled?: boolean;
      autoRenew?: boolean;
    },
  ) {
    return this.post<{
      success: boolean;
      error?: string;
      role?: DomainContactRole;
      contact?: DomainStoredContact;
      message?: string | null;
    }>(`/api/domains/registrations/${encodeURIComponent(registrationId)}/actions`, body);
  }
}

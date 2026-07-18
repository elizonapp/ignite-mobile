export type ServerStatus = "online" | "offline" | "starting" | "stopping";

export type DashboardServer = {
  id: string;
  name: string;
  userDisplayName?: string | null;
  status: ServerStatus;
  ip: string;
  location: string;
  os: string;
  cpu: { used: number; total: number };
  ram: { used: number; total: number };
  disk: { used: number; total: number };
  bandwidth: { used: number; total: number };
  uptime: string;
  uptimeSeconds?: number;
  suspendedAt?: string | null;
  providerType?: string | null;
  isShared?: boolean;
  sharedByName?: string | null;
  elizonThrottleActive?: boolean;
  elizonThrottledUntil?: string | null;
  elizonPoolKey?: string | null;
  elizonForecastTb?: number | null;
  suspendReason?: string | null;
  terminationPending?: boolean;
  reinstallPending?: boolean;
  providerAddress?: string | null;
  ploiStats?: {
    domain: string;
    storageUsedBytes: number;
    storageLimitBytes: number;
    storageStatus: string;
    storageStale?: boolean;
    dnsStatus: string;
    locationLabel?: string;
  };
  pleskStats?: {
    usedDomains: number;
    maxDomains: number;
    avgStorageUsedGb: number;
    storagePerDomainGb: number;
    usedMailboxes: number;
    maxMailboxesPerDomain: number;
    locationLabel: string;
  };
};

export type DashboardStats = {
  totalServers: number;
  activeServers: number;
  totalBandwidth: number;
  openTickets: number;
};

export type MaintenanceNote = {
  id: string;
  serviceId: string;
  serviceName: string;
  startDate: string | null;
  endDate: string | null;
  title?: string | null;
  description?: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  role: "USER" | "SUPPORT" | "ADMIN";
  accountType?: string | null;
  companyName?: string | null;
  familyRole?: string | null;
  familyGroupId?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  vatNumber?: string | null;
  locale?: string | null;
  emailNotifications?: boolean;
  loginNotificationEmailOptIn?: boolean;
  servicePowerActionEmailOptIn?: boolean;
  notificationSoundEnabled?: boolean;
  newsletterOptIn?: boolean;
  webPushNotifications?: boolean;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  balance?: number | null;
  netPointsBalance?: number | null;
  elizonPlusActive?: boolean;
  elizonPlusPoolingEnabled?: boolean;
  elizonPlusPoolingMode?: "THROTTLE" | null;
  /** false, wenn Kunden-Stealth aktiv ist (keine elizon+-UI) */
  elizonPlusCustomerUiVisible?: boolean;
  elizonPlusSlots?: number;
  elizonPlusExpiresAt?: string | null;
};

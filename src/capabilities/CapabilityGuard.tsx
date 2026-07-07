import type { ReactNode } from "react";
import { Monitor } from "lucide-react";

import { useI18n } from "../i18n";
import { canAccessFloatingIps, canAccessWallet, canManageBilling, canPurchase } from "../lib/platform";

export type Capability = "purchase" | "billing" | "wallet" | "floatingIps";

function capabilityAllowed(capability: Capability): boolean {
  if (capability === "purchase") return canPurchase();
  if (capability === "floatingIps") return canAccessFloatingIps();
  if (capability === "wallet") return canAccessWallet();
  return canManageBilling();
}

function capabilityHintKey(
  capability: Capability,
): "capabilityPurchaseDesktopOnly" | "capabilityBillingDesktopOnly" | "capabilityFloatingIpsUnavailable" {
  if (capability === "purchase") return "capabilityPurchaseDesktopOnly";
  if (capability === "floatingIps") return "capabilityFloatingIpsUnavailable";
  return "capabilityBillingDesktopOnly";
}

export function DesktopOnlyHint({ capability }: { capability: Capability }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-4 px-4">
      <div className="glass flex flex-col items-center gap-3 p-6 text-center">
        <Monitor className="size-10 text-(--text-muted)" />
        <p className="text-sm text-(--text-primary)">{t(capabilityHintKey(capability))}</p>
      </div>
    </div>
  );
}

type CapabilityGuardProps = {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
};

export function CapabilityGuard({ capability, children, fallback }: CapabilityGuardProps) {
  if (capabilityAllowed(capability)) {
    return <>{children}</>;
  }

  return <>{fallback ?? <DesktopOnlyHint capability={capability} />}</>;
}

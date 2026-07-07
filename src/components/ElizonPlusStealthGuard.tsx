import { useEffect } from "react";

import { useAuth } from "./AuthProvider";
import { CustomerFeatureUnavailable } from "./CustomerFeatureUnavailable";
import { useRouter } from "./Router";
import type { Route } from "./Router";
import {
  hideElizonPlusUi,
  isRouteVisibleInStealth,
  PLUS_FEATURE_ROUTES,
  STEALTH_HIDDEN_ROUTES,
} from "../lib/elizon-plus";

type ElizonPlusStealthGuardProps = {
  routeName: Route["name"];
  children: React.ReactNode;
};

/**
 * Blockiert elizon+-Flächen im Kunden-Stealth wie im Web-Dashboard.
 * Stealth-Routen zeigen „Funktion nicht verfügbar“, Plus-Routen leiten um.
 */
export function ElizonPlusStealthGuard({ routeName, children }: ElizonPlusStealthGuardProps) {
  const { user, isLoading } = useAuth();
  const { navigate } = useRouter();

  const isStealthRoute = STEALTH_HIDDEN_ROUTES.has(routeName);
  const isPlusRoute = PLUS_FEATURE_ROUTES.has(routeName);
  const guarded = isStealthRoute || isPlusRoute;

  useEffect(() => {
    if (isLoading || !guarded) return;
    if (!isRouteVisibleInStealth(routeName, user)) {
      if (hideElizonPlusUi(user) && isStealthRoute) return;
      if (isPlusRoute) navigate({ name: "dashboard" });
    }
  }, [guarded, isLoading, isPlusRoute, isStealthRoute, navigate, routeName, user]);

  if (!guarded) return <>{children}</>;
  if (isLoading) return null;

  if (hideElizonPlusUi(user) && isStealthRoute) {
    return <CustomerFeatureUnavailable />;
  }

  if (isPlusRoute && !isRouteVisibleInStealth(routeName, user)) {
    return null;
  }

  return <>{children}</>;
}

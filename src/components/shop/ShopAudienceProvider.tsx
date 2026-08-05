import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "../AuthProvider";
import { isBusinessAccount } from "../../lib/shop-catalog";

export type ShopAudience = "private" | "business";

const STORAGE_KEY = "elizon_audience";

function isAudience(value: unknown): value is ShopAudience {
  return value === "private" || value === "business";
}

/** Returns null when the user has never chosen / been defaulted. */
function readStoredAudience(): ShopAudience | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isAudience(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredAudience(next: ShopAudience) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

function audienceFromAccountType(accountType?: string | null): ShopAudience {
  return isBusinessAccount(accountType) ? "business" : "private";
}

type ShopAudienceContextValue = {
  audience: ShopAudience;
  setAudience: (next: ShopAudience) => void;
  isBusinessAudience: boolean;
};

const ShopAudienceContext = createContext<ShopAudienceContextValue>({
  audience: "private",
  setAudience: () => {},
  isBusinessAudience: false,
});

export function ShopAudienceProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [audience, setAudienceState] = useState<ShopAudience>(() => readStoredAudience() ?? "private");

  const setAudience = useCallback((next: ShopAudience) => {
    setAudienceState(next);
    writeStoredAudience(next);
  }, []);

  // When auth is ready and the user has no stored preference yet, default from
  // accountType (BUSINESS → business, else private) and persist — matching web.
  // Never override an explicit choice already in localStorage.
  useEffect(() => {
    if (isLoading) return;
    if (readStoredAudience() !== null) return;

    const next = audienceFromAccountType(user?.accountType);
    setAudienceState(next);
    writeStoredAudience(next);
  }, [isLoading, user?.accountType]);

  const value = useMemo(
    () => ({
      audience,
      setAudience,
      isBusinessAudience: audience === "business",
    }),
    [audience, setAudience],
  );

  return <ShopAudienceContext.Provider value={value}>{children}</ShopAudienceContext.Provider>;
}

export function useShopAudience() {
  return useContext(ShopAudienceContext);
}

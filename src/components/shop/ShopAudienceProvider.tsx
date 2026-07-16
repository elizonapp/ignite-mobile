import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ShopAudience = "private" | "business";

const STORAGE_KEY = "elizon_audience";

function isAudience(value: unknown): value is ShopAudience {
  return value === "private" || value === "business";
}

function readStoredAudience(): ShopAudience {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isAudience(raw) ? raw : "private";
  } catch {
    return "private";
  }
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
  const [audience, setAudienceState] = useState<ShopAudience>(() => readStoredAudience());

  const setAudience = useCallback((next: ShopAudience) => {
    setAudienceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const stored = readStoredAudience();
    if (stored !== audience) setAudience(stored);
    else {
      try {
        localStorage.setItem(STORAGE_KEY, audience);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconcile once on mount
  }, []);

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

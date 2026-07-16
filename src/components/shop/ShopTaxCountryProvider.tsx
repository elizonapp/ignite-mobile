import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "../../lib/api";
import type { TaxCountry } from "../../lib/tax-pricing";

const STORAGE_KEY = "taxCountryPreview";

function safeUpper2(code: string | null | undefined): string | null {
  const c = (code || "").toUpperCase().trim();
  return c.length === 2 ? c : null;
}

type ShopTaxCountryContextValue = {
  countries: TaxCountry[];
  homeCountry: TaxCountry | null;
  selectedCountry: TaxCountry | null;
  selectedCountryCode: string | null;
  setSelectedCountryCode: (code: string | null) => void;
  loading: boolean;
};

const ShopTaxCountryContext = createContext<ShopTaxCountryContextValue>({
  countries: [],
  homeCountry: null,
  selectedCountry: null,
  selectedCountryCode: null,
  setSelectedCountryCode: () => {},
  loading: true,
});

export function ShopTaxCountryProvider({ children }: { children: ReactNode }) {
  const [countries, setCountries] = useState<TaxCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountryCode, setSelectedCountryCodeState] = useState<string | null>(() => {
    try {
      return safeUpper2(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  });

  const setSelectedCountryCode = (code: string | null) => {
    const next = safeUpper2(code);
    setSelectedCountryCodeState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await api.publicApi.countries();
        if (cancelled || !data?.success) return;
        setCountries((data.countries ?? []) as TaxCountry[]);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const homeCountry = useMemo(
    () => countries.find((country) => country.isDefault) ?? countries[0] ?? null,
    [countries],
  );

  const selectedCountry = useMemo(() => {
    const wanted = safeUpper2(selectedCountryCode);
    const byCode = wanted ? countries.find((c) => c.countryCode.toUpperCase() === wanted) : null;
    return byCode ?? homeCountry;
  }, [countries, homeCountry, selectedCountryCode]);

  const value = useMemo(
    () => ({
      countries,
      homeCountry,
      selectedCountry,
      selectedCountryCode: selectedCountry?.countryCode ?? null,
      setSelectedCountryCode,
      loading,
    }),
    [countries, homeCountry, selectedCountry, loading],
  );

  return <ShopTaxCountryContext.Provider value={value}>{children}</ShopTaxCountryContext.Provider>;
}

export function useShopTaxCountry() {
  return useContext(ShopTaxCountryContext);
}

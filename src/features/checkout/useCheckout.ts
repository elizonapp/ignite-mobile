import { useCallback, useEffect, useMemo, useState } from "react";



import { api, ApiError } from "../../lib/api";

import { resolveApiError } from "../../api/resolve-error";

import { useAuth } from "../../components/AuthProvider";

import { useI18n } from "../../i18n";

import type {

  CheckoutAddress,

  CheckoutBootstrap,

  CheckoutCountry,

  CheckoutCartLine,

  CartCalculateResponse,

  CheckoutPaymentMethod,

} from "../../api/checkout";

import type { CheckoutStep } from "./types";

import { cartService, type CartItem } from "../../lib/cart-service";

import { openMollieRedirect } from "./open-mollie";



export type NewAddressForm = {

  firstName: string;

  lastName: string;

  companyName: string;

  vatId: string;

  street: string;

  zip: string;

  city: string;

  countryCode: string;

  phone: string;

};



const EMPTY_ADDRESS: NewAddressForm = {

  firstName: "",

  lastName: "",

  companyName: "",

  vatId: "",

  street: "",

  zip: "",

  city: "",

  countryCode: "",

  phone: "",

};



type SubmitOutcome =

  | { kind: "redirect" }

  | { kind: "invoice"; invoiceId: string }

  | { kind: "wallet" }

  | { kind: "error"; message: string };



function toCartLine(item: CartItem): CheckoutCartLine {

  return {

    lineId: item.lineId,

    productId: item.productId,

    productName: item.productName,

    quantity: item.quantity,

    billingCycle: item.billingCycle,

    itemType: "new",

  };

}



function buildCalculateItem(item: CartItem): Record<string, unknown> {
  return {
    lineId: item.lineId,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    billingCycle: item.billingCycle,
    itemType: "new",
    ...(item.locationId ? { locationId: item.locationId } : {}),
    ...(item.customization ? { customization: item.customization } : {}),
    ...(item.customizationPrices ? { customizationPrices: item.customizationPrices } : {}),
    ...(item.configuredSpecs ? { configuredSpecs: item.configuredSpecs } : {}),
    ...(item.resourceSpecsUnit ? { resourceSpecsUnit: item.resourceSpecsUnit } : {}),
    ...(item.billingOptions ? { billingOptions: item.billingOptions } : {}),
    ...(item.setupFee != null ? { setupFee: item.setupFee } : {}),
    ...(item.billingMode ? { billingMode: item.billingMode } : {}),
    ...(item.contractTermMonths != null ? { contractTermMonths: item.contractTermMonths } : {}),
  };
}



export function useCheckout() {

  const { t, lang } = useI18n();

  const { user, refresh } = useAuth();



  const [step, setStep] = useState<CheckoutStep>(0);

  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => cartService.getCart().items);

  const [bootstrap, setBootstrap] = useState<CheckoutBootstrap | null>(null);



  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [showNewAddressForm, setShowNewAddressForm] = useState(false);

  const [newAddress, setNewAddress] = useState<NewAddressForm>(EMPTY_ADDRESS);

  const [taxCountryCode, setTaxCountryCode] = useState<string | null>(null);



  const [pricing, setPricing] = useState<CartCalculateResponse | null>(null);

  const [pricingLoading, setPricingLoading] = useState(false);



  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("mollie");

  const [applyNetPoints, setApplyNetPoints] = useState(false);

  const [couponCode, setCouponCode] = useState("");

  const [newsletterOptIn, setNewsletterOptIn] = useState(false);



  const [submitting, setSubmitting] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);



  const isBusiness = user?.accountType === "BUSINESS";



  useEffect(() => cartService.subscribe(() => setCartItems(cartService.getCart().items)), []);



  useEffect(() => {

    let cancelled = false;

    void (async () => {

      setBootstrapLoading(true);

      try {

        const boot = await api.checkout.bootstrap();

        if (cancelled) return;

        if (boot?.success) {

          setBootstrap(boot);

          const defaultAddr = boot.addresses.find((a) => a.isDefault) ?? boot.addresses[0] ?? null;

          if (defaultAddr) {

            setSelectedAddressId(defaultAddr.id);

            setTaxCountryCode(defaultAddr.countryCode);

          } else {

            setShowNewAddressForm(true);

            const defaultCountry = boot.countries.find((c) => c.isDefault) ?? boot.countries[0] ?? null;

            if (defaultCountry) setTaxCountryCode(defaultCountry.countryCode);

          }

        } else {

          setLoadError(t("unknownError"));

        }

      } catch {

        if (!cancelled) setLoadError(t("unknownError"));

      } finally {

        if (!cancelled) setBootstrapLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [t]);



  const cartLines = useMemo(() => cartItems.map(toCartLine), [cartItems]);



  const effectiveCountryCode = useMemo(() => {

    if (selectedAddressId && !showNewAddressForm) {

      const addr = bootstrap?.addresses.find((a) => a.id === selectedAddressId);

      if (addr) return addr.countryCode;

    }

    if (showNewAddressForm && newAddress.countryCode) return newAddress.countryCode;

    return taxCountryCode ?? undefined;

  }, [selectedAddressId, showNewAddressForm, bootstrap, newAddress.countryCode, taxCountryCode]);



  const effectiveVatId = useMemo(() => {

    if (selectedAddressId && !showNewAddressForm) {

      const addr = bootstrap?.addresses.find((a) => a.id === selectedAddressId);

      if (addr?.vatId) return addr.vatId;

    }

    if (showNewAddressForm && newAddress.vatId.trim()) return newAddress.vatId.trim();

    return undefined;

  }, [selectedAddressId, showNewAddressForm, bootstrap, newAddress.vatId]);



  useEffect(() => {

    if (cartItems.length === 0) {

      setPricing(null);

      return;

    }

    let cancelled = false;

    setPricingLoading(true);

    void (async () => {

      try {

        const res = await api.checkout.calculate({

          items: cartItems.map(buildCalculateItem),

          countryCode: effectiveCountryCode,

          hasVatId: !!effectiveVatId,

          ...(effectiveVatId ? { vatNumber: effectiveVatId } : {}),

          lang,

        });

        if (cancelled) return;

        setPricing(res?.success ? res : null);

      } catch {

        if (!cancelled) setPricing(null);

      } finally {

        if (!cancelled) setPricingLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [cartItems, effectiveCountryCode, effectiveVatId, lang]);



  const total = pricing?.total ?? 0;

  const netPointsEurAvailable = bootstrap?.netPointsBalance?.eurValue ?? 0;

  const netPointsApplied = applyNetPoints ? Math.min(netPointsEurAvailable, total) : 0;

  const orderTotal = Math.max(0, Math.round((total - netPointsApplied) * 100) / 100);



  const userBalance = user?.balance ?? 0;

  const guthabenSufficient = userBalance >= orderTotal;



  const availableMethods = useMemo<CheckoutPaymentMethod[]>(() => {

    const methods: CheckoutPaymentMethod[] = [];

    const isMinor = bootstrap?.familyBillingConfig?.userRole === "MINOR";



    if (isMinor && bootstrap?.familyBillingConfig?.groupId) {

      methods.push("family_wallet");

      return methods;

    }



    methods.push("mollie");

    if (bootstrap?.savedPaymentMethods?.hasValid) methods.push("mollie_saved");

    methods.push("sepa");

    methods.push("guthaben");

    if (bootstrap?.businessBillingConfig?.invoiceEnabled) methods.push("invoice");

    if (bootstrap?.businessBillingConfig?.hasActiveFund) methods.push("businessfund");

    if (bootstrap?.familyBillingConfig?.groupId) methods.push("family_wallet");

    return methods;

  }, [bootstrap]);



  useEffect(() => {

    if (step !== 2) return;

    if (orderTotal === 0 && availableMethods.includes("guthaben")) {

      if (paymentMethod !== "guthaben") setPaymentMethod("guthaben");

      return;

    }

    if (!availableMethods.includes(paymentMethod)) {

      setPaymentMethod(availableMethods[0] ?? "mollie");

      return;

    }

    if (paymentMethod === "guthaben" && !guthabenSufficient && orderTotal > 0) {

      setPaymentMethod(availableMethods.includes("mollie") ? "mollie" : availableMethods[0] ?? "mollie");

    }

  }, [step, orderTotal, availableMethods, paymentMethod, guthabenSufficient]);



  const addressReady = useMemo(() => {

    if (selectedAddressId && !showNewAddressForm) return true;

    const a = newAddress;

    const baseFilled =

      a.firstName.trim() &&

      a.lastName.trim() &&

      a.street.trim() &&

      a.zip.trim() &&

      a.city.trim() &&

      a.countryCode.trim();

    if (!baseFilled) return false;

    if (isBusiness && !a.companyName.trim()) return false;

    return true;

  }, [selectedAddressId, showNewAddressForm, newAddress, isBusiness]);



  const [validating, setValidating] = useState(false);



  const validateSelection = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {

    if (cartLines.length === 0) return { ok: false, message: t("checkoutNoProduct") };

    setValidating(true);

    try {

      const res = await api.checkout.validate(

        cartLines.map((line) => ({

          lineId: line.lineId,

          productId: line.productId,

          productName: line.productName,

          itemType: "new",

        })),

      );

      const unavailable = res?.unavailable ?? [];

      if (unavailable.length > 0) {

        return { ok: false, message: t("checkoutProductUnavailable") };

      }

      return { ok: true };

    } catch {

      return { ok: true };

    } finally {

      setValidating(false);

    }

  }, [cartLines, t]);



  const buildBillingPayload = useCallback(() => {

    if (selectedAddressId && !showNewAddressForm) {

      return { billingAddressId: selectedAddressId };

    }

    const countryName =

      bootstrap?.countries.find((c) => c.countryCode === newAddress.countryCode)?.countryName ??

      newAddress.countryCode;

    return {

      billingAddress: {

        firstName: newAddress.firstName.trim(),

        lastName: newAddress.lastName.trim(),

        street: newAddress.street.trim(),

        zip: newAddress.zip.trim(),

        city: newAddress.city.trim(),

        countryCode: newAddress.countryCode.trim(),

        country: countryName,

        ...(newAddress.phone.trim() ? { phone: newAddress.phone.trim() } : {}),

        ...(isBusiness && newAddress.companyName.trim()

          ? { companyName: newAddress.companyName.trim() }

          : {}),

        ...(isBusiness && newAddress.vatId.trim() ? { vatId: newAddress.vatId.trim() } : {}),

        isDefault: (bootstrap?.addresses.length ?? 0) === 0,

      },

    };

  }, [selectedAddressId, showNewAddressForm, newAddress, bootstrap, isBusiness]);



  const submit = useCallback(async (): Promise<SubmitOutcome> => {

    if (cartLines.length === 0) return { kind: "error", message: t("checkoutNoProduct") };

    setSubmitting(true);

    setSubmitError(null);

    try {

      const res = await api.checkout.submit({

        items: cartItems.map(buildCalculateItem),

        paymentMethod,

        ...(paymentMethod === "mollie_saved" && bootstrap?.savedPaymentMethods?.defaultMandateId

          ? { savedMandateId: bootstrap.savedPaymentMethods.defaultMandateId }

          : {}),

        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),

        ...(netPointsApplied > 0 ? { netPointsRedeemEur: netPointsApplied } : {}),

        ...(newsletterOptIn ? { newsletterOptIn: true } : {}),

        lang,

        ...buildBillingPayload(),

      });



      if (!res?.success) {

        const message = resolveApiError(res, t, { fallbackKey: "checkoutError" });

        setSubmitError(message);

        return { kind: "error", message };

      }



      cartService.clearCart();



      if (res.redirectUrl) {

        openMollieRedirect(res.redirectUrl);

        return { kind: "redirect" };

      }



      await refresh();

      if (res.invoiceId) return { kind: "invoice", invoiceId: res.invoiceId };

      return { kind: "wallet" };

    } catch (error) {

      const message =

        error instanceof ApiError

          ? resolveApiError(error.payload, t, { fallbackKey: "checkoutError" })

          : t("checkoutError");

      setSubmitError(message);

      return { kind: "error", message };

    } finally {

      setSubmitting(false);

    }

  }, [

    cartLines,

    paymentMethod,

    bootstrap,

    couponCode,

    netPointsApplied,

    newsletterOptIn,

    lang,

    buildBillingPayload,

    refresh,

    t,

  ]);



  return {

    loading: bootstrapLoading,

    loadError,

    step,

    setStep,

    cartItems,

    cartLines,

    bootstrap,

    isBusiness,

    addresses: (bootstrap?.addresses ?? []) as CheckoutAddress[],

    countries: (bootstrap?.countries ?? []) as CheckoutCountry[],

    selectedAddressId,

    setSelectedAddressId,

    showNewAddressForm,

    setShowNewAddressForm,

    newAddress,

    setNewAddress,

    addressReady,

    pricing,

    pricingLoading,

    total,

    orderTotal,

    availableMethods,

    paymentMethod,

    setPaymentMethod,

    guthabenSufficient,

    userBalance,

    netPointsEurAvailable,

    netPointsApplied,

    applyNetPoints,

    setApplyNetPoints,

    couponCode,

    setCouponCode,

    newsletterOptIn,

    setNewsletterOptIn,

    validateSelection,

    validating,

    submit,

    submitting,

    submitError,

  };

}



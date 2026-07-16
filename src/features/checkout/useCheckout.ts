import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../lib/api";
import { resolveApiError } from "../../api/resolve-error";
import { useAuth } from "../../components/AuthProvider";
import { useI18n } from "../../i18n";
import { useRouter } from "../../components/Router";
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
import { cartItemToApiPayload } from "../../lib/cart-configured";
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
  | { kind: "sepa"; details: NonNullable<import("../../api/checkout").CheckoutSubmitResponse["sepaDetails"]> }
  | { kind: "error"; message: string };

function toCartLine(item: CartItem): CheckoutCartLine {
  const payload = cartItemToApiPayload(item);
  return {
    lineId: item.lineId,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    billingCycle: item.billingCycle,
    itemType: item.itemType ?? "new",
    ...(typeof payload.serviceId === "string" ? { serviceId: payload.serviceId } : {}),
    ...(typeof payload.subscriptionId === "string" ? { subscriptionId: payload.subscriptionId } : {}),
    ...(typeof payload.daysExtension === "number" ? { daysExtension: payload.daysExtension } : {}),
    ...(item.billingMode ? { billingMode: item.billingMode } : {}),
    ...(item.contractTermMonths != null ? { contractTermMonths: item.contractTermMonths } : {}),
    ...(item.customization ? { customization: item.customization } : {}),
    ...(item.locationId ? { locationId: item.locationId } : {}),
  };
}

function buildCalculateItem(item: CartItem): Record<string, unknown> {
  return cartItemToApiPayload(item);
}

export function useCheckout() {
  const { t, lang } = useI18n();
  const { user, refresh } = useAuth();
  const { route } = useRouter();

  const checkoutRoute = route.name === "checkout" ? route : null;
  const initialCoupon = checkoutRoute?.coupon?.trim().toUpperCase() ?? "";
  const initialAffiliate = checkoutRoute?.ref?.trim() ?? "";
  const offerToken = checkoutRoute?.offerToken ?? undefined;

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
  const [netPointsRedeemEur, setNetPointsRedeemEur] = useState("");
  const [netPointsAppliedEur, setNetPointsAppliedEur] = useState(0);
  const [netPointsError, setNetPointsError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState(initialCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    displayText: string;
    amount: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState(initialAffiliate);
  const [affiliateInfo, setAffiliateInfo] = useState<{ code: string; name: string } | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptWithdrawal, setAcceptWithdrawal] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

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
            setShowNewAddressForm(false);
          } else {
            setShowNewAddressForm(true);
            const defaultCountry =
              boot.countries.find((c) => c.isDefault) ?? boot.countries[0] ?? null;
            if (defaultCountry) {
              setTaxCountryCode(defaultCountry.countryCode);
              setNewAddress((prev) => ({ ...prev, countryCode: defaultCountry.countryCode }));
            }
          }
          setLoadError(null);
        } else {
          setLoadError(resolveApiError(boot, t, { fallbackKey: "checkoutError" }));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof ApiError
              ? resolveApiError(error.payload, t, { fallbackKey: "checkoutError" })
              : t("checkoutError"),
          );
        }
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
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
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
  }, [cartItems, effectiveCountryCode, effectiveVatId, appliedCoupon?.code, lang]);

  const total = pricing?.total ?? 0;
  const netPointsEurAvailable = bootstrap?.netPointsBalance?.eurValue ?? 0;
  const orderTotal = Math.max(0, Math.round((total - netPointsAppliedEur) * 100) / 100);
  const userBalance = user?.balance ?? 0;
  const guthabenSufficient = userBalance >= orderTotal;

  const hasDomainCheckout = useMemo(
    () =>
      cartItems.some((item) => {
        const haystack = `${item.categoryName ?? ""} ${item.categoryId} ${item.productSlug}`.toLowerCase();
        return haystack.includes("domain");
      }),
    [cartItems],
  );

  const availableMethods = useMemo<CheckoutPaymentMethod[]>(() => {
    const family = bootstrap?.familyBillingConfig;
    const isMinor = family?.userRole === "MINOR" && !!family?.groupId;
    // Web: Minderjährige sehen nur Family-Wallet, keine Mollie/Guthaben/SEPA.
    if (isMinor) return ["family_wallet"];

    const methods: CheckoutPaymentMethod[] = [];
    // Web zeigt gespeicherte Methode vor Mollie; SEPA/Überweisung ist im Checkout nicht angeboten.
    if (bootstrap?.savedPaymentMethods?.hasValid) methods.push("mollie_saved");
    methods.push("mollie");
    methods.push("guthaben");
    if (
      family?.groupId &&
      family.sharedBalance &&
      !family.adoptionDeadlineEnforced &&
      !family.accountLocked
    ) {
      methods.push("family_wallet");
    }
    if (isBusiness) {
      methods.push("invoice");
      methods.push("businessfund");
    }
    return methods;
  }, [bootstrap, isBusiness]);

  const isPaymentMethodEnabled = useCallback(
    (method: CheckoutPaymentMethod): boolean => {
      const family = bootstrap?.familyBillingConfig;
      if (method === "guthaben") return orderTotal === 0 || guthabenSufficient;
      if (method === "family_wallet") {
        if (!family?.groupId) return false;
        if (family.requirePaymentApproval) return false;
        if (family.userRole === "MINOR") return orderTotal > 0;
        return (family.walletBalance ?? 0) >= orderTotal && orderTotal > 0;
      }
      if (method === "invoice") return bootstrap?.businessBillingConfig?.invoiceEnabled === true;
      if (method === "businessfund") {
        return (
          bootstrap?.businessBillingConfig?.hasActiveFund === true && !hasDomainCheckout
        );
      }
      if (method === "sepa") return false;
      return true;
    },
    [bootstrap, guthabenSufficient, hasDomainCheckout, orderTotal],
  );

  useEffect(() => {
    if (step !== 2) return;
    if (orderTotal === 0 && availableMethods.includes("guthaben")) {
      if (paymentMethod !== "guthaben") setPaymentMethod("guthaben");
      return;
    }
    if (!availableMethods.includes(paymentMethod)) {
      const fallback =
        availableMethods.find((m) => isPaymentMethodEnabled(m)) ?? availableMethods[0] ?? "mollie";
      setPaymentMethod(fallback);
      return;
    }
    if (!isPaymentMethodEnabled(paymentMethod)) {
      const fallback =
        availableMethods.find((m) => isPaymentMethodEnabled(m)) ?? availableMethods[0] ?? "mollie";
      if (fallback !== paymentMethod) setPaymentMethod(fallback);
    }
  }, [step, orderTotal, availableMethods, paymentMethod, isPaymentMethodEnabled]);

  const addressReady = useMemo(() => {
    if (selectedAddressId && !showNewAddressForm) return true;
    if (!showNewAddressForm) return false;
    const required = [
      newAddress.firstName,
      newAddress.lastName,
      newAddress.street,
      newAddress.zip,
      newAddress.city,
      newAddress.countryCode,
    ];
    if (isBusiness) required.push(newAddress.companyName, newAddress.vatId);
    return required.every((v) => v.trim().length > 0);
  }, [selectedAddressId, showNewAddressForm, newAddress, isBusiness]);

  const validateSelection = useCallback(async () => {
    if (cartItems.length === 0) return { ok: false as const, message: t("checkoutNoProduct") };
    setValidating(true);
    try {
      const res = await api.checkout.validate(cartItems.map(buildCalculateItem));
      const unavailable = Array.isArray(res?.unavailable) ? res.unavailable : [];
      if (unavailable.length > 0) {
        return {
          ok: false as const,
          message: t("checkoutItemsUnavailable"),
        };
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: t("checkoutError") };
    } finally {
      setValidating(false);
    }
  }, [cartItems, t]);

  const applyNetPointsAmount = useCallback(() => {
    setNetPointsError(null);
    const raw = Number(String(netPointsRedeemEur).replace(",", "."));
    if (!Number.isFinite(raw) || raw <= 0) {
      setNetPointsError(t("checkoutNetPointsInvalid"));
      return;
    }
    const capped = Math.min(raw, netPointsEurAvailable, total);
    setNetPointsAppliedEur(Math.round(capped * 100) / 100);
  }, [netPointsRedeemEur, netPointsEurAvailable, total, t]);

  const applyCoupon = useCallback(async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await api.post<{
        success: boolean;
        coupon?: { code: string; displayText?: string };
        discount?: { amount: number };
        error?: string;
      }>("/api/coupons/preview", {
        code,
        items: cartItems.map(buildCalculateItem),
        countryCode: effectiveCountryCode,
        lang,
      });
      if (!res?.success || !res.coupon) {
        setAppliedCoupon(null);
        setCouponError(resolveApiError(res, t, { fallbackKey: "couponInvalid" }));
        return;
      }
      setAppliedCoupon({
        code: res.coupon.code,
        displayText: res.coupon.displayText ?? res.coupon.code,
        amount: res.discount?.amount ?? 0,
      });
      setCouponCode(res.coupon.code);
    } catch (error) {
      setAppliedCoupon(null);
      setCouponError(
        error instanceof ApiError
          ? resolveApiError(error.payload, t, { fallbackKey: "couponInvalid" })
          : t("couponInvalid"),
      );
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, cartItems, effectiveCountryCode, lang, t]);

  const applyAffiliate = useCallback(async () => {
    const code = affiliateCode.trim();
    if (!code) return;
    setAffiliateLoading(true);
    setAffiliateError(null);
    try {
      const res = await api.affiliates.validate(code);
      if (!res?.success || !res.affiliate) {
        setAffiliateInfo(null);
        setAffiliateError(t("affiliateCodeInvalid"));
        return;
      }
      setAffiliateInfo({ code: res.affiliate.code, name: res.affiliate.name });
    } catch {
      setAffiliateInfo(null);
      setAffiliateError(t("affiliateCodeInvalid"));
    } finally {
      setAffiliateLoading(false);
    }
  }, [affiliateCode, t]);

  const redeemVoucher = useCallback(async () => {
    const code = voucherCode.trim();
    if (!code) return;
    setVoucherLoading(true);
    setVoucherMessage(null);
    try {
      const res = await api.wallet.redeemVoucher(code);
      if (!res?.success) {
        setVoucherMessage(resolveApiError(res, t, { fallbackKey: "voucherInvalid" }));
        return;
      }
      setVoucherMessage(
        t("voucherRedeemedAmount").replace(
          "{amount}",
          new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
            style: "currency",
            currency: "EUR",
          }).format(res.amount ?? 0),
        ),
      );
      setVoucherCode("");
      await refresh();
    } catch (error) {
      setVoucherMessage(
        error instanceof ApiError
          ? resolveApiError(error.payload, t, { fallbackKey: "voucherInvalid" })
          : t("voucherInvalid"),
      );
    } finally {
      setVoucherLoading(false);
    }
  }, [voucherCode, t, lang, refresh]);

  const buildBillingPayload = useCallback(() => {
    if (selectedAddressId && !showNewAddressForm) {
      return { billingAddressId: selectedAddressId };
    }
    const country =
      bootstrap?.countries.find((c) => c.countryCode === newAddress.countryCode)?.countryName ??
      newAddress.countryCode;
    return {
      billingAddress: {
        firstName: newAddress.firstName.trim(),
        lastName: newAddress.lastName.trim(),
        ...(isBusiness && newAddress.companyName.trim()
          ? { companyName: newAddress.companyName.trim() }
          : {}),
        street: newAddress.street.trim(),
        zip: newAddress.zip.trim(),
        city: newAddress.city.trim(),
        countryCode: newAddress.countryCode,
        country,
        ...(newAddress.phone.trim() ? { phone: newAddress.phone.trim() } : {}),
        ...(isBusiness && newAddress.vatId.trim() ? { vatId: newAddress.vatId.trim() } : {}),
        isDefault: (bootstrap?.addresses.length ?? 0) === 0,
      },
    };
  }, [selectedAddressId, showNewAddressForm, newAddress, bootstrap, isBusiness]);

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    if (cartLines.length === 0) return { kind: "error", message: t("checkoutNoProduct") };
    if (!acceptTos || !acceptWithdrawal) {
      setShowTermsError(true);
      return { kind: "error", message: t("checkoutTermsRequired") };
    }
    setShowTermsError(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.checkout.submit({
        items: cartItems.map(buildCalculateItem),
        paymentMethod,
        ...(paymentMethod === "mollie_saved" && bootstrap?.savedPaymentMethods?.defaultMandateId
          ? { savedMandateId: bootstrap.savedPaymentMethods.defaultMandateId }
          : {}),
        ...(appliedCoupon?.code || couponCode.trim()
          ? { couponCode: (appliedCoupon?.code || couponCode).trim() }
          : {}),
        ...(affiliateInfo?.code || affiliateCode.trim()
          ? { affiliateCode: (affiliateInfo?.code || affiliateCode).trim() }
          : {}),
        ...(netPointsAppliedEur > 0 ? { netPointsRedeemEur: netPointsAppliedEur } : {}),
        ...(newsletterOptIn ? { newsletterOptIn: true } : {}),
        ...(offerToken ? { offerToken } : {}),
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
      if (res.sepaDetails) {
        return { kind: "sepa", details: res.sepaDetails };
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
    cartItems,
    paymentMethod,
    bootstrap,
    appliedCoupon,
    couponCode,
    affiliateInfo,
    affiliateCode,
    netPointsAppliedEur,
    newsletterOptIn,
    offerToken,
    acceptTos,
    acceptWithdrawal,
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
    isPaymentMethodEnabled,
    hasDomainCheckout,
    paymentMethod,
    setPaymentMethod,
    guthabenSufficient,
    userBalance,
    netPointsEurAvailable,
    netPointsAppliedEur,
    netPointsRedeemEur,
    setNetPointsRedeemEur,
    netPointsError,
    applyNetPointsAmount,
    clearNetPoints: () => {
      setNetPointsAppliedEur(0);
      setNetPointsRedeemEur("");
      setNetPointsError(null);
    },
    couponCode,
    setCouponCode,
    appliedCoupon,
    couponLoading,
    couponError,
    applyCoupon,
    clearCoupon: () => {
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError(null);
    },
    affiliateCode,
    setAffiliateCode,
    affiliateInfo,
    affiliateLoading,
    affiliateError,
    applyAffiliate,
    voucherCode,
    setVoucherCode,
    voucherLoading,
    voucherMessage,
    redeemVoucher,
    acceptTos,
    setAcceptTos,
    acceptWithdrawal,
    setAcceptWithdrawal,
    showTermsError,
    newsletterOptIn,
    setNewsletterOptIn,
    validateSelection,
    validating,
    submit,
    submitting,
    submitError,
  };
}

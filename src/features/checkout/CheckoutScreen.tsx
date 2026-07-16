import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Landmark,
  Wallet,
  FileText,
  Building2,
  Users,
  Loader2,
  ShoppingCart,
} from "lucide-react";

import { useI18n } from "../../i18n";
import type { Dict } from "../../i18n/en";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../components/Router";
import { useLegal } from "../../components/legal/LegalProvider";
import type { CheckoutPaymentMethod } from "../../api/checkout";
import { useCheckout, type NewAddressForm } from "./useCheckout";
import type { CartItem } from "../../lib/cart-service";

type I18nKey = keyof Dict;

export function CheckoutScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { navigate } = useRouter();
  const c = useCheckout();
  const [sepaDetails, setSepaDetails] = useState<{
    iban: string;
    bic: string;
    bankName?: string;
    amount: number;
    reference: string;
  } | null>(null);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
        style: "currency",
        currency: "EUR",
      }),
    [lang],
  );
  const formatPrice = (value: number) => fmt.format(value);

  const stepLabels = [t("checkoutStepCart"), t("checkoutStepAddress"), t("checkoutStepPayment")];

  const canProceed =
    c.step === 0 ? c.cartItems.length > 0 : c.step === 1 ? c.addressReady : true;

  const goNext = async () => {
    if (c.step >= 2) return;
    if (c.step === 0) {
      const result = await c.validateSelection();
      if (!result.ok) {
        show(result.message ?? t("checkoutError"), "warning");
        return;
      }
    }
    c.setStep((c.step + 1) as 0 | 1 | 2);
  };
  const goBack = () => {
    if (c.step > 0) c.setStep((c.step - 1) as 0 | 1 | 2);
    else navigate({ name: "cart" });
  };

  const handleSubmit = async () => {
    const result = await c.submit();
    if (result.kind === "redirect") {
      show(t("checkoutRedirectOpened"), "info");
    } else if (result.kind === "sepa") {
      setSepaDetails(result.details);
      show(t("checkoutSepaInstructions"), "info");
    } else if (result.kind === "invoice") {
      show(t("checkoutSuccess"), "success");
      navigate({ name: "invoices" });
    } else if (result.kind === "wallet") {
      show(t("checkoutSuccess"), "success");
      navigate({ name: "dashboard" });
    } else {
      show(result.message, "error");
    }
  };

  if (c.loading) {
    return (
      <div className="mx-auto w-full max-w-5xl page-fullwidth">
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass h-72 animate-pulse lg:col-span-2" />
          <div className="glass h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  if (sepaDetails) {
    return (
      <div className="mx-auto w-full max-w-lg page-fullwidth safe-x py-6">
        <section className="glass space-y-3 p-6">
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("checkoutSepaTitle")}</h1>
          <p className="text-sm text-(--text-secondary)">{t("checkoutSepaInstructions")}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-(--text-muted)">IBAN</dt><dd className="font-mono">{sepaDetails.iban}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-(--text-muted)">BIC</dt><dd className="font-mono">{sepaDetails.bic}</dd></div>
            {sepaDetails.bankName ? (
              <div className="flex justify-between gap-2"><dt className="text-(--text-muted)">{t("checkoutBank")}</dt><dd>{sepaDetails.bankName}</dd></div>
            ) : null}
            <div className="flex justify-between gap-2"><dt className="text-(--text-muted)">{t("checkoutPayAmount")}</dt><dd className="font-semibold">{formatPrice(sepaDetails.amount)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-(--text-muted)">{t("checkoutSepaReference")}</dt><dd className="font-mono text-xs">{sepaDetails.reference}</dd></div>
          </dl>
          <button type="button" className="btn-primary w-full rounded-xl py-3 text-sm" onClick={() => navigate({ name: "dashboard" })}>
            {t("checkoutDone")}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl page-fullwidth">
      <header className="safe-x flex items-center gap-3 pb-4 pt-2">
        <button
          type="button"
          onClick={goBack}
          aria-label={t("back")}
          className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("checkoutTitle")}</h1>
          <p className="text-xs text-(--text-muted)">{t("checkoutSubtitle")}</p>
        </div>
      </header>

      <div className="safe-x">
        <StepIndicator labels={stepLabels} current={c.step} />
      </div>

      {c.loadError && (
        <div className="glass safe-x mt-4 border border-(--error)/30 p-4 text-sm text-(--error)">
          {c.loadError}
        </div>
      )}

      <div className="safe-x mt-4 grid grid-cols-1 gap-4 pb-28 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {c.step === 0 && <CartStep c={c} formatPrice={formatPrice} />}
          {c.step === 1 && <AddressStep c={c} />}
          {c.step === 2 && <PaymentStep c={c} formatPrice={formatPrice} />}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <OrderSummary c={c} formatPrice={formatPrice} />

          <div className="flex flex-col gap-2">
            {c.step < 2 ? (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={!canProceed || c.validating}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {c.validating && <Loader2 className="size-4 animate-spin" />}
                {t("next")}
                {!c.validating && <ArrowRight className="size-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={c.submitting || !c.acceptTos || !c.acceptWithdrawal}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {c.submitting && <Loader2 className="size-4 animate-spin" />}
                {t("checkoutPlaceOrder")}
              </button>
            )}
            <button
              type="button"
              onClick={goBack}
              className="glass glass-hover w-full rounded-xl py-2.5 text-sm text-(--text-secondary)"
            >
              {t("back")}
            </button>
          </div>

          {c.submitError && <p className="text-xs text-(--error)">{c.submitError}</p>}
          {c.showTermsError && (
            <p className="text-xs text-(--error)">{t("checkoutTermsRequired")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {labels.map((label, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-(--elizon-primary) text-white"
                  : done
                    ? "bg-(--elizon-primary)/20 text-(--elizon-primary)"
                    : "bg-(--surface-soft) text-(--text-muted)"
              }`}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={`truncate text-xs ${active ? "font-medium text-(--text-primary)" : "text-(--text-muted)"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type CheckoutCtx = ReturnType<typeof useCheckout>;

function itemConfigLines(item: CartItem, t: (k: I18nKey) => string): string {
  const parts: string[] = [];
  if (item.locationId) parts.push(t("checkoutConfigLocation"));
  if (item.templateId != null) parts.push(t("checkoutConfigOs"));
  if (item.eggId != null) parts.push(t("checkoutConfigEgg"));
  if (item.additionalIPv4) parts.push(`+${item.additionalIPv4} IPv4`);
  if (item.additionalIPv6) parts.push(`+${item.additionalIPv6} IPv6`);
  if (item.customization?.bandwidth) parts.push(`+${item.customization.bandwidth} TB`);
  if (item.customization?.speedGbit) parts.push(`${item.customization.speedGbit} Gbit/s`);
  if (item.billingMode === "CONTRACT" && item.contractTermMonths) {
    parts.push(`${item.contractTermMonths} ${t("months")}`);
  }
  return parts.join(" · ");
}

function CartStep({ c, formatPrice }: { c: CheckoutCtx; formatPrice: (v: number) => string }) {
  const { t } = useI18n();
  const { navigate } = useRouter();
  const pricedItems = c.pricing?.items ?? [];

  if (c.cartItems.length === 0) {
    return (
      <section className="glass space-y-3 p-6 text-center">
        <ShoppingCart className="mx-auto size-8 text-(--text-muted)" />
        <p className="text-sm text-(--text-muted)">{t("navCartEmpty")}</p>
        <button
          type="button"
          onClick={() => navigate({ name: "shop" })}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          {t("tabShop")}
        </button>
      </section>
    );
  }

  return (
    <section className="glass space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutStepCart")}</h2>
        <button
          type="button"
          onClick={() => navigate({ name: "cart" })}
          className="text-xs font-medium text-(--elizon-primary) hover:underline"
        >
          {t("cartEdit")}
        </button>
      </div>
      <div className="space-y-2">
        {c.cartItems.map((item) => {
          const priced =
            pricedItems.find((entry) => (entry as { lineId?: string }).lineId === item.lineId) ??
            pricedItems.find((entry) => entry.productId === item.productId);
          const config = itemConfigLines(item, t);
          return (
            <div
              key={item.lineId}
              className="flex items-start justify-between gap-3 rounded-xl border border-(--border) p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-(--text-primary)">{item.productName}</p>
                <p className="text-xs text-(--text-muted)">
                  {item.quantity} × {item.billingCycle} {t("days")}
                </p>
                {config ? <p className="mt-1 text-[11px] text-(--text-muted)">{config}</p> : null}
              </div>
              <span className="shrink-0 text-sm font-semibold text-(--elizon-primary)">
                {c.pricingLoading ? "…" : formatPrice(priced?.total ?? item.priceMonthly * item.quantity)}
              </span>
            </div>
          );
        })}
      </div>
      <DiscountSidebar c={c} formatPrice={formatPrice} />
    </section>
  );
}

function AddressStep({ c }: { c: CheckoutCtx }) {
  const { t } = useI18n();

  return (
    <section className="glass space-y-4 p-4">
      <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutBillingAddress")}</h2>

      {c.addresses.length > 0 && (
        <div className="space-y-2">
          {c.addresses.map((addr) => {
            const selected = !c.showNewAddressForm && c.selectedAddressId === addr.id;
            return (
              <button
                key={addr.id}
                type="button"
                onClick={() => {
                  c.setShowNewAddressForm(false);
                  c.setSelectedAddressId(addr.id);
                }}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                  selected
                    ? "border-(--elizon-primary) bg-(--elizon-primary)/10"
                    : "border-(--border) hover:border-(--elizon-primary)/50"
                }`}
              >
                <span
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                    selected ? "border-(--elizon-primary)" : "border-(--border)"
                  }`}
                >
                  {selected && <span className="size-2 rounded-full bg-(--elizon-primary)" />}
                </span>
                <span className="min-w-0 text-xs text-(--text-secondary)">
                  <span className="block font-medium text-(--text-primary)">
                    {[addr.companyName, `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim()]
                      .filter(Boolean)
                      .join(" · ") || addr.label || addr.street}
                  </span>
                  {addr.street}, {addr.zip} {addr.city}, {addr.country}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          c.setShowNewAddressForm(true);
          c.setSelectedAddressId(null);
        }}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
          c.showNewAddressForm
            ? "border-(--elizon-primary) bg-(--elizon-primary)/10 font-medium text-(--elizon-primary)"
            : "border-(--border) text-(--text-secondary)"
        }`}
      >
        {t("checkoutNewAddress")}
      </button>

      {c.showNewAddressForm && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              ["firstName", "firstName", true],
              ["lastName", "lastName", true],
              ["companyName", "company", c.isBusiness],
              ["vatId", "vatId", c.isBusiness],
              ["street", "street", true],
              ["zip", "zip", true],
              ["city", "city", true],
              ["phone", "phone", false],
            ] as Array<[keyof NewAddressForm, I18nKey, boolean]>
          ).map(([field, labelKey, required]) => (
            <label key={field} className="block space-y-1 text-xs">
              <span className="text-(--text-secondary)">
                {t(labelKey)}
                {required ? " *" : ""}
              </span>
              <input
                value={c.newAddress[field]}
                onChange={(e) => c.setNewAddress({ ...c.newAddress, [field]: e.target.value })}
                className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
              />
            </label>
          ))}
          <label className="block space-y-1 text-xs sm:col-span-2">
            <span className="text-(--text-secondary)">{t("checkoutCountry")} *</span>
            <select
              value={c.newAddress.countryCode}
              onChange={(e) => c.setNewAddress({ ...c.newAddress, countryCode: e.target.value })}
              className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
            >
              <option value="">{t("checkoutCountrySelect")}</option>
              {c.countries.map((country) => (
                <option key={country.countryCode} value={country.countryCode}>
                  {country.countryName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

const METHOD_META: Record<
  CheckoutPaymentMethod,
  { icon: typeof CreditCard; labelKey: I18nKey; descKey: I18nKey }
> = {
  mollie: { icon: CreditCard, labelKey: "checkoutPayMollie", descKey: "checkoutPayMollieDesc" },
  mollie_saved: {
    icon: CreditCard,
    labelKey: "checkoutPayMollieSaved",
    descKey: "checkoutPayMollieSavedDesc",
  },
  sepa: { icon: Landmark, labelKey: "checkoutPaySepa", descKey: "checkoutPaySepaDesc" },
  guthaben: { icon: Wallet, labelKey: "checkoutPayGuthaben", descKey: "checkoutPayGuthabenDesc" },
  invoice: { icon: FileText, labelKey: "checkoutPayInvoice", descKey: "checkoutPayInvoiceDesc" },
  businessfund: {
    icon: Building2,
    labelKey: "checkoutPayBusinessFund",
    descKey: "checkoutPayBusinessFundDesc",
  },
  family_wallet: {
    icon: Users,
    labelKey: "checkoutPayFamilyWallet",
    descKey: "checkoutPayFamilyWalletDesc",
  },
};

function paymentMethodHint(
  method: CheckoutPaymentMethod,
  c: CheckoutCtx,
  t: (key: I18nKey) => string,
  formatPrice: (v: number) => string,
): string | null {
  const family = c.bootstrap?.familyBillingConfig;
  if (method === "guthaben" && !c.guthabenSufficient && c.orderTotal > 0) {
    return `${t("guthabenInsufficient")} (${formatPrice(c.orderTotal)} ${t("required")})`;
  }
  if (method === "family_wallet" && family) {
    if (family.requirePaymentApproval) return t("familyApprovalRequired");
    if (family.userRole !== "MINOR" && (family.walletBalance ?? 0) < c.orderTotal && c.orderTotal > 0) {
      return `${t("guthabenInsufficient")} (${formatPrice(c.orderTotal)} ${t("required")})`;
    }
  }
  if (method === "invoice" && c.bootstrap?.businessBillingConfig?.invoiceEnabled !== true) {
    return t("checkoutActivateInBusinessCenter");
  }
  if (method === "businessfund") {
    if (c.hasDomainCheckout) return t("checkoutBusinessFundDomainUnavailable");
    if (c.bootstrap?.businessBillingConfig?.hasActiveFund !== true) {
      return t("checkoutActivateInBusinessCenter");
    }
  }
  return null;
}

function PaymentStep({ c, formatPrice }: { c: CheckoutCtx; formatPrice: (v: number) => string }) {
  const { t } = useI18n();
  const { openLegal } = useLegal();
  const isFreeOrder = c.orderTotal <= 0;

  return (
    <div className="space-y-4">
      <DiscountSidebar c={c} formatPrice={formatPrice} />

      <section className="glass space-y-3 p-4">
        <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutStepPayment")}</h2>
        {isFreeOrder ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <p className="text-sm font-semibold text-green-400">{t("checkoutPeriodFree")}</p>
            <p className="mt-0.5 text-xs text-(--text-muted)">{t("checkoutPeriodFreeDesc")}</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-(--text-muted)">{t("checkoutMollieMethodsHint")}</p>
            <div className="space-y-2">
              {c.availableMethods.map((method) => {
                const meta = METHOD_META[method];
                const Icon = meta.icon;
                const selected = c.paymentMethod === method;
                const enabled = c.isPaymentMethodEnabled(method);
                const hint = paymentMethodHint(method, c, t, formatPrice);
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={!enabled}
                    onClick={() => c.setPaymentMethod(method)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left disabled:opacity-40 ${
                      selected
                        ? "border-(--elizon-primary) bg-(--elizon-primary)/10"
                        : "border-(--border) hover:border-(--elizon-primary)/40"
                    }`}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-(--elizon-primary)" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-(--text-primary)">
                        {method === "mollie_saved" && c.bootstrap?.savedPaymentMethods?.defaultLabel
                          ? c.bootstrap.savedPaymentMethods.defaultLabel
                          : t(meta.labelKey)}
                      </span>
                      <span className="text-xs text-(--text-muted)">{t(meta.descKey)}</span>
                      {method === "guthaben" ? (
                        <span className="mt-0.5 block text-xs text-(--text-muted)">
                          {t("balance")}: {formatPrice(c.userBalance)}
                        </span>
                      ) : null}
                      {method === "family_wallet" && c.bootstrap?.familyBillingConfig?.userRole !== "MINOR" ? (
                        <span className="mt-0.5 block text-xs text-(--text-muted)">
                          {t("balance")}: {formatPrice(c.bootstrap?.familyBillingConfig?.walletBalance ?? 0)}
                        </span>
                      ) : null}
                      {hint ? (
                        <span className="mt-1 block text-xs text-amber-500">{hint}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="glass space-y-3 p-4">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.acceptTos}
            onChange={(e) => c.setAcceptTos(e.target.checked)}
            className="mt-1"
          />
          <span className="text-(--text-secondary)">
            {t("acceptTos")}{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLegal("terms");
              }}
              className="text-(--elizon-primary) underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {t("termsOfService")}
            </button>{" "}
            {t("andThe")}{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLegal("privacy");
              }}
              className="text-(--elizon-primary) underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {t("privacyPolicy")}
            </button>
            .
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.acceptWithdrawal}
            onChange={(e) => c.setAcceptWithdrawal(e.target.checked)}
            className="mt-1"
          />
          <span className="text-(--text-secondary)">{t("checkoutAcceptWithdrawal")}</span>
        </label>
        {!c.isBusiness ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={c.newsletterOptIn}
              onChange={(e) => c.setNewsletterOptIn(e.target.checked)}
              className="mt-1"
            />
            <span className="text-(--text-secondary)">{t("checkoutNewsletterOptIn")}</span>
          </label>
        ) : null}
      </section>
    </div>
  );
}

function DiscountSidebar({
  c,
  formatPrice,
}: {
  c: CheckoutCtx;
  formatPrice: (v: number) => string;
}) {
  const { t } = useI18n();

  return (
    <section className="glass space-y-4 p-4">
      <h3 className="text-sm font-semibold text-(--text-primary)">{t("checkoutDiscountsTitle")}</h3>

      {!c.isBusiness && c.netPointsEurAvailable > 0 ? (
        <div>
          <label className="mb-2 block text-xs font-medium text-(--text-muted)">
            {t("checkoutUseNetPoints")} ({formatPrice(c.netPointsEurAvailable)})
          </label>
          {c.netPointsAppliedEur > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-2.5">
              <span className="text-sm font-medium text-green-400">
                {formatPrice(c.netPointsAppliedEur)}
              </span>
              <button
                type="button"
                onClick={c.clearNetPoints}
                className="shrink-0 text-xs text-(--text-secondary) hover:text-red-500"
              >
                {t("remove")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={c.netPointsRedeemEur}
                onChange={(e) => c.setNetPointsRedeemEur(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg-base) px-3 py-2 text-sm focus:border-(--primary) focus:outline-none"
              />
              <button
                type="button"
                onClick={c.applyNetPointsAmount}
                className="shrink-0 rounded-lg bg-(--primary) px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t("apply")}
              </button>
            </div>
          )}
          {c.netPointsError ? <p className="mt-1.5 text-xs text-red-500">{c.netPointsError}</p> : null}
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-xs font-medium text-(--text-muted)">{t("checkoutCoupon")}</label>
        {c.appliedCoupon ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-2.5">
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-green-400">
                {c.appliedCoupon.code}
              </span>
              {c.appliedCoupon.displayText !== c.appliedCoupon.code ? (
                <span className="block truncate text-xs text-green-500/70">
                  {c.appliedCoupon.displayText}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={c.clearCoupon}
              className="shrink-0 text-xs text-(--text-secondary) hover:text-red-500"
            >
              {t("remove")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={c.couponCode}
              onChange={(e) => c.setCouponCode(e.target.value.toUpperCase())}
              placeholder={t("checkoutCouponPlaceholder")}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg-base) px-3 py-2 text-sm uppercase focus:border-(--primary) focus:outline-none"
            />
            <button
              type="button"
              disabled={c.couponLoading || !c.couponCode.trim()}
              onClick={() => void c.applyCoupon()}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-(--primary) px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {c.couponLoading ? <Loader2 className="size-4 animate-spin" /> : t("apply")}
            </button>
          </div>
        )}
        {c.couponError ? <p className="mt-1.5 text-xs text-red-500">{c.couponError}</p> : null}
        <p className="mt-1.5 text-xs text-(--text-muted)">{t("couponOnePerOrderHint")}</p>
        <p className="mt-1 text-xs text-(--text-muted)/90">{t("discountsFirstMonthOnly")}</p>
      </div>

      <div>
        <label className="mb-0.5 block text-xs font-medium text-(--text-muted)">
          {t("checkoutCreatorCode")}
        </label>
        <p className="mb-2 min-h-[1.25rem] text-xs leading-snug text-(--text-muted)/80">
          {t("creatorCodeDesc")}
        </p>
        {c.affiliateInfo ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-(--border) bg-(--bg-base) p-2.5">
            <div className="min-w-0">
              <span className="block truncate font-mono text-sm text-(--text-primary)">
                {c.affiliateInfo.code}
              </span>
              {c.affiliateInfo.name ? (
                <span className="block truncate text-xs text-(--text-muted)">{c.affiliateInfo.name}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={c.clearAffiliate}
              className="shrink-0 text-xs text-(--text-secondary) hover:text-red-500"
            >
              {t("remove")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={c.affiliateCode}
              onChange={(e) => c.setAffiliateCode(e.target.value.toUpperCase())}
              placeholder={t("checkoutCreatorCodePlaceholder")}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg-base) px-3 py-2 text-sm uppercase focus:border-(--primary) focus:outline-none"
            />
            <button
              type="button"
              disabled={c.affiliateLoading || !c.affiliateCode.trim()}
              onClick={() => void c.applyAffiliate()}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-(--primary) px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {c.affiliateLoading ? <Loader2 className="size-4 animate-spin" /> : t("apply")}
            </button>
          </div>
        )}
        {c.affiliateError ? <p className="mt-1.5 text-xs text-red-500">{c.affiliateError}</p> : null}
      </div>

      <div className="space-y-2 rounded-xl border border-(--border) p-3">
        <p className="text-sm font-medium text-(--text-primary)">{t("walletCheckoutRedeem")}</p>
        <div className="flex gap-2">
          <input
            value={c.voucherCode}
            onChange={(e) => c.setVoucherCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX-XXXXXX-XXXXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg-base) px-3 py-2 text-sm uppercase tracking-wider focus:border-(--primary) focus:outline-none"
          />
          <button
            type="button"
            disabled={c.voucherLoading || !c.voucherCode.trim()}
            onClick={() => void c.redeemVoucher()}
            className="btn-primary inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          >
            {c.voucherLoading ? <Loader2 className="size-4 animate-spin" /> : t("walletRedeemSubmit")}
          </button>
        </div>
        {c.voucherMessage ? (
          <p
            className={`text-xs ${
              c.voucherMessageTone === "error" ? "text-red-500" : "text-green-500"
            }`}
          >
            {c.voucherMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function OrderSummary({
  c,
  formatPrice,
}: {
  c: CheckoutCtx;
  formatPrice: (v: number) => string;
}) {
  const { t } = useI18n();

  return (
    <section className="glass space-y-2 p-4">
      <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutSummary")}</h2>
      <SummaryRow
        label={t("checkoutSubtotal")}
        value={c.pricingLoading ? "…" : formatPrice(c.pricing?.subtotal ?? 0)}
      />
      <SummaryRow
        label={c.pricing?.taxName ?? t("checkoutTax")}
        value={c.pricingLoading ? "…" : formatPrice(c.pricing?.tax ?? 0)}
        muted
      />
      {c.appliedCoupon ? (
        <SummaryRow
          label={t("checkoutCoupon")}
          value={`− ${formatPrice(c.appliedCoupon.amount)}`}
          muted
        />
      ) : null}
      {c.netPointsAppliedEur > 0 && (
        <SummaryRow
          label={t("netPoints")}
          value={`− ${formatPrice(c.netPointsAppliedEur)}`}
          muted
        />
      )}
      <div className="flex items-center justify-between border-t border-(--border) pt-2">
        <span className="text-sm font-bold text-(--text-primary)">{t("checkoutTotal")}</span>
        <span className="text-base font-bold text-(--elizon-primary)">
          {c.pricingLoading ? "…" : formatPrice(c.orderTotal)}
        </span>
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-(--text-muted)" : "text-(--text-secondary)"}>{label}</span>
      <span className="text-(--text-primary)">{value}</span>
    </div>
  );
}

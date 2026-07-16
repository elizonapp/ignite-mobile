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

function PaymentStep({ c, formatPrice }: { c: CheckoutCtx; formatPrice: (v: number) => string }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <DiscountSidebar c={c} formatPrice={formatPrice} />

      <section className="glass space-y-3 p-4">
        <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutStepPayment")}</h2>
        <p className="text-[11px] text-(--text-muted)">{t("checkoutMollieMethodsHint")}</p>
        <div className="space-y-2">
          {c.availableMethods.map((method) => {
            const meta = METHOD_META[method];
            const Icon = meta.icon;
            const selected = c.paymentMethod === method;
            const disabled = method === "guthaben" && !c.guthabenSufficient && c.orderTotal > 0;
            return (
              <button
                key={method}
                type="button"
                disabled={disabled}
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
                      {t("checkoutNetPointsAvailable")}: {formatPrice(c.userBalance)}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass space-y-3 p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.acceptTos}
            onChange={(e) => c.setAcceptTos(e.target.checked)}
            className="mt-1"
          />
          <span className="text-(--text-secondary)">{t("checkoutAcceptTos")}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.acceptWithdrawal}
            onChange={(e) => c.setAcceptWithdrawal(e.target.checked)}
            className="mt-1"
          />
          <span className="text-(--text-secondary)">{t("checkoutAcceptWithdrawal")}</span>
        </label>
        {!c.isBusiness ? (
          <label className="flex items-start gap-2 text-sm">
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
    <section className="glass space-y-3 p-4">
      <h3 className="text-sm font-semibold text-(--text-primary)">{t("checkoutDiscountsTitle")}</h3>

      {!c.isBusiness && c.netPointsEurAvailable > 0 ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-(--text-secondary)">
            {t("checkoutUseNetPoints")} ({formatPrice(c.netPointsEurAvailable)})
          </label>
          <div className="flex gap-2">
            <input
              value={c.netPointsRedeemEur}
              onChange={(e) => c.setNetPointsRedeemEur(e.target.value)}
              placeholder="0,00"
              className="min-w-0 flex-1 rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={c.applyNetPointsAmount}
              className="btn-secondary shrink-0 rounded-xl px-3 py-2 text-xs"
            >
              {t("checkoutApply")}
            </button>
            {c.netPointsAppliedEur > 0 ? (
              <button
                type="button"
                onClick={c.clearNetPoints}
                className="shrink-0 text-xs text-(--text-muted) underline"
              >
                {t("checkoutRemove")}
              </button>
            ) : null}
          </div>
          {c.netPointsError ? <p className="text-xs text-(--error)">{c.netPointsError}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-medium text-(--text-secondary)">{t("checkoutCoupon")}</label>
        <div className="flex gap-2">
          <input
            value={c.couponCode}
            onChange={(e) => c.setCouponCode(e.target.value)}
            placeholder={t("checkoutCouponPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm uppercase"
          />
          <button
            type="button"
            disabled={c.couponLoading}
            onClick={() => void c.applyCoupon()}
            className="btn-secondary shrink-0 rounded-xl px-3 py-2 text-xs"
          >
            {c.couponLoading ? <Loader2 className="size-3.5 animate-spin" /> : t("checkoutApply")}
          </button>
        </div>
        {c.appliedCoupon ? (
          <p className="text-xs text-(--success)">
            {c.appliedCoupon.displayText}
            <button type="button" className="ml-2 underline" onClick={c.clearCoupon}>
              {t("checkoutRemove")}
            </button>
          </p>
        ) : null}
        {c.couponError ? <p className="text-xs text-(--error)">{c.couponError}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-(--text-secondary)">{t("checkoutCreatorCode")}</label>
        <div className="flex gap-2">
          <input
            value={c.affiliateCode}
            onChange={(e) => c.setAffiliateCode(e.target.value)}
            placeholder={t("checkoutCreatorCodePlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={c.affiliateLoading}
            onClick={() => void c.applyAffiliate()}
            className="btn-secondary shrink-0 rounded-xl px-3 py-2 text-xs"
          >
            {c.affiliateLoading ? <Loader2 className="size-3.5 animate-spin" /> : t("checkoutApply")}
          </button>
        </div>
        {c.affiliateInfo ? (
          <p className="text-xs text-(--success)">{c.affiliateInfo.name}</p>
        ) : null}
        {c.affiliateError ? <p className="text-xs text-(--error)">{c.affiliateError}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-(--text-secondary)">{t("voucherRedeem")}</label>
        <div className="flex gap-2">
          <input
            value={c.voucherCode}
            onChange={(e) => c.setVoucherCode(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={c.voucherLoading}
            onClick={() => void c.redeemVoucher()}
            className="btn-secondary shrink-0 rounded-xl px-3 py-2 text-xs"
          >
            {c.voucherLoading ? <Loader2 className="size-3.5 animate-spin" /> : t("voucherRedeem")}
          </button>
        </div>
        {c.voucherMessage ? <p className="text-xs text-(--text-secondary)">{c.voucherMessage}</p> : null}
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

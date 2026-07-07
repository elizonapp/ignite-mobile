import { useMemo } from "react";
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
  Cpu,
  MemoryStick,
  HardDrive,
  Loader2,
  ShoppingBag,
} from "lucide-react";

import { useI18n } from "../../i18n";
import type { Dict } from "../../i18n/en";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../components/Router";
import type { CheckoutPaymentMethod } from "../../api/checkout";

type I18nKey = keyof Dict;
import { useCheckout, type NewAddressForm } from "./useCheckout";
import type { BillingCycleDays } from "./types";

type Props = { productId?: string };

export function CheckoutScreen({ productId }: Props) {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { navigate } = useRouter();
  const c = useCheckout(productId);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
        style: "currency",
        currency: "EUR",
      }),
    [lang],
  );
  const formatPrice = (value: number) => fmt.format(value);

  const stepLabels = [t("checkoutStepConfig"), t("checkoutStepAddress"), t("checkoutStepPayment")];

  const canProceed =
    c.step === 0 ? !!c.selectedProduct : c.step === 1 ? c.addressReady : true;

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
    else navigate({ name: "shop" });
  };

  const handleSubmit = async () => {
    const result = await c.submit();
    if (result.kind === "redirect") {
      show(t("checkoutRedirectOpened"), "info");
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

      <StepIndicator labels={stepLabels} current={c.step} />

      {c.loadError && (
        <div className="glass mt-4 border border-(--error)/30 p-4 text-sm text-(--error)">
          {c.loadError}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {c.step === 0 && <ConfigStep c={c} formatPrice={formatPrice} />}
          {c.step === 1 && <AddressStep c={c} />}
          {c.step === 2 && <PaymentStep c={c} formatPrice={formatPrice} />}
        </div>

        <div className="space-y-4">
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
                onClick={handleSubmit}
                disabled={c.submitting}
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

          {c.submitError && (
            <p className="text-xs text-(--error)">{c.submitError}</p>
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

function ConfigStep({ c, formatPrice }: { c: CheckoutCtx; formatPrice: (v: number) => string }) {
  const { t } = useI18n();

  if (!c.selectedProduct) {
    return (
      <section className="glass space-y-3 p-4">
        <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutSelectProduct")}</h2>
        {c.products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ShoppingBag className="size-8 text-(--text-muted)" />
            <p className="text-sm text-(--text-muted)">{t("shopNoProducts")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {c.products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => c.setSelectedProductId(product.id)}
                className="glass glass-hover flex flex-col gap-1 p-3 text-left"
              >
                <span className="text-sm font-semibold text-(--text-primary)">{product.name}</span>
                {product.description && (
                  <span className="line-clamp-2 text-xs text-(--text-muted)">{product.description}</span>
                )}
                {product.priceMonthly != null && (
                  <span className="mt-1 text-sm font-bold text-(--elizon-primary)">
                    {formatPrice(Number(product.priceMonthly))}
                    <span className="text-xs font-normal text-(--text-muted)">{t("shopPerMonth")}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  const product = c.selectedProduct;
  const cycles: BillingCycleDays[] = product.priceYearly != null ? [30, 365] : [30];

  return (
    <section className="glass space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-(--text-primary)">{product.name}</h2>
          {product.description && (
            <p className="mt-0.5 text-xs text-(--text-muted)">{product.description}</p>
          )}
        </div>
        {c.products.length > 1 && (
          <button
            type="button"
            onClick={() => c.setSelectedProductId(null)}
            className="shrink-0 text-xs text-(--elizon-primary) hover:underline"
          >
            {t("checkoutChangeProduct")}
          </button>
        )}
      </div>

      {(product.vcores || product.memory || product.storage) && (
        <div className="flex flex-wrap gap-2">
          {!!product.vcores && (
            <Spec
              icon={<Cpu className="size-3" />}
              label={t("checkoutSpecVcpu").replace("{count}", String(product.vcores))}
            />
          )}
          {!!product.memory && (
            <Spec
              icon={<MemoryStick className="size-3" />}
              label={t("checkoutSpecMemoryGb").replace("{count}", String(product.memory))}
            />
          )}
          {!!product.storage && (
            <Spec
              icon={<HardDrive className="size-3" />}
              label={t("checkoutSpecStorageGb").replace("{count}", String(product.storage))}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-(--text-secondary)">{t("checkoutBillingCycle")}</p>
        <div className="flex flex-wrap gap-2">
          {cycles.map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => c.setBillingCycle(cycle)}
              className={`rounded-xl border px-4 py-2 text-sm ${
                c.billingCycle === cycle
                  ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--text-primary)"
                  : "border-(--border) text-(--text-muted) hover:border-(--elizon-primary)/50"
              }`}
            >
              {cycle === 365 ? t("checkoutCycleYearly") : t("checkoutCycleMonthly")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-(--text-secondary)">{t("checkoutQuantity")}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => c.setQuantity(Math.max(1, c.quantity - 1))}
            className="glass glass-hover size-9 rounded-lg text-lg leading-none text-(--text-primary)"
            aria-label={t("checkoutQuantityDecrease")}
          >
            −
          </button>
          <span className="min-w-8 text-center text-sm font-semibold text-(--text-primary)">
            {c.quantity}
          </span>
          <button
            type="button"
            onClick={() => c.setQuantity(Math.min(20, c.quantity + 1))}
            className="glass glass-hover size-9 rounded-lg text-lg leading-none text-(--text-primary)"
            aria-label={t("checkoutQuantityIncrease")}
          >
            +
          </button>
        </div>
      </div>
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
        className={`w-full rounded-xl border p-3 text-left text-sm ${
          c.showNewAddressForm
            ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--text-primary)"
            : "border-dashed border-(--border) text-(--text-muted) hover:border-(--elizon-primary)/50"
        }`}
      >
        {t("checkoutNewAddress")}
      </button>

      {c.showNewAddressForm && <NewAddressFields c={c} />}
    </section>
  );
}

function NewAddressFields({ c }: { c: CheckoutCtx }) {
  const { t } = useI18n();
  const a = c.newAddress;
  const set = (patch: Partial<NewAddressForm>) => c.setNewAddress({ ...a, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {c.isBusiness && (
        <Field
          className="sm:col-span-2"
          label={t("checkoutCompany")}
          value={a.companyName}
          onChange={(v) => set({ companyName: v })}
          required
        />
      )}
      <Field label={t("checkoutFirstName")} value={a.firstName} onChange={(v) => set({ firstName: v })} required />
      <Field label={t("checkoutLastName")} value={a.lastName} onChange={(v) => set({ lastName: v })} required />
      <Field
        className="sm:col-span-2"
        label={t("checkoutStreet")}
        value={a.street}
        onChange={(v) => set({ street: v })}
        required
      />
      <Field label={t("checkoutZip")} value={a.zip} onChange={(v) => set({ zip: v })} required />
      <Field label={t("checkoutCity")} value={a.city} onChange={(v) => set({ city: v })} required />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-(--text-secondary)">
          {t("checkoutCountry")} <span className="text-(--error)">*</span>
        </label>
        <select
          value={a.countryCode}
          onChange={(e) => set({ countryCode: e.target.value })}
          className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
        >
          <option value="">{t("checkoutCountrySelect")}</option>
          {c.countries.map((country) => (
            <option key={country.countryCode} value={country.countryCode}>
              {country.countryName}
            </option>
          ))}
        </select>
      </div>
      {c.isBusiness && (
        <Field label={t("checkoutVatId")} value={a.vatId} onChange={(v) => set({ vatId: v })} />
      )}
      <Field label={t("checkoutPhone")} value={a.phone} onChange={(v) => set({ phone: v })} />
      <p className="text-xs text-(--text-muted) sm:col-span-2">{t("checkoutRequiredHint")}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-(--text-secondary)">
        {label} {required && <span className="text-(--error)">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
      />
    </div>
  );
}

const METHOD_META: Record<
  CheckoutPaymentMethod,
  { icon: typeof CreditCard; labelKey: I18nKey; descKey: I18nKey }
> = {
  mollie: { icon: CreditCard, labelKey: "checkoutPayMollie", descKey: "checkoutPayMollieDesc" },
  mollie_saved: { icon: CreditCard, labelKey: "checkoutPayMollieSaved", descKey: "checkoutPayMollieSavedDesc" },
  sepa: { icon: Landmark, labelKey: "checkoutPaySepa", descKey: "checkoutPaySepaDesc" },
  guthaben: { icon: Wallet, labelKey: "checkoutPayGuthaben", descKey: "checkoutPayGuthabenDesc" },
  invoice: { icon: FileText, labelKey: "checkoutPayInvoice", descKey: "checkoutPayInvoiceDesc" },
  businessfund: { icon: Building2, labelKey: "checkoutPayBusinessfund", descKey: "checkoutPayBusinessfundDesc" },
  family_wallet: { icon: Users, labelKey: "checkoutPayFamilyWallet", descKey: "checkoutPayFamilyWalletDesc" },
};

function PaymentStep({ c, formatPrice }: { c: CheckoutCtx; formatPrice: (v: number) => string }) {
  const { t } = useI18n();

  return (
    <section className="glass space-y-4 p-4">
      <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutPaymentMethod")}</h2>

      <div className="space-y-2">
        {c.availableMethods.map((method) => {
          const meta = METHOD_META[method];
          const Icon = meta.icon;
          const selected = c.paymentMethod === method;
          const disabled =
            method === "guthaben" && !c.guthabenSufficient && c.orderTotal > 0;
          return (
            <button
              key={method}
              type="button"
              disabled={disabled}
              onClick={() => c.setPaymentMethod(method)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-(--elizon-primary) bg-(--elizon-primary)/10"
                  : "border-(--border) hover:border-(--elizon-primary)/50"
              }`}
            >
              <Icon className="size-5 shrink-0 text-(--text-secondary)" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-(--text-primary)">
                  {t(meta.labelKey)}
                  {method === "mollie_saved" && c.bootstrap?.savedPaymentMethods?.defaultLabel
                    ? ` · ${c.bootstrap.savedPaymentMethods.defaultLabel}`
                    : ""}
                </span>
                <span className="block text-xs text-(--text-muted)">
                  {method === "guthaben"
                    ? `${t("checkoutPayGuthabenDesc")} (${formatPrice(c.userBalance)})`
                    : t(meta.descKey)}
                </span>
              </span>
              {selected && <Check className="size-4 shrink-0 text-(--elizon-primary)" />}
            </button>
          );
        })}
      </div>

      {c.netPointsEurAvailable > 0 && (
        <label className="flex items-center gap-3 rounded-xl border border-(--border) p-3">
          <input
            type="checkbox"
            checked={c.applyNetPoints}
            onChange={(e) => c.setApplyNetPoints(e.target.checked)}
            className="size-4 accent-(--elizon-primary)"
          />
          <span className="min-w-0 flex-1 text-sm text-(--text-primary)">
            {t("checkoutUseNetPoints")}
            <span className="block text-xs text-(--text-muted)">
              {t("checkoutNetPointsAvailable")}: {formatPrice(c.netPointsEurAvailable)}
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-(--text-secondary)">{t("checkoutCoupon")}</label>
        <input
          value={c.couponCode}
          onChange={(e) => c.setCouponCode(e.target.value)}
          placeholder={t("checkoutCouponPlaceholder")}
          className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
        />
      </div>

      {c.bootstrap && !c.isBusiness && (
        <label className="flex items-center gap-3 text-xs text-(--text-muted)">
          <input
            type="checkbox"
            checked={c.newsletterOptIn}
            onChange={(e) => c.setNewsletterOptIn(e.target.checked)}
            className="size-4 accent-(--elizon-primary)"
          />
          {t("checkoutNewsletterOptIn")}
        </label>
      )}
    </section>
  );
}

function OrderSummary({ c, formatPrice }: { c: CheckoutCtx; formatPrice: (v: number) => string }) {
  const { t } = useI18n();

  return (
    <section className="glass space-y-3 p-4">
      <h2 className="text-sm font-semibold text-(--text-primary)">{t("checkoutSummary")}</h2>

      {c.selectedProduct ? (
        <div className="flex items-start justify-between gap-2 text-sm">
          <span className="min-w-0 text-(--text-secondary)">
            {c.selectedProduct.name}
            <span className="block text-xs text-(--text-muted)">
              {c.quantity} ×{" "}
              {c.billingCycle === 365 ? t("checkoutCycleYearly") : t("checkoutCycleMonthly")}
            </span>
          </span>
        </div>
      ) : (
        <p className="text-xs text-(--text-muted)">{t("checkoutNoProduct")}</p>
      )}

      <div className="space-y-1.5 border-t border-(--border) pt-3 text-sm">
        <SummaryRow
          label={t("checkoutSubtotal")}
          value={c.pricingLoading ? "…" : formatPrice(c.pricing?.subtotal ?? 0)}
          muted
        />
        <SummaryRow
          label={c.pricing?.taxName ?? t("checkoutTax")}
          value={c.pricingLoading ? "…" : formatPrice(c.pricing?.tax ?? 0)}
          muted
        />
        {c.netPointsApplied > 0 && (
          <SummaryRow label={t("netPoints")} value={`− ${formatPrice(c.netPointsApplied)}`} muted />
        )}
        <div className="flex items-center justify-between border-t border-(--border) pt-2 text-base font-bold text-(--text-primary)">
          <span>{t("checkoutTotal")}</span>
          <span>{c.pricingLoading ? "…" : formatPrice(c.orderTotal)}</span>
        </div>
      </div>
    </section>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-(--text-muted)" : "text-(--text-secondary)"}>{label}</span>
      <span className="text-(--text-secondary)">{value}</span>
    </div>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-(--surface-soft) px-2 py-0.5 text-[10px] text-(--text-muted)">
      {icon}
      {label}
    </span>
  );
}

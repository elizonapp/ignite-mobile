import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import type { UserAddress } from "../../../api/settings";
import { SettingsSubView } from "../components";

type CountryOption = { countryCode: string; countryName: string; isDefault?: boolean };

const emptyForm = {
  label: "",
  firstName: "",
  lastName: "",
  companyName: "",
  vatId: "",
  street: "",
  zip: "",
  city: "",
  countryCode: "DE",
  country: "Deutschland",
  phone: "",
  isDefault: false,
};

export function AddressesSettingsView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserAddress | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAddress | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [addrRes, countryRes] = await Promise.all([api.settings.addresses(), api.settings.countries()]);
      if (addrRes.success) setAddresses(addrRes.addresses ?? []);
      if (countryRes.success && countryRes.countries) {
        setCountries(countryRes.countries);
        const def = countryRes.countries.find((c) => c.isDefault) ?? countryRes.countries[0];
        if (def && !editing) {
          setForm((f) => ({ ...f, countryCode: def.countryCode, country: def.countryName }));
        }
      }
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, [editing]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    const def = countries.find((c) => c.isDefault) ?? countries[0];
    setForm({
      ...emptyForm,
      countryCode: def?.countryCode ?? "DE",
      country: def?.countryName ?? "Deutschland",
      isDefault: addresses.length === 0,
    });
    setFormOpen(true);
  };

  const openEdit = (address: UserAddress) => {
    setEditing(address);
    setForm({
      label: address.label ?? "",
      firstName: address.firstName ?? "",
      lastName: address.lastName ?? "",
      companyName: address.companyName ?? "",
      vatId: address.vatId ?? "",
      street: address.street,
      zip: address.zip,
      city: address.city,
      countryCode: address.countryCode ?? "DE",
      country: address.country,
      phone: address.phone ?? "",
      isDefault: Boolean(address.isDefault),
    });
    setFormOpen(true);
  };

  const formValid = useMemo(
    () =>
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.street.trim() &&
      form.zip.trim() &&
      form.city.trim() &&
      form.countryCode.trim() &&
      form.country.trim(),
    [form],
  );

  const save = async () => {
    if (!formValid) return;
    setIsSaving(true);
    try {
      const body = {
        id: editing?.id,
        label: form.label.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        companyName: form.companyName.trim() || undefined,
        vatId: form.vatId.trim() || undefined,
        street: form.street.trim(),
        zip: form.zip.trim(),
        city: form.city.trim(),
        countryCode: form.countryCode.trim(),
        country: form.country.trim(),
        phone: form.phone.trim() || undefined,
        isDefault: form.isDefault,
      };
      const res = editing
        ? await api.settings.updateAddress(body)
        : await api.settings.createAddress(body);
      if (res.success) {
        show(t("settingsSaved"), "success");
        setFormOpen(false);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.settings.deleteAddress(deleteTarget.id);
      if (res.success) {
        show(t("settingsSaved"), "success");
        setDeleteTarget(null);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const setDefault = async (address: UserAddress) => {
    try {
      const res = await api.settings.updateAddress({ id: address.id, isDefault: true });
      if (res.success) await load();
      else show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  if (formOpen) {
    return (
      <SettingsSubView title={editing ? t("settingsEditAddress") : t("settingsAddAddress")} onBack={() => setFormOpen(false)}>
        <div className="space-y-3">
          <Field label={t("addressLabel")} value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("addressFirstName")} value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} />
            <Field label={t("addressLastName")} value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} />
          </div>
          <Field label={t("settingsCompanyName")} value={form.companyName} onChange={(v) => setForm((f) => ({ ...f, companyName: v }))} />
          <Field label={t("addressVatId")} value={form.vatId} onChange={(v) => setForm((f) => ({ ...f, vatId: v }))} />
          <Field label={t("addressStreet")} value={form.street} onChange={(v) => setForm((f) => ({ ...f, street: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("addressZip")} value={form.zip} onChange={(v) => setForm((f) => ({ ...f, zip: v }))} />
            <Field label={t("addressCity")} value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("addressCountry")}</Label>
            <select
              value={form.countryCode}
              onChange={(e) => {
                const c = countries.find((x) => x.countryCode === e.target.value);
                setForm((f) => ({
                  ...f,
                  countryCode: e.target.value,
                  country: c?.countryName ?? f.country,
                }));
              }}
              className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm"
            >
              {countries.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.countryName}
                </option>
              ))}
            </select>
          </div>
          <Field label={t("settingsPhone")} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <label className="flex items-center gap-2 text-sm text-(--text-secondary)">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              className="size-4 accent-[var(--elizon-primary)]"
            />
            {t("settingsSetAsDefault")}
          </label>
          <Button onClick={() => void save()} disabled={!formValid || isSaving} className="btn-primary w-full justify-center rounded-xl py-3">
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : t("save")}
          </Button>
        </div>
      </SettingsSubView>
    );
  }

  return (
    <SettingsSubView title={t("settingsAddresses")} onBack={onBack}>
      <p className="text-xs text-(--text-muted)">{t("settingsAddressesDesc")}</p>
      <button
        type="button"
        onClick={openCreate}
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
      >
        <Plus className="size-4" />
        {t("settingsAddAddress")}
      </button>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-(--text-muted)" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("noAddresses")}</div>
      ) : (
        addresses.map((address) => (
          <div key={address.id} className="glass space-y-2 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-(--elizon-primary)" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {address.label && <p className="text-sm font-medium text-(--text-primary)">{address.label}</p>}
                  {address.isDefault && (
                    <span className="rounded-full bg-(--elizon-primary)/15 px-2 py-0.5 text-[10px] font-medium text-(--elizon-primary)">
                      {t("settingsDefaultAddress")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-(--text-secondary)">
                  {[address.firstName, address.lastName].filter(Boolean).join(" ")}
                </p>
                <p className="text-xs text-(--text-muted)">
                  {address.street}, {address.zip} {address.city}, {address.country}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!address.isDefault && (
                  <button type="button" onClick={() => void setDefault(address)} className="rounded-lg p-2 text-(--text-muted) hover:text-(--elizon-primary)" aria-label={t("settingsSetAsDefault")}>
                    <Star className="size-4" />
                  </button>
                )}
                <button type="button" onClick={() => openEdit(address)} className="rounded-lg p-2 text-(--text-muted) hover:text-(--text-primary)" aria-label={t("settingsEditAddress")}>
                  <Pencil className="size-4" />
                </button>
                {!address.isDefault && (
                  <button type="button" onClick={() => setDeleteTarget(address)} className="rounded-lg p-2 text-(--text-muted) hover:text-(--error)" aria-label={t("delete")}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t("delete")}
        description={t("settingsDeleteAddressConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </SettingsSubView>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-(--text-muted)">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl" />
    </div>
  );
}

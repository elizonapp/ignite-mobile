import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { useI18n, type Lang } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { SettingsSubView } from "../components";

export function ProfileSettingsView({ onBack }: { onBack: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { user, refresh } = useAuth();
  const { show } = useToast();

  const isBusiness = (user?.accountType ?? "").toUpperCase() === "BUSINESS";
  const nameChangeLocked = user?.nameChangeAllowed === false;
  const nameChangeLockHint =
    user?.nameChangeBlockedReason === "under_14"
      ? t("settingsNameChangeLockedUnder14")
      : user?.nameChangeBlockedReason === "cooldown"
        ? t("settingsNameChangeLockedCooldown")
        : null;

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [vatNumber, setVatNumber] = useState(user?.vatNumber ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [reverificationOpen, setReverificationOpen] = useState(false);

  const legalNameDirty =
    firstName.trim() !== (user?.firstName ?? "").trim() ||
    lastName.trim() !== (user?.lastName ?? "").trim();

  const save = async (acknowledgeNameChangeReverification = false) => {
    if (nameChangeLocked && legalNameDirty) {
      show(nameChangeLockHint || t("settingsNameChangeLockedCooldown"), "error");
      return;
    }

    if (legalNameDirty && user?.identVerified && !acknowledgeNameChangeReverification) {
      setReverificationOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const data = await api.auth.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim() || undefined,
        phone: phone.trim() || undefined,
        locale: lang,
        ...(acknowledgeNameChangeReverification
          ? { acknowledgeNameChangeReverification: true }
          : {}),
        ...(isBusiness
          ? {
              companyName: companyName.trim() || undefined,
              vatNumber: vatNumber.trim() || undefined,
            }
          : {}),
      });
      if (data.success) {
        await refresh();
        show(t("settingsSaved"), "success");
        onBack();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
      setReverificationOpen(false);
    }
  };

  const dobLabel = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB")
    : t("settingsDateOfBirthMissing");

  return (
    <SettingsSubView title={t("settingsProfile")} onBack={onBack}>
      <div className="glass space-y-2 p-3">
        <p className="text-xs text-(--text-muted)">{user?.email}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-(--text-primary)">
            {isBusiness ? t("accountTypeBusiness") : t("accountTypePrivate")}
          </span>
          {user?.identVerified && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
              {t("identVerifiedBadge")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("settingsFirstName")}</Label>
        <Input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={nameChangeLocked}
          className={`h-10 rounded-xl ${nameChangeLocked ? "opacity-60" : ""}`}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("settingsLastName")}</Label>
        <Input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={nameChangeLocked}
          className={`h-10 rounded-xl ${nameChangeLocked ? "opacity-60" : ""}`}
        />
      </div>
      {nameChangeLockHint && (
        <p className="text-[11px] text-(--text-muted)">{nameChangeLockHint}</p>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("settingsNickname")}</Label>
        <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("settingsPhone")}</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="h-10 rounded-xl" />
      </div>

      {isBusiness && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("settingsCompanyName")}</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("settingsVatNumber")}</Label>
            <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className="h-10 rounded-xl" />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("settingsDateOfBirth")}</Label>
        <Input value={dobLabel} disabled className="h-10 rounded-xl opacity-60" />
        <p className="text-[11px] text-(--text-muted)">{t("settingsDateOfBirthHint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("settingsLanguage")}</Label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary)"
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>

      <Button onClick={() => void save()} disabled={isSaving} className="btn-primary w-full justify-center rounded-xl py-3">
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : t("saveChanges")}
      </Button>

      <ConfirmModal
        open={reverificationOpen}
        title={t("settingsNameChangeReverificationTitle")}
        description={t("settingsNameChangeReverificationMessage")}
        confirmLabel={t("settingsNameChangeReverificationConfirm")}
        cancelLabel={t("settingsNameChangeReverificationCancel")}
        destructive
        isLoading={isSaving}
        onCancel={() => setReverificationOpen(false)}
        onConfirm={() => void save(true)}
      />
    </SettingsSubView>
  );
}

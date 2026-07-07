import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, User, UserPlus, Users } from "lucide-react";

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { formatResourceStatus } from "../i18n/format-status";
import { api } from '../lib/api';
import { formatUserLegalName } from "@/lib/userName";

type FamilyGroup = {
  id: string;
  name: string;
  ownerId: string;
  sharedBalance: boolean;
  familyWalletBalance: number;
  maxMembers: number;
  status: string;
  requirePaymentApproval: boolean;
  parentalConsentGiven: boolean;
  parentalConsentAt?: string | null;
  childPurchaseBudget?: number | null;
  createdAt: string;
  members: Array<{ id: string; displayName: string | null; email: string; familyRole: string | null; balance: number; lastLoginAt?: string | null }>;
  invites: Array<{ id: string; email: string | null; role: string; status: string; expiresAt: string }>;
};

export function FamilyScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const [group, setGroup] = useState<FamilyGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MINOR");
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [balanceRequests, setBalanceRequests] = useState<
    Array<{ id: string; amount: number; status: string; reason?: string | null; createdAt: string }>
  >([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const fetchGroup = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.family.group();
      if (data.success) {
        const groupData = data.group as FamilyGroup | null;
        setGroup(
          groupData
            ? {
                ...groupData,
                members: groupData.members ?? [],
                invites: groupData.invites ?? [],
              }
            : null,
        );
        if (groupData?.id) {
          const reqRes = await api.family.balanceRequests(groupData.id);
          if (reqRes.success) {
            setBalanceRequests((reqRes.requests ?? []) as typeof balanceRequests);
          }
        } else {
          setBalanceRequests([]);
        }
        setError(null);
      } else {
        setError(t("unknownError"));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchGroup();
  }, [fetchGroup]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    try {
      const data = await api.family.create(newGroupName.trim());
      if (data.success && data.group) {
        const groupData = data.group as FamilyGroup;
        setGroup({
          ...groupData,
          members: groupData.members ?? [],
          invites: groupData.invites ?? [],
        });
        show(t("familyCreated"), "success");
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !group) return;
    setIsInviting(true);
    try {
      const data = await api.family.invite(group.id, inviteEmail.trim(), inviteRole);
      if (data.success) {
        show(t("familyInviteSent"), "success");
        setInviteEmail("");
        await fetchGroup();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!group) return;
    setRemovingId(userId);
    try {
      const data = await api.family.removeMember(group.id, userId);
      if (data.success) {
        show(t("familyMemberRemoved"), "success");
        await fetchGroup();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setRemovingId(null);
    }
  };

  const membersCount = useMemo(() => group?.members?.length ?? 0, [group]);
  const invitesCount = useMemo(() => group?.invites?.length ?? 0, [group]);

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">{t("familyCenter")}</h1>
          <p className="text-sm text-(--text-muted)">{t("familySubtitle")}</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="glass animate-pulse h-32" />
            <div className="glass animate-pulse h-20" />
          </div>
        ) : error ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {error}
            <button type="button" onClick={fetchGroup} className="ml-3 text-xs font-medium text-(--elizon-primary) underline-offset-2 hover:underline">
              {t("retry")}
            </button>
          </div>
        ) : group ? (
          <>
            <section className="glass p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-(--text-muted)">{t("familyGroup")}</p>
                  <h3 className="mt-1 text-lg font-semibold text-(--text-primary)">{group.name}</h3>
                </div>
                <Badge label={group.status ? formatResourceStatus(group.status, t) : t("familyStatusActive")} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCard icon={Users} label={t("familyMembers")} value={`${membersCount}`} />
                <InfoCard icon={UserPlus} label={t("familyInvites")} value={`${invitesCount}`} />
                <InfoCard icon={User} label={t("familyWallet")} value={formatCurrency(group.familyWalletBalance)} />
                <InfoCard icon={RefreshCcw} label={t("familyBillingMode")} value={group.requirePaymentApproval ? t("familyApprovalRequired") : t("familyAutoBilling")} />
              </div>
            </section>

            <section className="glass p-4">
              <h3 className="text-sm font-semibold text-(--text-primary)">{t("familyMembers")}</h3>
              <div className="mt-3 space-y-3">
                {(group.members ?? []).map((member) => (
                  <div key={member.id} className="rounded-xl border border-(--border) p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-(--text-primary)">{formatUserLegalName(member) || member.email}</p>
                        <p className="text-[11px] text-(--text-muted)">{member.familyRole || t("familyMember")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-(--text-muted)">{formatCurrency(member.balance)}</span>
                        {member.id !== group.ownerId && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(member.id)}
                            disabled={removingId === member.id}
                            className="text-xs font-medium text-(--error) hover:underline disabled:opacity-50"
                          >
                            {t("familyRemoveMember")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass p-4">
              <h3 className="text-sm font-semibold text-(--text-primary)">{t("familyBalanceRequests")}</h3>
              {balanceRequests.length === 0 ? (
                <p className="mt-3 text-sm text-(--text-muted)">{t("familyBalanceRequestsEmpty")}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {balanceRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between rounded-xl border border-(--border) p-3 text-sm">
                      <div>
                        <p className="font-medium text-(--text-primary)">{formatCurrency(req.amount)}</p>
                        {req.reason && <p className="text-xs text-(--text-muted)">{req.reason}</p>}
                      </div>
                      <span className="rounded-full bg-(--surface-soft) px-2 py-0.5 text-[10px] font-medium text-(--text-muted)">
                        {formatResourceStatus(req.status, t)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="glass p-4">
              <h3 className="text-sm font-semibold text-(--text-primary)">{t("familyInviteNew")}</h3>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-(--text-muted)">{t("familyInviteEmail")}</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t("familyInviteEmailPlaceholder")}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-(--text-muted)">{t("familyInviteRole")}</Label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
                  >
                    <option value="MINOR">{t("familyRoleMinor")}</option>
                    <option value="PARENT">{t("familyRoleParent")}</option>
                  </select>
                </div>
                <Button onClick={handleInvite} className="btn-primary w-full justify-center rounded-xl py-3" disabled={isInviting || !inviteEmail.trim()}>
                  {isInviting ? t("save") : t("familySendInvite")}
                </Button>
              </div>
            </section>
          </>
        ) : (
          <div className="glass p-4 text-center">
            <p className="text-sm text-(--text-muted)">{t("familyNoGroup")}</p>
            <div className="mt-4 space-y-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t("familyGroupNamePlaceholder")}
                className="h-10 rounded-xl"
              />
              <Button onClick={handleCreateGroup} disabled={isCreating || !newGroupName.trim()} className="btn-primary w-full justify-center rounded-xl py-3">
                {isCreating ? t("save") : t("familyCreateGroup")}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-(--surface-soft) px-3 py-1 text-[11px] font-semibold text-(--text-muted)">{label}</span>;
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--border) p-4">
      <div className="flex items-center gap-2 text-(--text-secondary)">
        <Icon className="size-4" />
        <p className="text-[11px] uppercase tracking-wide text-(--text-muted)">{label}</p>
      </div>
      <p className="mt-3 text-lg font-semibold text-(--text-primary)">{value}</p>
    </div>
  );
}

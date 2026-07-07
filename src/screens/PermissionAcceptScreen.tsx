import { getApiErrorCode } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { useI18n } from '../i18n';
import { useRouter } from '../components/Router';
import { useToast } from '../components/Toast';

interface PermissionAcceptScreenProps {
  permissionId: string;
}

interface PermissionDetails {
  id: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  permissions: string[];
  status: string;
  inviterName: string;
  createdAt: string;
  expiresAt: string | null;
}

export function PermissionAcceptScreen({ permissionId }: PermissionAcceptScreenProps) {
  const { t } = useI18n();
  const { navigate } = useRouter();
  const { show } = useToast();
  const [permission, setPermission] = useState<PermissionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState(false);

  const getPermissionLabel = useCallback(
    (perm: string) => {
      switch (perm) {
        case "view":
          return t("permissionView");
        case "start":
          return t("permissionStart");
        case "stop":
          return t("permissionStop");
        case "restart":
          return t("permissionRestart");
        case "console":
          return t("permissionConsole");
        case "backup":
          return t("permissionBackup");
        case "backup_create":
          return t("permissionBackupCreate");
        case "backup_restore":
          return t("permissionBackupRestore");
        case "backup_delete":
          return t("permissionBackupDelete");
        case "backup_schedule":
          return t("permissionBackupSchedule");
        case "settings":
          return t("permissionSettings");
        case "manage":
          return t("permissionSettings");
        case "manage_permissions":
          return t("permissionManagePermissions");
        default:
          return perm;
      }
    },
    [t],
  );

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ success: boolean; permission: PermissionDetails }>(
          `/api/permissions/${permissionId}/details`,
        );
        const perm = data.permission;

        if (perm.status === "ACCEPTED") {
          setError("already_accepted");
          return;
        }

        if (perm.status !== "PENDING") {
          setError("not_found");
          return;
        }

        if (perm.expiresAt && new Date(perm.expiresAt) < new Date()) {
          setError("expired");
          return;
        }

        setPermission(perm);
      } catch (err) {
        if (err instanceof ApiError && getApiErrorCode(err.payload) === "notFound2") {
          setError("not_found");
        } else {
          setError("unknown");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [permissionId]);

  const getErrorMessage = useCallback(() => {
    if (!error) return t("error");
    switch (error) {
      case "not_found":
        return t("permissionInvitationNotFound");
      case "not_for_you":
        return t("permissionNotForYou");
      case "already_accepted":
        return t("permissionAlreadyAccepted");
      case "expired":
        return t("permissionInvitationExpired");
      default:
        return t("error");
    }
  }, [error, t]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await apiFetch("/api/permissions/accept", {
        method: "POST",
        body: { permissionId },
      });

      setDone(true);
      setTimeout(() => navigate({ name: "servers" }), 1200);
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await apiFetch("/api/permissions/decline", {
        method: "POST",
        body: { permissionId },
      });

      setDone(true);
      setTimeout(() => navigate({ name: "servers" }), 1200);
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass rounded-3xl p-8 max-w-md w-full text-center space-y-4 page-fullwidth">
          <div className="animate-spin h-8 w-8 border-2 border-(--primary) border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-(--text-muted)">{t("permissionProcessing")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 max-w-md w-full text-center space-y-4 page-fullwidth">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-lg font-semibold">{t("permissionInvitation")}</h2>
          <p className="text-sm text-(--text-muted)">{getErrorMessage()}</p>
          <button
            onClick={() => navigate({ name: "servers" })}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm mt-4"
          >
            {t("backToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 max-w-md w-full text-center space-y-4 page-fullwidth">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-sm text-(--text-muted)">{t("permissionAccepted")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-6 max-w-lg w-full space-y-6 page-fullwidth">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">{t("permissionInvitation")}</h1>
          <p className="text-sm text-(--text-muted)">{t("permissionInvitationDesc")}</p>
        </div>

        {permission && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 p-5 space-y-3">
              <div className="flex justify-between text-sm text-(--text-muted)">
                <span>{t("permissionInvitedBy")}</span>
                <span>{permission.inviterName}</span>
              </div>
              <div className="flex justify-between text-sm text-(--text-muted)">
                <span>{t("permissionResource")}</span>
                <span>{permission.resourceName}</span>
              </div>
              <div>
                <p className="text-sm text-(--text-muted) mb-2">{t("permissionGranted")}</p>
                <div className="flex flex-wrap gap-2">
                  {permission.permissions.map((perm) => (
                    <span key={perm} className="rounded-full bg-(--primary)/10 text-(--primary) px-3 py-1 text-xs font-medium">
                      {getPermissionLabel(perm)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleAccept}
                disabled={accepting || declining}
                className="btn-primary w-full rounded-2xl px-5 py-3 text-sm disabled:opacity-50"
              >
                {accepting ? t("accepting") : t("acceptInvitation")}
              </button>
              <button
                onClick={handleDecline}
                disabled={accepting || declining}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                {declining ? t("declining") : t("declineInvitation")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

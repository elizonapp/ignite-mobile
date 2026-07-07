import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useRouter } from '../components/Router';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type SshKey = {
  id: string;
  name: string;
  type: string;
  fingerprint: string;
  createdAt: string;
};

type KeysResponse = {
  success: boolean;
  sshKeys: SshKey[];
  limitUsed: number;
  limitMax: number;
};

type View = "list" | "import" | "generate";

export function SSHKeysScreen() {
  const { t } = useI18n();
  const { back } = useRouter();
  const { show } = useToast();
  const [view, setView] = useState<View>("list");
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [limitUsed, setLimitUsed] = useState(0);
  const [limitMax, setLimitMax] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.sshKeys.list();
      if (data.success) {
        setKeys(data.sshKeys as SshKey[]);
        setLimitUsed(data.limitUsed);
        setLimitMax(data.limitMax);
        setError(null);
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const deleteKey = async (id: string) => {
    try {
      await api.sshKeys.delete(id);
      setKeys((k) => k.filter((x) => x.id !== id));
      show(t("sshKeyDeleted"), "success");
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  if (view === "import") {
    return (
      <ImportView
        onBack={() => setView("list")}
        onDone={() => { setView("list"); setIsLoading(true); void load(); }}
      />
    );
  }

  if (view === "generate") {
    return (
      <GenerateView
        generatedPrivateKey={generatedPrivateKey}
        setGeneratedPrivateKey={setGeneratedPrivateKey}
        onBack={() => { setGeneratedPrivateKey(null); setView("list"); }}
        onDone={() => { setView("list"); setGeneratedPrivateKey(null); setIsLoading(true); void load(); }}
      />
    );
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-3 pb-24 pt-2">
        <div className="glass flex items-center justify-between p-3">
          <span className="text-xs text-(--text-muted)">{t("sshKeyLimit")}</span>
          <span className="text-sm font-semibold text-(--text-primary)">{limitUsed} / {limitMax}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("import")}
            className="glass glass-hover flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium text-(--text-secondary)"
          >
            <Plus className="size-3.5" />
            {t("sshKeyAddPublic")}
          </button>
          <button
            type="button"
            onClick={() => setView("generate")}
            className="glass glass-hover flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium text-(--text-secondary)"
          >
            <Key className="size-3.5" />
            {t("sshKeyGenerate")}
          </button>
        </div>

        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">{error}</div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass animate-pulse h-16" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("sshKeyNoKeys")}</div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="glass flex items-start gap-3 p-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-(--surface-soft) text-(--elizon-primary)">
                <Key className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-(--text-primary)">{key.name}</p>
                <p className="truncate font-mono text-[10px] text-(--text-muted)">{key.fingerprint}</p>
                <p className="text-[10px] text-(--text-muted)">{key.type} · {new Date(key.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                type="button"
                onClick={() => void deleteKey(key.id)}
                className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error)"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function ImportView({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      const data = await api.sshKeys.create({ name, publicKey });
      if (data.success) {
        show(t("sshKeyAdded2"), "success");
        onDone();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-(--text-primary)">{t("sshKeyAddPublic")}</h1>
      </div>
      <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">{t("sshKeyName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">{t("sshKeyPublicKey")}</Label>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder={t("sshKeyPublicKeyPlaceholder")}
            rows={5}
            className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 font-mono text-xs text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--elizon-primary) resize-none"
          />
        </div>
        <Button
          onClick={() => void save()}
          disabled={isSaving || !name.trim() || !publicKey.trim()}
          className="btn-primary w-full justify-center rounded-xl py-3"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : t("sshKeyAdd")}
        </Button>
      </main>
    </div>
  );
}

function GenerateView({
  generatedPrivateKey,
  setGeneratedPrivateKey,
  onBack,
  onDone,
}: {
  generatedPrivateKey: string | null;
  setGeneratedPrivateKey: (key: string | null) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState<"ed25519" | "rsa4096" | "rsa8192">("ed25519");
  const [passphrase, setPassphrase] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const generate = async () => {
    setIsGenerating(true);
    try {
      const data = await api.sshKeys.generate({ name, keyType, passphrase: passphrase || undefined });
      if (data.success) {
        setGeneratedPrivateKey(data.privateKey);
        setPublicKey(data.publicKey);
        show(t("sshKeyGenerated"), "success");
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPrivate = () => {
    if (generatedPrivateKey) {
      void navigator.clipboard.writeText(generatedPrivateKey);
      show(t("copied"), "success");
    }
  };

  if (generatedPrivateKey) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("sshKeyPrivateKey")}</h1>
        </div>
        <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
          <div className="glass border border-(--warning)/40 p-3">
            <p className="text-xs font-medium text-(--warning)">{t("sshKeyPrivateKeyHint")}</p>
          </div>
          <div className="relative">
            <pre className="max-h-64 overflow-y-auto rounded-xl bg-(--bg-elevated) p-3 font-mono text-[10px] text-(--text-primary) whitespace-pre-wrap break-all">
              {generatedPrivateKey}
            </pre>
            <button
              type="button"
              onClick={copyPrivate}
              className="absolute right-2 top-2 rounded-lg bg-(--surface-soft) p-1.5 text-(--text-muted) hover:text-(--text-primary)"
            >
              <Copy className="size-4" />
            </button>
          </div>
          <Button onClick={onDone} className="btn-primary w-full justify-center rounded-xl py-3">
            {t("close")}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-(--text-primary)">{t("sshKeyGenerate")}</h1>
      </div>
      <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">{t("sshKeyName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">{t("sshKeyKeyType")}</Label>
          <div className="flex gap-2">
            {(["ed25519", "rsa4096", "rsa8192"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setKeyType(type)}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-xs font-medium transition-colors",
                  keyType === type
                    ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--elizon-primary)"
                    : "border-(--border) text-(--text-muted)",
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">{t("sshKeyPassphrase")} ({t("optional")})</Label>
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={t("sshKeyPassphrasePlaceholder")}
            className="h-10 rounded-xl"
          />
        </div>
        <Button
          onClick={() => void generate()}
          disabled={isGenerating || !name.trim()}
          className="btn-primary w-full justify-center rounded-xl py-3"
        >
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : t("generate")}
        </Button>
      </main>
    </div>
  );
}

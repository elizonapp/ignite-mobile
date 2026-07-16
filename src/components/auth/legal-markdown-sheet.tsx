import { ArrowLeft } from "lucide-react";

import { getLegalPage, type LegalSlug } from "../../lib/legal-content";
import { useI18n } from "../../i18n";
import { LegalMarkdownView } from "./legal-markdown-view";

export function LegalMarkdownSheet({
  slug,
  onClose,
}: {
  slug: LegalSlug | null;
  onClose: () => void;
}) {
  const { t } = useI18n();

  if (!slug) return null;

  const page = getLegalPage(slug);
  const title = page ? t(page.labelKey) : slug;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--bg-base)">
      <header className="safe-top safe-x flex shrink-0 items-center gap-3 border-b border-(--border) bg-(--bg-base)/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("back")}
          className="rounded-control p-1.5 text-(--text-secondary) transition-colors hover:bg-(--bg-elevated) hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-(--text-primary)">{title}</h1>
      </header>
      <div className="safe-bottom safe-x flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <LegalMarkdownView slug={slug} />
      </div>
    </div>
  );
}

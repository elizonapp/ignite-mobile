import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { useI18n } from "../../i18n";
import { fetchLegalMarkdown, type LegalSlug } from "../../lib/legal-content";

export function LegalMarkdownView({ slug }: { slug: LegalSlug }) {
  const { t, lang } = useI18n();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setContent("");

    void fetchLegalMarkdown(slug, lang === "de" ? "de" : "en")
      .then((markdown) => {
        if (!cancelled) setContent(markdown);
      })
      .catch(() => {
        if (!cancelled) setError(t("authLegalLoadError"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, lang, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-(--primary)" />
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-(--error)">{error}</p>;
  }

  return (
    <div className="legal-prose mx-auto max-w-3xl">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-(--primary) hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

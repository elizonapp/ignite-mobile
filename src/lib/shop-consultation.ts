import type { AdvisorQuestion, ShopCategory } from "./shop-catalog";

export function localizeShopText(
  value: unknown,
  lang: string,
  fallback = "",
): string {
  if (!value) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, string>;
    return record[lang] || record.en || record.de || Object.values(record).find((v) => typeof v === "string") || fallback;
  }
  return fallback;
}

export function getAdvisorQuestions(category: ShopCategory): AdvisorQuestion[] {
  const flow = category.consultationFlow;
  if (flow?.enabled && (flow.questions?.length ?? 0) > 0) {
    return flow.questions.map((question) => ({
      id: question.id,
      text: question.text,
      options: (question.options ?? []).map((option) => ({
        id: option.id,
        text: option.text,
        scores: Object.fromEntries(
          (option.scoreEntries ?? [])
            .filter((entry) => entry.targetCategoryKey)
            .map((entry) => [entry.targetCategoryKey, Number(entry.points ?? 0)]),
        ),
      })),
    }));
  }

  const config = category.consultationConfig;
  if (config?.mode === "advisor" && Array.isArray(config.questions)) {
    return config.questions as AdvisorQuestion[];
  }

  return [];
}

export function categoryHasAdvisor(category: ShopCategory): boolean {
  const questions = getAdvisorQuestions(category);
  return questions.length > 0 && (category.children?.length ?? 0) > 0;
}

export function getAdvisorTopCategory(
  category: ShopCategory,
  questions: AdvisorQuestion[],
  answers: Record<string, string>,
  lang: string,
): ShopCategory | null {
  const scores: Record<string, number> = {};
  for (const question of questions) {
    const option = question.options.find((entry) => entry.id === answers[question.id]);
    if (!option) continue;
    for (const [key, value] of Object.entries(option.scores ?? {})) {
      scores[key] = (scores[key] ?? 0) + value;
    }
  }

  const ranked = (category.children ?? [])
    .map((child) => ({ child, score: scores[child.key] ?? 0 }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.child.name.localeCompare(b.child.name, lang === "de" ? "de" : "en");
    });

  return ranked[0]?.child ?? null;
}

export function getAdvisorCopy(category: ShopCategory, lang: string) {
  const flow = category.consultationFlow;
  const config = category.consultationConfig;
  const useFlow = Boolean(flow?.enabled && (flow.questions?.length ?? 0) > 0);

  return {
    title: localizeShopText(
      useFlow ? flow?.title : config?.title,
      lang,
      lang === "de" ? "Brauchen Sie Hilfe bei der Auswahl?" : "Need help choosing?",
    ),
    description: localizeShopText(
      useFlow ? flow?.description : config?.description,
      lang,
      lang === "de"
        ? "Beantworten Sie ein paar kurze Fragen – wir empfehlen Ihnen die passende Kategorie."
        : "Answer a few short questions and we will recommend the right category.",
    ),
  };
}

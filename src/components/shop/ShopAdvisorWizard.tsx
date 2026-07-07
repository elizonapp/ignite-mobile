import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { useI18n } from "../../i18n";
import type { ShopCategory } from "../../lib/shop-catalog";
import {
  categoryHasAdvisor,
  getAdvisorCopy,
  getAdvisorQuestions,
  getAdvisorTopCategory,
  localizeShopText,
} from "../../lib/shop-consultation";
import { ShopWizardShell, WizardNav, WizardOption } from "./wizard-shell";

type AdvisorPhase = "intro" | "questions" | "result";

type ShopAdvisorWizardProps = {
  category: ShopCategory;
  onClose: () => void;
  onSelectCategory: (category: ShopCategory) => void;
};

export function ShopAdvisorWizard({ category, onClose, onSelectCategory }: ShopAdvisorWizardProps) {
  const { t, lang } = useI18n();
  const questions = useMemo(() => getAdvisorQuestions(category), [category]);
  const copy = useMemo(() => getAdvisorCopy(category, lang), [category, lang]);

  const [phase, setPhase] = useState<AdvisorPhase>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const topCategory = useMemo(
    () => (phase === "result" ? getAdvisorTopCategory(category, questions, answers, lang) : null),
    [phase, category, questions, answers, lang],
  );

  if (!categoryHasAdvisor(category)) return null;

  const restart = () => {
    setPhase("intro");
    setQuestionIndex(0);
    setAnswers({});
  };

  if (phase === "intro") {
    return (
      <ShopWizardShell
        title={copy.title}
        subtitle={copy.description}
        stepIndex={0}
        stepCount={questions.length + 1}
        stepLabel={t("beraterTitle")}
        onClose={onClose}
        footer={
          <button type="button" onClick={() => setPhase("questions")} className="btn-primary w-full rounded-xl py-3 text-sm font-semibold">
            {t("beraterStart")}
          </button>
        }
      >
        <div className="glass flex flex-col items-center gap-4 p-8 text-center">
          <Sparkles className="size-10 text-(--elizon-primary)" />
          <p className="text-sm text-(--text-secondary)">{copy.description}</p>
          <p className="text-xs text-(--text-muted)">
            {questions.length} {t("beraterQuestion").toLowerCase()}
          </p>
        </div>
      </ShopWizardShell>
    );
  }

  if (phase === "result") {
    return (
      <ShopWizardShell
        title={t("beraterResult")}
        stepIndex={questions.length}
        stepCount={questions.length + 1}
        stepLabel={t("beraterTitle")}
        onClose={onClose}
        footer={
          topCategory ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(topCategory);
                  onClose();
                }}
                className="btn-primary w-full rounded-xl py-3 text-sm font-semibold"
              >
                {t("beraterGoToCategory")}
              </button>
              <button type="button" onClick={restart} className="btn-secondary w-full rounded-xl py-2.5 text-sm">
                {t("beraterRestart")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={restart} className="btn-secondary w-full rounded-xl py-2.5 text-sm">
              {t("beraterRestart")}
            </button>
          )
        }
      >
        {topCategory ? (
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-(--text-primary)">{topCategory.name}</h2>
            {topCategory.description ? (
              <p className="text-sm text-(--text-secondary)">{topCategory.description}</p>
            ) : null}
            {topCategory.tagline ? (
              <p className="text-xs text-(--text-muted)">{topCategory.tagline}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-(--text-secondary)">{t("beraterNoResult")}</p>
        )}
      </ShopWizardShell>
    );
  }

  const question = questions[questionIndex];
  if (!question) return null;

  const questionText = localizeShopText(question.text, lang);
  const selectedOptionId = answers[question.id];
  const isLast = questionIndex === questions.length - 1;

  return (
    <ShopWizardShell
      title={questionText}
      stepIndex={questionIndex}
      stepCount={questions.length + 1}
      stepLabel={`${t("beraterQuestion")} ${questionIndex + 1} / ${questions.length}`}
      onClose={onClose}
      footer={
        <WizardNav
          showBack={questionIndex > 0}
          onBack={() => setQuestionIndex((index) => Math.max(0, index - 1))}
          onNext={() => {
            if (isLast) setPhase("result");
            else setQuestionIndex((index) => index + 1);
          }}
          backLabel={t("beraterBack")}
          nextLabel={isLast ? t("beraterResult") : t("beraterNext")}
          nextDisabled={!selectedOptionId}
        />
      }
    >
      <div className="grid gap-2">
        {question.options.map((option) => (
          <WizardOption
            key={option.id}
            label={localizeShopText(option.text, lang)}
            selected={selectedOptionId === option.id}
            onSelect={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
          />
        ))}
      </div>
    </ShopWizardShell>
  );
}

export function categoryShowsAdvisor(category: ShopCategory): boolean {
  return categoryHasAdvisor(category);
}

export function categoryShowsConfigurator(category: ShopCategory): boolean {
  return Boolean(category.configuratorEnabled && category.products.length > 0);
}

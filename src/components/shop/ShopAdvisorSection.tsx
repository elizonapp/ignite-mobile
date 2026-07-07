import { useMemo, useState } from "react";

import { useI18n } from "../../i18n";
import type { ShopCategory } from "../../lib/shop-catalog";
import {
  categoryHasAdvisor,
  getAdvisorCopy,
  getAdvisorQuestions,
  getAdvisorTopCategory,
  localizeShopText,
} from "../../lib/shop-consultation";

type AdvisorWizardState = "idle" | "active" | "result";

type ShopAdvisorSectionProps = {
  category: ShopCategory;
  onSelectCategory: (category: ShopCategory) => void;
  className?: string;
};

export function ShopAdvisorSection({ category, onSelectCategory, className = "" }: ShopAdvisorSectionProps) {
  const { t, lang } = useI18n();
  const questions = useMemo(() => getAdvisorQuestions(category), [category]);
  const copy = useMemo(() => getAdvisorCopy(category, lang), [category, lang]);

  const [wizardState, setWizardState] = useState<AdvisorWizardState>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const topCategory = useMemo(
    () => (wizardState === "result" ? getAdvisorTopCategory(category, questions, answers, lang) : null),
    [wizardState, category, questions, answers, lang],
  );

  if (!categoryHasAdvisor(category)) return null;

  const restart = () => {
    setWizardState("idle");
    setCurrentQuestionIndex(0);
    setAnswers({});
  };

  return (
    <section
      id="category-advisor"
      className={`rounded-[var(--radius-surface)] border border-(--border) bg-(--bg-elevated) p-6 ${className}`}
    >
      {wizardState === "idle" ? (
        <AdvisorIdle
          title={copy.title || t("beraterTitle")}
          description={copy.description || t("beraterDescription")}
          onStart={() => {
            setAnswers({});
            setCurrentQuestionIndex(0);
            setWizardState("active");
          }}
        />
      ) : null}

      {wizardState === "active" ? (
        <AdvisorWizardStep
          questions={questions}
          currentIndex={currentQuestionIndex}
          answers={answers}
          onSelect={(questionId, optionId) => setAnswers((prev) => ({ ...prev, [questionId]: optionId }))}
          onNext={() => {
            if (currentQuestionIndex >= questions.length - 1) setWizardState("result");
            else setCurrentQuestionIndex((index) => index + 1);
          }}
          onBack={() => {
            if (currentQuestionIndex <= 0) setWizardState("idle");
            else setCurrentQuestionIndex((index) => index - 1);
          }}
        />
      ) : null}

      {wizardState === "result" ? (
        <AdvisorResult
          topCategory={topCategory}
          onRestart={restart}
          onSelectCategory={() => {
            if (topCategory) onSelectCategory(topCategory);
          }}
        />
      ) : null}
    </section>
  );
}

function AdvisorIdle({
  title,
  description,
  onStart,
}: {
  title: string;
  description: string;
  onStart: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-(--text-muted)">{t("categoryConsultationPill")}</p>
        <h2 className="text-xl font-semibold text-(--text-primary)">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-(--text-secondary)">{description}</p>
      </div>
      <button type="button" onClick={onStart} className="btn-primary shrink-0 rounded-xl px-5 py-3 text-sm font-semibold">
        {t("beraterStart")}
      </button>
    </div>
  );
}

function AdvisorWizardStep({
  questions,
  currentIndex,
  answers,
  onSelect,
  onNext,
  onBack,
}: {
  questions: ReturnType<typeof getAdvisorQuestions>;
  currentIndex: number;
  answers: Record<string, string>;
  onSelect: (questionId: string, optionId: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const question = questions[currentIndex];
  if (!question) return null;

  const questionText = localizeShopText(question.text, lang);
  const selectedOptionId = answers[question.id];
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--border)">
          <div
            className="h-full rounded-full bg-(--elizon-primary) transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-(--text-muted)">
          {t("beraterQuestion")} {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-(--text-primary)">{questionText}</h3>

      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const optText = localizeShopText(option.text, lang);
          const isSelected = selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(question.id, option.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                isSelected
                  ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--text-primary)"
                  : "border-(--border) text-(--text-secondary) hover:border-(--elizon-primary)/40"
              }`}
            >
              {optText}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary rounded-xl px-4 py-2 text-sm">
          {t("beraterBack")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!selectedOptionId}
          className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {isLast ? t("beraterResult") : t("beraterNext")}
        </button>
      </div>
    </div>
  );
}

function AdvisorResult({
  topCategory,
  onRestart,
  onSelectCategory,
}: {
  topCategory: ShopCategory | null;
  onRestart: () => void;
  onSelectCategory: () => void;
}) {
  const { t } = useI18n();

  if (!topCategory) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-(--text-secondary)">{t("beraterNoResult")}</p>
        <button type="button" onClick={onRestart} className="btn-secondary self-start rounded-xl px-4 py-2 text-sm">
          {t("beraterRestart")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--elizon-primary)">
          {t("beraterResult")}
        </p>
        <h3 className="text-2xl font-bold text-(--text-primary)">{topCategory.name}</h3>
        {topCategory.description ? (
          <p className="mt-2 max-w-xl text-sm text-(--text-secondary)">{topCategory.description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onSelectCategory} className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
          {t("beraterGoToCategory")}
        </button>
        <button type="button" onClick={onRestart} className="btn-secondary rounded-xl px-4 py-3 text-sm">
          {t("beraterRestart")}
        </button>
      </div>
    </div>
  );
}

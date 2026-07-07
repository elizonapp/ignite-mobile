import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";

import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type FeedbackItem = {
  id: string;
  category: string;
  rating: number;
  message?: string | null;
  status: string;
  ticketId?: string | null;
  serviceId?: string | null;
  adminReply?: string | null;
  adminRepliedAt?: string | null;
  createdAt: string;
  ticket?: { id: string; ticketNumber: string; subject: string } | null;
  service?: { id: string; name: string } | null;
};

type FeedbackResponse = { success: boolean; feedback: FeedbackItem[] };

type Ticket = { id: string; ticketNumber: string; subject: string };
type Service = { id: string; name: string };

const CATEGORIES = [
  { value: "general", labelKey: "feedbackCategoryGeneral" },
  { value: "feature", labelKey: "feedbackCategoryFeature" },
  { value: "bug", labelKey: "feedbackCategoryBug" },
  { value: "experience", labelKey: "feedbackCategoryExperience" },
  { value: "other", labelKey: "feedbackCategoryOther" },
] as const;

export function FeedbackScreen() {
  const { t } = useI18n();
  const { show } = useToast();
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState("general");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLinkValue =
    selectedTicketId ? `ticket-${selectedTicketId}` : selectedServiceId ? `service-${selectedServiceId}` : "";

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fb, tix, svcs] = await Promise.all([
        api.get<FeedbackResponse>("/api/feedback"),
        api.get<{ success: boolean; tickets: Ticket[] }>("/api/tickets", { limit: 100 }),
        api.get<{ success: boolean; servers: Service[] }>("/api/services", { limit: 100, view: "compact" }),
      ]);
      if (fb.success) setHistory(fb.feedback);
      if (tix.success) setTickets(tix.tickets);
      if (svcs.success) setServices(svcs.servers);
    } catch {
      // silent — show empty states
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const feedbackTicketIds = useMemo(
    () => new Set(history.filter((f) => f.ticketId).map((f) => f.ticketId as string)),
    [history],
  );
  const feedbackServiceIds = useMemo(
    () => new Set(history.filter((f) => f.serviceId).map((f) => f.serviceId as string)),
    [history],
  );

  const availableTickets = useMemo(
    () => tickets.filter((ticket) => !feedbackTicketIds.has(ticket.id)),
    [tickets, feedbackTicketIds],
  );
  const availableServices = useMemo(
    () => services.filter((service) => !feedbackServiceIds.has(service.id)),
    [services, feedbackServiceIds],
  );
  const hasNothingToRate = availableTickets.length === 0 && availableServices.length === 0;

  const hasValidLink =
    (Boolean(selectedTicketId) && !selectedServiceId) ||
    (Boolean(selectedServiceId) && !selectedTicketId);
  const canSubmitFeedback = hasValidLink && rating >= 1 && rating <= 5 && !isSubmitting;

  const getCategoryLabel = (cat: string) => {
    const match = CATEGORIES.find((c) => c.value === cat);
    return match ? t(match.labelKey) : cat;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "NEW":
        return t("feedbackStatusNew");
      case "READ":
        return t("feedbackStatusRead");
      case "ARCHIVED":
        return t("feedbackStatusArchived");
      default:
        return status;
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setCategory("general");
    setRating(0);
    setMessage("");
    setSelectedTicketId("");
    setSelectedServiceId("");
  };

  const submit = async () => {
    if (rating === 0) {
      show(t("feedbackRating"), "error");
      return;
    }
    if (!hasValidLink) {
      if (selectedTicketId && selectedServiceId) {
        show(t("feedbackExactlyOneLink"), "error");
      } else {
        show(t("feedbackTicketOrServiceRequired"), "error");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post<{ success: boolean; error?: string }>("/api/feedback", {
        category,
        rating,
        message: message.trim() || undefined,
        ticketId: selectedTicketId || undefined,
        serviceId: selectedServiceId || undefined,
      });
      if (data.success) {
        show(t("feedbackSubmitted"), "success");
        resetForm();
        void load();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        {!showForm ? (
          hasNothingToRate ? (
            <div className="glass p-4 text-center text-sm text-(--text-muted)">
              {t("feedbackNothingToRate")}
            </div>
          ) : (
            <Button
              onClick={() => setShowForm(true)}
              className="btn-primary w-full justify-center rounded-xl py-3"
            >
              <Star className="mr-2 size-4" />
              {t("feedbackSubmit")}
            </Button>
          )
        ) : (
          <div className="glass space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("feedbackCategory")}</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === cat.value
                        ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--elizon-primary)"
                        : "border-(--border) text-(--text-muted)",
                    )}
                  >
                    {t(cat.labelKey)}
                  </button>
                ))}
              </div>
              {category === "general" && (
                <p className="text-[11px] text-(--text-muted)">{t("feedbackCategoryGeneralHint")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("feedbackSelectTicketOrService")}</Label>
              <select
                value={selectedLinkValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.startsWith("ticket-")) {
                    setSelectedTicketId(value.slice(7));
                    setSelectedServiceId("");
                  } else if (value.startsWith("service-")) {
                    setSelectedServiceId(value.slice(8));
                    setSelectedTicketId("");
                  } else {
                    setSelectedTicketId("");
                    setSelectedServiceId("");
                  }
                }}
                className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
              >
                <option value="">{t("feedbackSelectPlaceholder")}</option>
                {availableTickets.length > 0 && (
                  <optgroup label={t("feedbackOptgroupTickets")}>
                    {availableTickets.map((ticket) => (
                      <option key={ticket.id} value={`ticket-${ticket.id}`}>
                        {ticket.ticketNumber} – {ticket.subject}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableServices.length > 0 && (
                  <optgroup label={t("feedbackOptgroupServices")}>
                    {availableServices.map((service) => (
                      <option key={service.id} value={`service-${service.id}`}>
                        {service.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("feedbackRating")}</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        "size-7 transition-colors",
                        star <= rating ? "fill-(--warning) text-(--warning)" : "text-(--border)",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("feedbackMessage")} ({t("optional")})</Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("feedbackMessagePlaceholder")}
                rows={3}
                className="w-full resize-none rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--elizon-primary)"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="flex-1 rounded-xl"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={!canSubmitFeedback}
                className="btn-primary flex-1 justify-center rounded-xl"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("feedbackSubmit")}
              </Button>
            </div>
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("feedbackHistory")}</h2>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-(--text-muted)" />
          </div>
        ) : history.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("feedbackNoFeedback")}</div>
        ) : (
          history.map((fb) => (
            <div key={fb.id} className="glass space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--text-primary)">{getCategoryLabel(fb.category)}</p>
                  {fb.ticket && (
                    <p className="mt-0.5 text-[11px] text-(--text-muted)">
                      <span className="text-(--elizon-primary)">{t("feedbackTicketLabel")}:</span>{" "}
                      {fb.ticket.ticketNumber} – {fb.ticket.subject}
                    </p>
                  )}
                  {fb.service && (
                    <p className="mt-0.5 text-[11px] text-(--text-muted)">
                      <span className="text-(--elizon-primary)">{t("feedbackServiceLabel")}:</span>{" "}
                      {fb.service.name}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-(--text-muted)">
                  {new Date(fb.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        "size-3.5",
                        s <= fb.rating ? "fill-(--warning) text-(--warning)" : "text-(--border)",
                      )}
                    />
                  ))}
                </div>
                <span className="rounded-full bg-(--surface-soft) px-2 py-0.5 text-[10px] text-(--text-muted)">
                  {getStatusLabel(fb.status)}
                </span>
              </div>
              {fb.message && (
                <p className="text-xs text-(--text-secondary)">{fb.message}</p>
              )}
              {fb.adminReply && (
                <div className="rounded-lg bg-(--surface-soft) p-2">
                  <p className="text-[10px] font-medium text-(--elizon-primary)">{t("feedbackAdminReply")}</p>
                  <p className="mt-0.5 text-xs text-(--text-secondary)">{fb.adminReply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}

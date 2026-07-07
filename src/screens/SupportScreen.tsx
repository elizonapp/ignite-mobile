import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowLeft, BookOpen, ChevronRight, Copy, Loader2, MessageSquare, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useRouter } from '../components/Router';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { pickSupportResponseForDisplay } from '../lib/support-response-display-pick';
import { cn } from '../lib/utils';

type TicketMessage = {
  id: string;
  content: string;
  isStaff?: boolean;
  createdAt: string;
  author?: { displayName: string | null; email: string };
};

type Ticket = {
  id: string;
  ticketNumber?: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  service?: { id: string; name: string; status?: string };
  messages?: TicketMessage[];
};

type TicketStats = {
  openCount: number;
  avgFirstResponseMinutes: number | null;
  satisfaction: number | null;
};

type SupportPerformance = {
  avgFirstResponseMinutes: number | null;
  medianFirstResponseMinutes: number | null;
};

function formatResponseDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

type KbArticle = {
  id: string;
  slug: string;
  title: string;
  category: string;
  content?: string;
};

type SupportPin = {
  supportPin: string | null;
  pinExpiresAt: string | null;
  pinTimeLeft: number | null;
  pinCooldown: number | null;
};

export function SupportScreen() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const { show } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [supportPerformance, setSupportPerformance] = useState<SupportPerformance | null>(null);
  const [activeTab, setActiveTab] = useState<"tickets" | "kb" | "pin">("tickets");

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketTab, setTicketTab] = useState<"open" | "closed">("open");

  // Support PIN
  const [pinData, setPinData] = useState<SupportPin | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinTimeLeft, setPinTimeLeft] = useState<number | null>(null);
  const pinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Knowledge base
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await api.support.tickets(50);
      if (data.success) {
        setTickets((data.tickets ?? []) as Ticket[]);
        setStats((data.stats as TicketStats | undefined) ?? null);
        setError(null);
      } else {
        setError(resolveApiError(data, t, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const fetchSupportStats = useCallback(async () => {
    try {
      const data = await api.publicApi.supportStats();
      if (data.success && data.stats) {
        setSupportPerformance({
          avgFirstResponseMinutes:
            typeof data.stats.avgFirstResponseMinutes === "number"
              ? data.stats.avgFirstResponseMinutes
              : null,
          medianFirstResponseMinutes:
            typeof data.stats.medianFirstResponseMinutes === "number"
              ? data.stats.medianFirstResponseMinutes
              : null,
        });
      }
    } catch { /* silent */ }
  }, []);

  const displayedSupportResponse = useMemo(() => {
    const avg =
      supportPerformance?.avgFirstResponseMinutes ?? stats?.avgFirstResponseMinutes ?? null;
    const median = supportPerformance?.medianFirstResponseMinutes ?? null;
    return pickSupportResponseForDisplay({ avgFirstResponseMinutes: avg, medianFirstResponseMinutes: median });
  }, [supportPerformance, stats]);

  const fetchPin = useCallback(async () => {
    try {
      const data = await api.user.supportPin();
      setPinData(data);
      if (data.pinTimeLeft) setPinTimeLeft(data.pinTimeLeft);
    } catch { /* silent */ }
  }, []);

  const fetchKb = useCallback(async () => {
    if (articles.length > 0) return;
    setKbLoading(true);
    try {
      const data = await api.support.knowledgeBase(lang);
      if (data.success) setArticles((data.articles ?? []) as KbArticle[]);
    } catch { /* silent */ } finally {
      setKbLoading(false);
    }
  }, [lang, articles.length]);

  useEffect(() => {
    void fetchTickets();
    void fetchPin();
    void fetchSupportStats();
  }, [fetchTickets, fetchPin, fetchSupportStats]);

  useEffect(() => {
    if (activeTab === "kb") void fetchKb();
  }, [activeTab, fetchKb]);

  // Countdown for PIN expiry
  useEffect(() => {
    if (pinTimerRef.current) clearInterval(pinTimerRef.current);
    if (pinTimeLeft && pinTimeLeft > 0) {
      pinTimerRef.current = setInterval(() => {
        setPinTimeLeft((t) => (t && t > 1 ? t - 1 : null));
      }, 1000);
    }
    return () => { if (pinTimerRef.current) clearInterval(pinTimerRef.current); };
  }, [pinTimeLeft]);

  const generatePin = async () => {
    setPinLoading(true);
    try {
      const data = await api.user.generateSupportPin();
      setPinData(data);
      if (data.pinTimeLeft) setPinTimeLeft(data.pinTimeLeft);
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setPinLoading(false);
    }
  };

  const copyPin = () => {
    if (pinData?.supportPin) {
      void navigator.clipboard.writeText(pinData.supportPin);
      show(t("copied"), "success");
    }
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    setIsSubmitting(true);
    try {
      const data = await api.support.createTicket({
        subject: newSubject,
        message: newMessage,
        priority: newPriority,
      });
      if (data.success && data.ticket) {
        show(t("save"), "success");
        setShowNewTicket(false);
        setNewSubject("");
        setNewMessage("");
        setNewPriority("medium");
        void fetchTickets();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const replyToTicket = async (ticketId: string) => {
    if (!replyMessage.trim()) return;
    setIsSubmitting(true);
    try {
      const data = await api.support.reply(ticketId, replyMessage);
      if (data.success) {
        show(t("save"), "success");
        setReplyMessage("");
        const detail = await api.support.ticket(ticketId);
        if (detail.success) setSelectedTicket(detail.ticket as Ticket);
        void fetchTickets();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTicket = async (ticketId: string) => {
    try {
      const data = await api.support.ticket(ticketId);
      if (data.success) setSelectedTicket(data.ticket as Ticket);
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const filteredTickets = tickets.filter((tk) =>
    ticketTab === "open" ? tk.status !== "closed" : tk.status === "closed",
  );

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return "text-green-400";
      case "pending": return "text-yellow-400";
      case "closed": return "text-(--text-muted)";
      default: return "text-(--text-secondary)";
    }
  };

  // KB article detail
  if (selectedArticle) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setSelectedArticle(null)} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="truncate text-base font-semibold text-(--text-primary)">{selectedArticle.title}</h1>
        </div>
        <main className="safe-x safe-bottom flex-1 overflow-y-auto px-4 pb-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-(--text-secondary)">
            {selectedArticle.content ?? ""}
          </p>
        </main>
      </div>
    );
  }

  // Ticket detail view
  if (selectedTicket) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setSelectedTicket(null)} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-semibold text-(--text-primary)">{selectedTicket.subject}</h1>
            <p className="text-xs text-(--text-muted)">
              #{selectedTicket.ticketNumber ?? selectedTicket.id.slice(0, 8)} ·{" "}
              <span className={statusColor(selectedTicket.status)}>{selectedTicket.status}</span>
            </p>
          </div>
        </div>
        <main className="safe-x safe-bottom flex-1 space-y-3 overflow-y-auto pb-4">
          {selectedTicket.messages?.map((msg) => (
            <div key={msg.id} className={cn("glass p-3", msg.isStaff && "border-l-2 border-(--elizon-primary)")}>
              <div className="mb-1 flex items-center justify-between text-xs text-(--text-muted)">
                <span>{msg.isStaff ? "Support" : msg.author?.displayName || "You"}</span>
                <span>{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-(--text-primary)">{msg.content}</p>
            </div>
          ))}
          {selectedTicket.status !== "closed" && (
            <div className="glass space-y-2 p-3">
              <Label className="text-xs text-(--text-muted)">{t("ticketReply")}</Label>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-(--border) bg-transparent p-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--elizon-primary) focus:outline-none"
                placeholder={t("ticketReplyPlaceholder")}
              />
              <Button
                onClick={() => void replyToTicket(selectedTicket.id)}
                disabled={isSubmitting || !replyMessage.trim()}
                className="btn-primary w-full justify-center rounded-xl py-2.5"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("ticketSend")}
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // New ticket form
  if (showNewTicket) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setShowNewTicket(false)} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("ticketNew")}</h1>
        </div>
        <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("ticketSubject")}</Label>
            <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder={t("ticketSubjectPlaceholder")} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("ticketPriority")}</Label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                    newPriority === p
                      ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--elizon-primary)"
                      : "border-(--border) text-(--text-secondary) hover:bg-(--bg-elevated)",
                  )}
                >
                  {t(`ticketPriority${p.charAt(0).toUpperCase() + p.slice(1)}` as "ticketPriorityLow")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("ticketMessage")}</Label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg border border-(--border) bg-transparent p-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--elizon-primary) focus:outline-none"
              placeholder={t("ticketMessagePlaceholder")}
            />
          </div>
          <Button
            onClick={() => void createTicket()}
            disabled={isSubmitting || !newSubject.trim() || !newMessage.trim()}
            className="btn-primary w-full justify-center rounded-xl py-3"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("ticketCreate")}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate({ name: "dashboard" })} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("support")}</h1>
        </div>
        <div className="flex gap-2">
          {activeTab === "tickets" && (
            <>
              <button type="button" onClick={() => void fetchTickets()} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
                <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
              </button>
              <button type="button" onClick={() => setShowNewTicket(true)} className="rounded-lg p-1.5 text-(--elizon-primary) hover:bg-(--bg-elevated)">
                <Plus className="size-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top tabs: Tickets / KB / PIN */}
      <div className="safe-x flex gap-1 border-b border-(--border) px-4">
        {([
          { id: "tickets", icon: MessageSquare, label: t("ticketTabOpen") },
          { id: "kb", icon: BookOpen, label: t("supportKb") },
          { id: "pin", icon: ShieldCheck, label: t("supportPin") },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
              activeTab === id
                ? "border-(--elizon-primary) text-(--elizon-primary)"
                : "border-transparent text-(--text-muted)",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <main className="safe-x safe-bottom flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {/* ── Tickets tab ── */}
        {activeTab === "tickets" && (
          <div className="space-y-3">
            {stats && (
              <div className="flex gap-3">
                <div className="glass flex-1 p-3 text-center">
                  <p className="text-2xl font-bold text-(--text-primary)">{stats.openCount}</p>
                  <p className="text-[11px] text-(--text-muted)">{t("ticketOpenCount")}</p>
                </div>
                {displayedSupportResponse && (
                  <div className="glass flex-1 p-3 text-center">
                    <p className="text-2xl font-bold text-(--text-primary)">
                      {formatResponseDuration(displayedSupportResponse.minutes)}
                    </p>
                    <p className="text-[11px] text-(--text-muted)">
                      {displayedSupportResponse.kind === "median"
                        ? t("supportMedianResponse")
                        : t("supportFirstResponse")}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-1">
              {(["open", "closed"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTicketTab(tab)}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-medium transition-colors",
                    ticketTab === tab
                      ? "bg-(--elizon-primary)/10 text-(--elizon-primary)"
                      : "text-(--text-secondary) hover:bg-(--bg-elevated)",
                  )}
                >
                  {t(`ticketTab${tab.charAt(0).toUpperCase() + tab.slice(1)}` as "ticketTabOpen")}
                </button>
              ))}
            </div>

            {error && <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">{error}</div>}

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-(--text-muted)" /></div>
            ) : filteredTickets.length === 0 ? (
              <div className="glass p-6 text-center">
                <MessageSquare className="mx-auto mb-2 size-8 text-(--text-muted)" />
                <p className="text-sm text-(--text-muted)">{t("ticketNoTickets")}</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => void openTicket(ticket.id)}
                  className="glass glass-hover w-full rounded-xl p-3 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-(--text-primary)">{ticket.subject}</p>
                      <p className="mt-0.5 text-[11px] text-(--text-muted)">
                        #{ticket.ticketNumber ?? ticket.id.slice(0, 8)} · {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={cn("ml-2 text-[11px] font-medium", statusColor(ticket.status))}>{ticket.status}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Knowledge Base tab ── */}
        {activeTab === "kb" && (
          <div className="space-y-2">
            {kbLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-(--text-muted)" /></div>
            ) : articles.length === 0 ? (
              <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("supportKbNoArticles")}</div>
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setSelectedArticle(article)}
                  className="glass glass-hover flex w-full items-center gap-3 rounded-xl p-3 text-left"
                >
                  <BookOpen className="size-4 shrink-0 text-(--text-muted)" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">{article.title}</p>
                    <p className="text-[10px] text-(--text-muted)">{article.category}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-(--text-muted)" />
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Support PIN tab ── */}
        {activeTab === "pin" && (
          <div className="space-y-4">
            <div className="glass p-4 text-center space-y-3">
              <ShieldCheck className="mx-auto size-10 text-(--elizon-primary)" />
              <div>
                <p className="text-xs font-medium text-(--text-muted)">{t("supportPinHint")}</p>
              </div>

              {pinData?.supportPin && pinTimeLeft && pinTimeLeft > 0 ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-3xl font-bold tracking-[0.2em] text-(--text-primary)">
                      {pinData.supportPin}
                    </span>
                    <button
                      type="button"
                      onClick={copyPin}
                      className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-elevated)"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-(--text-muted)">
                    {t("supportPinExpires")}: {Math.floor(pinTimeLeft / 60)}:{String(pinTimeLeft % 60).padStart(2, "0")}
                  </p>
                </>
              ) : pinData?.pinCooldown && pinData.pinCooldown > 0 ? (
                <p className="text-xs text-(--text-muted)">
                  {t("supportPinCooldown")}: {Math.ceil(pinData.pinCooldown / 60)}m
                </p>
              ) : null}
            </div>

            {(!pinData?.supportPin || !pinTimeLeft || pinTimeLeft <= 0) && (!pinData?.pinCooldown || pinData.pinCooldown <= 0) && (
              <Button
                onClick={() => void generatePin()}
                disabled={pinLoading}
                className="btn-primary w-full justify-center rounded-xl py-3"
              >
                {pinLoading ? <Loader2 className="size-4 animate-spin" /> : t("supportPinGenerate")}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

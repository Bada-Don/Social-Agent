"use client";

import {
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageSquare,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface UnreadMessage {
  id: string;
  sender: string;
  text: string;
  summary: string | null;
  timestamp: Date;
  urgency: string;
}

interface Digest {
  date: string;
  content: string;
  messageCount: number;
}

function formatSender(jid: string): string {
  if (!jid) return "Unknown";
  return jid
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@g\.us$/, " (Group)");
}

function truncateText(text: string, max = 72): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Dashboard() {
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [waConnected, setWaConnected] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [digestOpen, setDigestOpen] = useState(true);

  const unreadCount = unreadMessages.length;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUnreadMessages([]);
        setUrgentCount(0);
        setTaskCount(0);
        setWaConnected(false);
        setCurrentUid(null);
        setDigest(null);
        return;
      }

      setCurrentUid(user.uid);

      // ── Unread messages (single-field query, sort client-side) ──────────
      const qMsgs = query(
        collection(db, "users", user.uid, "messages"),
        where("processed", "==", false)
      );
      const unsubMsgs = onSnapshot(qMsgs, (snap) => {
        const msgs: UnreadMessage[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sender: data.sender ?? "",
              text: data.text ?? "",
              summary: data.summary ?? null,
              timestamp: data.timestamp?.toDate?.() ?? new Date(0),
              urgency: data.urgency ?? "low",
            };
          })
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setUnreadMessages(msgs);
      });

      // ── Urgent items ────────────────────────────────────────────────────
      const qUrgent = query(
        collection(db, "users", user.uid, "messages"),
        where("urgency", "==", "high"),
        where("processed", "==", false)
      );
      const unsubUrgent = onSnapshot(qUrgent, (snap) =>
        setUrgentCount(snap.docs.length)
      );

      // ── Tasks today ─────────────────────────────────────────────────────
      const qTasks = query(
        collection(db, "users", user.uid, "tasks"),
        where("status", "==", "todo")
      );
      const unsubTasks = onSnapshot(qTasks, (snap) =>
        setTaskCount(snap.docs.length)
      );

      // ── WhatsApp connection status ───────────────────────────────────────
      const unsubDoc = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setWaConnected(docSnap.data().settings?.whatsappConnected === true);
        }
      });

      // ── Today's digest ───────────────────────────────────────────────────
      const today = new Date().toISOString().split("T")[0];
      const unsubDigest = onSnapshot(
        doc(db, "users", user.uid, "digests", today),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setDigest({ date: d.date, content: d.content, messageCount: d.messageCount });
          } else {
            setDigest(null);
          }
        }
      );

      return () => {
        unsubMsgs();
        unsubUrgent();
        unsubTasks();
        unsubDoc();
        unsubDigest();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  async function markAsRead(msgId: string) {
    if (!currentUid) return;
    setMarkingRead(msgId);
    try {
      await updateDoc(doc(db, "users", currentUid, "messages", msgId), {
        processed: true,
      });
    } catch (err) {
      console.error("[Dashboard] Failed to mark message as read:", err);
    } finally {
      setMarkingRead(null);
    }
  }

  async function markAllRead() {
    if (!currentUid || unreadMessages.length === 0) return;
    await Promise.all(unreadMessages.map((m) => markAsRead(m.id)));
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="flex justify-between items-start flex-col gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {greetingByHour()}, Chief.
          </h1>
          <p className="text-gray-400 mt-1">
            Here is what requires your attention today.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <MessageSquare size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-300">WhatsApp</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="relative flex h-2 w-2">
              {waConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  waConnected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </span>
            <span
              className={`text-xs font-medium ${
                waConnected ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {waConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-xl border-l-4 border-l-red-500">
          <div className="flex justify-between items-center text-gray-400 mb-2">
            <span className="text-sm font-medium">Urgent Items</span>
            <AlertCircle size={16} className="text-red-500" />
          </div>
          <p className="text-3xl font-bold text-white">{urgentCount}</p>
        </div>

        <div className="glass p-5 rounded-xl border-l-4 border-l-primary">
          <div className="flex justify-between items-center text-gray-400 mb-2">
            <span className="text-sm font-medium">Unread Messages</span>
            <Clock size={16} className="text-primary" />
          </div>
          <p className="text-3xl font-bold text-white">{unreadCount}</p>
        </div>

        <div className="glass p-5 rounded-xl border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-center text-gray-400 mb-2">
            <span className="text-sm font-medium">Tasks Today</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-white">{taskCount}</p>
        </div>
      </div>

      {/* Daily Digest */}
      {digest && (
        <section className="glass rounded-xl overflow-hidden">
          <button
            onClick={() => setDigestOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <span className="text-sm font-semibold text-white">Today&apos;s AI Digest</span>
              <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                {digest.messageCount} messages
              </span>
            </div>
            {digestOpen ? (
              <ChevronUp size={16} className="text-gray-500" />
            ) : (
              <ChevronDown size={16} className="text-gray-500" />
            )}
          </button>

          {digestOpen && (
            <div className="px-5 pb-5 border-t border-white/5">
              <div className="mt-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {digest.content}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Unread Message Previews */}
      {unreadMessages.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
              Unread Messages
            </h2>
            <button
              onClick={markAllRead}
              className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
            >
              <Check size={12} />
              Mark all read
            </button>
          </div>

          <div className="space-y-2">
            {unreadMessages.map((msg) => (
              <div
                key={msg.id}
                className="glass rounded-xl px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors group"
              >
                <span
                  className={`mt-2 flex-shrink-0 h-2 w-2 rounded-full ${
                    msg.urgency === "high"
                      ? "bg-red-500"
                      : msg.urgency === "medium"
                      ? "bg-yellow-400"
                      : "bg-gray-600"
                  }`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-300 truncate">
                      {formatSender(msg.sender)}
                    </p>
                    <span className="text-xs text-gray-600 flex-shrink-0">
                      {timeAgo(msg.timestamp)}
                    </span>
                  </div>
                  {/* Show AI summary if available, raw text as fallback */}
                  <p className="text-sm text-white mt-0.5 leading-snug">
                    {msg.summary ? truncateText(msg.summary) : truncateText(msg.text)}
                  </p>
                  {msg.summary && (
                    <p className="text-xs text-gray-700 italic mt-0.5 truncate">
                      {truncateText(msg.text, 60)}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => markAsRead(msg.id)}
                  disabled={markingRead === msg.id}
                  title="Mark as read"
                  className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-gray-500 hover:text-emerald-400 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

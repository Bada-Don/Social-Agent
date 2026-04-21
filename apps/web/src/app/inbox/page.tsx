"use client";

import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Search,
  Check,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  Users,
} from "lucide-react";

interface Message {
  id: string;
  sender: string;
  text: string;
  summary: string | null;
  timestamp: Date;
  urgency: "high" | "medium" | "low";
  processed: boolean;
  missedItem: boolean;
  isGroup: boolean;
  tasks: Array<{ title: string; deadline: string | null }>;
}

function formatSender(jid: string): string {
  if (!jid) return "Unknown";
  return jid
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@g\.us$/, "");
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

const URGENCY_CONFIG = {
  high: { label: "Urgent", color: "text-red-400", dot: "bg-red-500", border: "border-l-red-500" },
  medium: { label: "Medium", color: "text-yellow-400", dot: "bg-yellow-400", border: "border-l-yellow-400" },
  low: { label: "Low", color: "text-gray-500", dot: "bg-gray-600", border: "border-l-transparent" },
};

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "urgent" | "missed">("all");
  const [marking, setMarking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setMessages([]); setUid(null); return; }
      setUid(user.uid);

      // Listen to ALL messages (processed + unprocessed) so "inbox" shows full history
      const q = query(collection(db, "users", user.uid, "messages"));
      const unsub = onSnapshot(q, (snap) => {
        const msgs: Message[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sender: data.sender ?? "",
              text: data.text ?? "",
              summary: data.summary ?? null,
              timestamp: data.timestamp?.toDate?.() ?? new Date(0),
              urgency: (data.urgency ?? "low") as Message["urgency"],
              processed: data.processed ?? false,
              missedItem: data.missedItem ?? false,
              isGroup: data.isGroup ?? false,
              tasks: data.tasks ?? [],
            };
          })
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setMessages(msgs);
      });

      return () => unsub();
    });
    return () => unsubAuth();
  }, []);

  const filtered = useMemo(() => {
    let list = messages;
    if (filter === "unread") list = list.filter((m) => !m.processed);
    if (filter === "urgent") list = list.filter((m) => m.urgency === "high");
    if (filter === "missed") list = list.filter((m) => m.missedItem);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.text.toLowerCase().includes(q) ||
          formatSender(m.sender).includes(q) ||
          (m.summary ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, filter, search]);

  async function markRead(msgId: string) {
    if (!uid) return;
    setMarking(msgId);
    await updateDoc(doc(db, "users", uid, "messages", msgId), { processed: true }).catch(console.error);
    setMarking(null);
  }

  async function markAllRead() {
    if (!uid) return;
    const unread = messages.filter((m) => !m.processed);
    await Promise.all(unread.map((m) => markRead(m.id)));
  }

  const unreadCount = messages.filter((m) => !m.processed).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Unified Inbox</h1>
            <p className="text-gray-400 mt-1">
              {unreadCount > 0 ? (
                <span><span className="text-primary font-medium">{unreadCount} unread</span> · {messages.length} total</span>
              ) : (
                <span>All caught up · {messages.length} messages</span>
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              <Check size={13} />
              Mark all read
            </button>
          )}
        </div>
      </header>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search messages, contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "unread", "urgent", "missed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Message List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No messages match your filter</p>
          </div>
        )}

        {filtered.map((msg) => {
          const cfg = URGENCY_CONFIG[msg.urgency];
          const isExpanded = expanded === msg.id;

          return (
            <div
              key={msg.id}
              className={`glass rounded-xl border-l-4 ${cfg.border} transition-all cursor-pointer`}
              onClick={() => setExpanded(isExpanded ? null : msg.id)}
            >
              {/* Row */}
              <div className="px-4 py-3 flex items-start gap-3">
                {/* Urgency dot */}
                <span className={`mt-2 flex-shrink-0 h-2 w-2 rounded-full ${cfg.dot}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-300">
                      {formatSender(msg.sender)}
                    </span>
                    {msg.isGroup && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                        <Users size={10} /> Group
                      </span>
                    )}
                    {msg.missedItem && (
                      <span className="flex items-center gap-0.5 text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded-full">
                        <AlertTriangle size={9} /> Missed
                      </span>
                    )}
                    {msg.urgency === "high" && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">
                        <AlertCircle size={9} /> Urgent
                      </span>
                    )}
                    {!msg.processed && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <span className="text-[11px] text-gray-600 ml-auto flex-shrink-0">
                      {timeAgo(msg.timestamp)}
                    </span>
                  </div>

                  {/* Summary if available, else raw text */}
                  <p className="text-sm text-gray-200 mt-0.5 leading-snug">
                    {msg.summary ?? msg.text}
                  </p>
                  {msg.summary && (
                    <p className="text-xs text-gray-600 mt-0.5 italic truncate">{msg.text}</p>
                  )}
                </div>

                {/* Mark read button */}
                {!msg.processed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead(msg.id); }}
                    disabled={marking === msg.id}
                    title="Mark as read"
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-all text-gray-600 hover:text-emerald-400 disabled:opacity-40"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>

              {/* Expanded: Tasks */}
              {isExpanded && msg.tasks.length > 0 && (
                <div className="px-4 pb-3 pt-0 border-t border-white/5">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2 mt-2">
                    Extracted Tasks
                  </p>
                  <ul className="space-y-1">
                    {msg.tasks.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span>
                          {t.title}
                          {t.deadline && (
                            <span className="ml-1.5 text-yellow-400">· {t.deadline}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isExpanded && msg.tasks.length === 0 && (
                <div className="px-4 pb-3 pt-2 border-t border-white/5 text-xs text-gray-700">
                  Full message: {msg.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

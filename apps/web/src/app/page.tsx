"use client";

import { AlertCircle, Clock, CheckCircle2, MessageSquare, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface UnreadMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  urgency: string;
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
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [waConnected, setWaConnected] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  const unreadCount = unreadMessages.length;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUnreadMessages([]);
        setUrgentCount(0);
        setTaskCount(0);
        setWaConnected(false);
        setCurrentUid(null);
        return;
      }

      setCurrentUid(user.uid);

      // ─── Unread messages ───────────────────────────────────────────────────
      // Simple single-field query — no composite index needed.
      // We sort by timestamp on the client side.
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
              // Firestore Timestamp → JS Date; fall back to epoch so sort still works
              timestamp: data.timestamp?.toDate?.() ?? new Date(0),
              urgency: data.urgency ?? "low",
            };
          })
          // Newest first — done client-side to avoid needing a composite index
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setUnreadMessages(msgs);
      });

      // ─── Urgent items ──────────────────────────────────────────────────────
      // Two equality filters on the same collection — allowed without extra index.
      const qUrgent = query(
        collection(db, "users", user.uid, "messages"),
        where("urgency", "==", "high"),
        where("processed", "==", false)
      );
      const unsubUrgent = onSnapshot(qUrgent, (snap) =>
        setUrgentCount(snap.docs.length)
      );

      // ─── Tasks today ───────────────────────────────────────────────────────
      const qTasks = query(
        collection(db, "users", user.uid, "tasks"),
        where("status", "==", "todo")
      );
      const unsubTasks = onSnapshot(qTasks, (snap) =>
        setTaskCount(snap.docs.length)
      );

      // ─── WhatsApp connection status ────────────────────────────────────────
      const unsubDoc = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setWaConnected(docSnap.data().settings?.whatsappConnected === true);
        }
      });

      return () => {
        unsubMsgs();
        unsubUrgent();
        unsubTasks();
        unsubDoc();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  async function markAsRead(msgId: string) {
    if (!currentUid) return;
    setMarkingRead(msgId);
    try {
      await updateDoc(
        doc(db, "users", currentUid, "messages", msgId),
        { processed: true }
      );
      // The onSnapshot listener above will automatically remove it from the list
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
      <header className="flex justify-between items-start flex-col gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Good Morning, Chief.
          </h1>
          <p className="text-gray-400 mt-1">
            Here is what requires your attention today.
          </p>
        </div>

        {/* Real-time Connection Indicator */}
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
                {/* Urgency dot */}
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
                  <p className="text-sm text-white mt-0.5 leading-snug">
                    {truncateText(msg.text)}
                  </p>
                </div>

                {/* Mark as read button */}
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

      {/* Rest of dashboard will hold Digest & recent AI insights */}
    </div>
  );
}

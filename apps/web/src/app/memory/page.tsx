"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Contact, Clock, Plus, X } from "lucide-react";

interface MemoryEntry {
  id: string;
  jid: string;
  notes: string[];
  lastSeen: Date | null;
}

function formatSender(jid: string): string {
  if (!jid) return "Unknown";
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, " (Group)");
}

function timeAgo(date: Date | null): string {
  if (!date) return "unknown";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [newNote, setNewNote] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { setEntries([]); setUid(null); return; }
      setUid(user.uid);

      const unsubSnap = onSnapshot(collection(db, "users", user.uid, "memory"), (snap) => {
        const list: MemoryEntry[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              jid: data.jid ?? "",
              notes: data.notes ?? [],
              lastSeen: data.lastSeen?.toDate?.() ?? null,
            };
          })
          .sort((a, b) => {
            const ta = a.lastSeen?.getTime() ?? 0;
            const tb = b.lastSeen?.getTime() ?? 0;
            return tb - ta;
          });
        setEntries(list);
      });
      return () => unsubSnap();
    });
    return () => unsub();
  }, []);

  async function removeNote(entryId: string, noteIndex: number) {
    if (!uid) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const updated = entry.notes.filter((_, i) => i !== noteIndex);
    await updateDoc(doc(db, "users", uid, "memory", entryId), { notes: updated }).catch(console.error);
  }

  async function addNote(entryId: string, text: string) {
    if (!uid || !text.trim()) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const updated = [...entry.notes, text.trim()];
    await updateDoc(doc(db, "users", uid, "memory", entryId), { notes: updated }).catch(console.error);
    setNewNote(null);
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Memory</h1>
        <p className="text-gray-400 mt-1">
          Context about people and events — built automatically from conversations.
        </p>
      </header>

      {entries.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <Contact size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No memory entries yet.</p>
          <p className="text-xs mt-1 text-gray-700">They&apos;ll appear as messages come in and the AI finds notable context.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="glass rounded-xl p-4 space-y-3">
            {/* Contact header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {formatSender(entry.jid)}
                </p>
                <p className="text-[11px] text-gray-600 flex items-center gap-1 mt-0.5">
                  <Clock size={10} />
                  Last seen {timeAgo(entry.lastSeen)}
                </p>
              </div>
              {/* Add note button */}
              <button
                onClick={() => setNewNote({ id: entry.id, text: "" })}
                className="p-1.5 rounded-lg text-gray-600 hover:text-primary hover:bg-white/5 transition-all"
                title="Add note"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Notes */}
            <ul className="space-y-1.5">
              {entry.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                  <p className="text-xs text-gray-300 flex-1 leading-relaxed">{note}</p>
                  <button
                    onClick={() => removeNote(entry.id, i)}
                    className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <X size={11} />
                  </button>
                </li>
              ))}
              {entry.notes.length === 0 && (
                <li className="text-xs text-gray-700 italic">No notes yet</li>
              )}
            </ul>

            {/* Inline add note form */}
            {newNote?.id === entry.id && (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Add a note…"
                  value={newNote.text}
                  onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNote(entry.id, newNote.text);
                    if (e.key === "Escape") setNewNote(null);
                  }}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => addNote(entry.id, newNote.text)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/80 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setNewNote(null)}
                  className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

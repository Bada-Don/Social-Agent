"use client";

import { useEffect, useState } from "react";
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
import { CheckSquare, Square, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  deadline: string | null;
  status: "todo" | "done";
  sourceSender: string;
  createdAt: Date;
}

function formatSender(jid: string): string {
  if (!jid) return "";
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, " (Group)");
}

function deadlineLabel(iso: string | null): { text: string; color: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { text: iso, color: "text-gray-500" };
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { text: "Overdue", color: "text-red-400" };
  if (diffDays === 0) return { text: "Due today", color: "text-orange-400" };
  if (diffDays === 1) return { text: "Due tomorrow", color: "text-yellow-400" };
  return { text: `Due in ${diffDays}d`, color: "text-gray-400" };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todo" | "done" | "all">("todo");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { setTasks([]); setUid(null); return; }
      setUid(user.uid);

      const q = query(collection(db, "users", user.uid, "tasks"));
      const unsubSnap = onSnapshot(q, (snap) => {
        const t: Task[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title ?? "",
              deadline: data.deadline ?? null,
              status: (data.status ?? "todo") as Task["status"],
              sourceSender: data.sourceSender ?? "",
              createdAt: data.createdAt?.toDate?.() ?? new Date(0),
            };
          })
          .sort((a, b) => {
            // Overdue first, then by deadline, then by creation
            const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
            const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
            return deadlineA - deadlineB;
          });
        setTasks(t);
      });
      return () => unsubSnap();
    });
    return () => unsub();
  }, []);

  async function toggleTask(task: Task) {
    if (!uid) return;
    setToggling(task.id);
    const newStatus = task.status === "todo" ? "done" : "todo";
    await updateDoc(doc(db, "users", uid, "tasks", task.id), { status: newStatus }).catch(console.error);
    setToggling(null);
  }

  const filtered = tasks.filter((t) => filter === "all" || t.status === filter);
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const overdueCount = tasks.filter(
    (t) => t.status === "todo" && t.deadline && new Date(t.deadline) < new Date()
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Tasks</h1>
        <p className="text-gray-400 mt-1">
          {todoCount} pending
          {overdueCount > 0 && (
            <span className="text-red-400 ml-2">· {overdueCount} overdue</span>
          )}
        </p>
      </header>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(["todo", "done", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f
                ? "bg-primary text-white"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {f === "todo" ? "To Do" : f === "done" ? "Done" : "All"}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <CheckCircle2 size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {filter === "todo" ? "Nothing left to do — great work!" : "No tasks here yet"}
            </p>
          </div>
        )}

        {filtered.map((task) => {
          const dl = deadlineLabel(task.deadline);
          const isDone = task.status === "done";

          return (
            <div
              key={task.id}
              className={`glass rounded-xl px-4 py-3 flex items-start gap-3 transition-all group ${
                isDone ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() => toggleTask(task)}
                disabled={toggling === task.id}
                className="mt-0.5 flex-shrink-0 text-gray-500 hover:text-primary transition-colors disabled:opacity-40"
              >
                {isDone ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm text-white leading-snug ${isDone ? "line-through opacity-60" : ""}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {dl && (
                    <span className={`flex items-center gap-1 text-[11px] ${dl.color}`}>
                      {dl.text === "Overdue" && <AlertTriangle size={10} />}
                      {dl.text !== "Overdue" && <Clock size={10} />}
                      {dl.text}
                    </span>
                  )}
                  {task.sourceSender && (
                    <span className="text-[11px] text-gray-600">
                      from {formatSender(task.sourceSender)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

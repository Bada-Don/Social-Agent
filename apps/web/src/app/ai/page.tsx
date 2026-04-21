"use client";

import { BrainCircuit } from "lucide-react";

export default function AskAIPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Ask AI</h1>
        <p className="text-gray-400 mt-1">Chat with your executive assistant.</p>
      </header>

      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <BrainCircuit size={28} className="text-primary" />
        </div>
        <p className="text-gray-400 text-sm max-w-sm">
          AI chat interface coming soon. You&apos;ll be able to ask about your messages,
          summarize conversations, and assign tasks here.
        </p>
      </div>
    </div>
  );
}

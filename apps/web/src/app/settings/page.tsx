"use client";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { MessageSquare, RefreshCw, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  const checkStatus = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const res = await fetch(`http://localhost:8080/api/whatsapp/status?uid=${user.uid}`);
      const data = await res.json();
      if (data.connected) setStatus("connected");
    } catch (err) {
      console.error("Failed to check status", err);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const connectWhatsapp = async () => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in.");

    setLoading(true);
    setStatus("connecting");
    setQrCode(null);

    try {
      const res = await fetch("http://localhost:8080/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      
      if (data.status === "scan_qr") {
        setQrCode(data.qrCode);
      } else if (data.status === "already_connected") {
        setStatus("connected");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">System Settings</h1>
        <p className="text-gray-400 mt-1">Manage your integrations and AI protocols.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">WhatsApp Integration</h2>
                <p className="text-xs text-gray-500">Powered by Baileys Protocol</p>
              </div>
            </div>
            {status === "connected" && (
              <div className="flex items-center gap-1 text-emerald-500 text-sm font-medium">
                <CheckCircle2 size={14} />
                Connected
              </div>
            )}
          </div>

          <div className="p-4 bg-black/30 rounded-xl border border-white/5 min-h-[200px] flex flex-col items-center justify-center text-center">
            {qrCode ? (
              <div className="space-y-4">
                <div className="bg-white p-2 rounded-lg inline-block">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                </div>
                <p className="text-sm text-gray-400">Scan this code with your WhatsApp app</p>
              </div>
            ) : status === "connected" ? (
              <div className="space-y-2">
                <p className="text-emerald-500 font-medium">Instance Active</p>
                <p className="text-sm text-gray-400">The agent is currently monitoring your messages.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No active session. Click the button below to generate a new QR code.
              </p>
            )}
          </div>

          <button
            onClick={connectWhatsapp}
            disabled={loading || status === "connected"}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : "Connect WhatsApp Account"}
          </button>
        </div>

        {/* Placeholders for Gmail/Notion */}
        <div className="glass p-6 rounded-2xl opacity-50 flex items-center justify-center border-dashed border-2 border-white/10">
          <p className="text-gray-500">Gmail & Notion coming in Part 3</p>
        </div>
      </div>
    </div>
  );
}

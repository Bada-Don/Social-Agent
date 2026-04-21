"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="glass p-8 rounded-3xl w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary mx-auto flex items-center justify-center font-bold text-white text-xl shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            EA
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isRegistering ? "Create Executive Account" : "Executive Protocol Sign-in"}
          </h1>
          <p className="text-gray-400 text-sm">Welcome back, Chief.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Executive Email"
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary outline-none transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Access Code"
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary outline-none transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="w-full py-4 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all">
            {isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />}
            {isRegistering ? "Register Agent" : "Initialize Access"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {isRegistering ? "Already have an account?" : "Need a new account?"}{" "}
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-primary hover:underline">
            {isRegistering ? "Sign In" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}

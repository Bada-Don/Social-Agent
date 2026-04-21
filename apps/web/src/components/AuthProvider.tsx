"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login"); // Enabled redirect
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center text-gray-500">Initializing Executive Protocol...</div>;

  return <>{children}</>;
}

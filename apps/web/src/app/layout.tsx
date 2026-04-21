import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-8">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

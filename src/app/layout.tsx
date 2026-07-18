import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pokemon Vendor Tracker",
  description:
    "Track shared-pool Pokemon singles inventory, sales, expenses, and partner settlement.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authConfigured = isSupabaseConfigured();
  const user = authConfigured ? await getCurrentUser() : null;
  const showAppShell = !authConfigured || Boolean(user);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {showAppShell ? (
          <>
            <Nav userEmail={user?.email} />
            <div className="lg:pl-64">
              <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                {children}
              </main>
            </div>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}

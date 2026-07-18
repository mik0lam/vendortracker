"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Wallet,
  HandCoins,
  BarChart3,
  Sparkles,
  ShoppingBag,
  ArrowLeftRight,
  LogOut,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buy", label: "Show buys", icon: ShoppingBag },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/contributions", label: "Contributions", icon: HandCoins },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-sidebar-active text-white shadow-md shadow-indigo-900/30"
          : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
      } ${compact ? "justify-center px-2.5" : ""}`}
      title={compact ? label : undefined}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          active ? "text-amber-300" : "text-slate-400 group-hover:text-slate-200"
        }`}
      />
      {!compact && <span>{label}</span>}
    </Link>
  );
}

export function Nav({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-800 lg:bg-sidebar">
        <div className="flex h-full flex-col px-4 py-6">
          <Link href="/" className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Sparkles className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-white">
                Vendor Tracker
              </p>
              <p className="text-xs text-slate-400">Pokemon cards</p>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <NavLink
                  key={link.href}
                  {...link}
                  active={active}
                />
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-slate-700/80 bg-slate-800/50 px-3 py-3">
            <p className="text-xs font-medium text-slate-300">
              Michael & Dillon
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {userEmail ?? "Local development · 50/50"}
            </p>
            {userEmail ? (
              <form action={signOut} className="mt-3">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-700 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Sparkles className="h-4 w-4 text-amber-200" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Vendor Tracker</p>
            <p className="truncate text-xs text-muted">
              {userEmail ?? "Pokemon cards"}
            </p>
          </div>
          {userEmail ? (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          ) : null}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-none">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 text-muted hover:bg-slate-200 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}

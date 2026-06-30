import Link from "next/link";
import { branding } from "@studyhub/config";
import { apiGet, type AuthMe } from "../../lib/api";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Courses", "/courses"],
  ["Materials", "/materials"],
  ["Notes", "/notes"],
  ["Favorites", "/favorites"],
  ["Profile", "/profile"]
] as const;

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const me = await apiGet<AuthMe>("/api/auth/me");
  const adminNavigation =
    me.user.role === "SYSTEM_ADMIN" ? ([["Administration", "/admin/courses"]] as const) : [];
  const visibleNavigation = [...navigation, ...adminNavigation];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-950">
            {branding.productName}
          </Link>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
            {visibleNavigation.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {label}
              </Link>
            ))}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

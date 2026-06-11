/* Design: Institutional Clarity — Deep navy sidebar (#1E3A5F), white content, sky-blue accents */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  CalendarDays,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { t, lang, setLang } = useI18n();

  const NAV_ITEMS = [
    { label: t("dashboard"), href: "/", icon: BarChart3 },
    { label: t("schoolYears"), href: "/school-years", icon: CalendarDays },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-200 ease-in-out",
          "lg:relative lg:translate-x-0",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "#1E3A5F" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight truncate">{t("appTitle")}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 transition-all duration-150",
                    "text-sm font-semibold",
                    active
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Language toggle */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-white/10">
            <button
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-2 text-blue-200 hover:text-white text-xs font-semibold transition-colors w-full"
            >
              <Languages className="w-4 h-4 shrink-0" />
              <span>{lang === "en" ? "繁體中文" : "English"}</span>
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center w-full py-3 border-t border-white/10 text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3 no-print sticky top-0 z-20">
          <button
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-slate-800 font-bold text-base truncate">{t("appTitle")}</h1>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded border border-slate-200 hover:border-blue-300 no-print"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === "en" ? "中文" : "EN"}
          </button>
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            {new Date().toLocaleDateString(lang === "zh" ? "zh-HK" : "en-HK", { year: "numeric", month: "short", day: "numeric" })}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

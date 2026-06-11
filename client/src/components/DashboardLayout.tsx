/*
 * Design: Institutional Clarity — dark navy sidebar (#1a2035)
 * Reference: https://stephenhome07.github.io/class-quiz/PhysicsQuiz.html
 * Nav structure matches reference site tabs:
 *   Dashboard | School Years | Settings | (contextual: Subjects, Classes, Students, Assessments, Grading, Analysis)
 * - Active tab: blue-500 highlight
 * - No nested <a> tags — Link used directly
 * - Language toggle at bottom
 * - Version shown in logo area
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  CalendarDays,
  BarChart3,
  Menu,
  X,
  Languages,
  Settings2,
  BookOpen,
  Users,
  ClipboardList,
  TrendingUp,
  FileText,
  PenLine,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

const APP_VERSION = "v1.0.0";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { t, lang, setLang } = useI18n();

  // Parse current URL to extract hierarchy context
  const yearMatch = location.match(/\/school-years\/([^/]+)/);
  const subjectMatch = location.match(/\/subjects\/([^/]+)/);
  const classMatch = location.match(/\/classes\/([^/]+)/);
  const assessmentMatch = location.match(/\/assessments\/([^/]+)/);

  const yearId = yearMatch?.[1];
  const subjectId = subjectMatch?.[1];
  const classId = classMatch?.[1];
  const assessmentId = assessmentMatch?.[1];

  // Build contextual nav items based on current hierarchy depth
  const contextualItems = [];
  if (yearId && subjectId && classId && assessmentId) {
    contextualItems.push(
      { label: lang === "en" ? "Mark Sheet" : "評分表", href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/marksheet`, icon: FileText },
      { label: lang === "en" ? "Enter Scores" : "輸入成績", href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/grading`, icon: PenLine },
      { label: lang === "en" ? "Results" : "成績", href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/results`, icon: BarChart3 },
    );
  } else if (yearId && subjectId && classId) {
    contextualItems.push(
      { label: t("students"), href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/students`, icon: Users },
      { label: t("assessments"), href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments`, icon: ClipboardList },
      { label: lang === "en" ? "Analysis" : "分析", href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/analysis`, icon: TrendingUp },
    );
  } else if (yearId && subjectId) {
    contextualItems.push(
      { label: t("classes"), href: `/school-years/${yearId}/subjects/${subjectId}/classes`, icon: BookOpen },
      { label: t("topics"), href: `/school-years/${yearId}/subjects/${subjectId}/topics`, icon: Tag },
    );
  } else if (yearId) {
    contextualItems.push(
      { label: t("subjects"), href: `/school-years/${yearId}/subjects`, icon: BookOpen },
    );
  }

  const NAV_SECTIONS = [
    {
      label: null,
      items: [
        { label: t("dashboard"), href: "/", icon: BarChart3 },
      ],
    },
    {
      label: lang === "en" ? "Administration" : "管理",
      items: [
        { label: t("schoolYears"), href: "/school-years", icon: CalendarDays },
        { label: t("settings"), href: "/settings", icon: Settings2 },
      ],
    },
    ...(contextualItems.length > 0 ? [{
      label: lang === "en" ? "Current Context" : "目前位置",
      items: contextualItems,
    }] : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: "#1a2035" }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight truncate">{t("appTitle")}</p>
            <p className="text-blue-300 text-xs mt-0.5 opacity-80">{APP_VERSION}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-4">
            {section.label && (
              <p className="px-4 mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-300/50">
                {section.label}
              </p>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 transition-all duration-150",
                    "text-sm font-semibold cursor-pointer",
                    active
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Navigation hint */}
      <div className="px-4 py-2 border-t border-white/10">
        <p className="text-[10px] text-blue-300/40 leading-relaxed">
          {lang === "en"
            ? "School Years → Subject → Class → Assessment"
            : "學年 → 科目 → 班別 → 評估"}
        </p>
      </div>

      {/* Language toggle */}
      <div className="px-4 py-3 border-t border-white/10">
        <button
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className="flex items-center gap-2 text-blue-200 hover:text-white text-xs font-semibold transition-colors w-full px-2 py-2 rounded-lg hover:bg-white/10"
        >
          <Languages className="w-4 h-4 shrink-0" />
          <span>{lang === "en" ? "繁體中文" : "English"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-40 w-56 flex flex-col transition-transform duration-200",
          "lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — mobile only */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 lg:hidden sticky top-0 z-20">
          <button
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <p className="text-slate-800 font-bold text-sm flex-1 truncate">{t("appTitle")}</p>
          <button
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded border border-slate-200"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === "en" ? "中文" : "EN"}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

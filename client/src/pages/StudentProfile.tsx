/*
 * Student Profile Page — Individual student performance report
 * Sections: Overview | Assessment History | Topic Analysis | Print PDF
 * Design: Institutional Clarity
 * Print: Only the profile content area is printed (sidebar, nav, breadcrumb excluded)
 */
import { useParams, useLocation } from "wouter";
import { useRef } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { ScoreEntry } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { cn } from "@/lib/utils";

export default function StudentProfile() {
  const { yearId, subjectId, classId, studentId } = useParams<{
    yearId: string; subjectId: string; classId: string; studentId: string;
  }>();
  const { getSchoolYear, getSubject, getClass, getGlobalSubject, getNature } = useData();
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);

  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);
  const globalSubject = getGlobalSubject(subjectId);
  const student = cls?.students.find(s => s.id === studentId);

  if (!year || !subject || !cls || !student) {
    return <div className="text-slate-400 text-sm p-4">{t("noData")}</div>;
  }

  const subjectName = lang === "zh" ? subject.nameCht : subject.name;
  const displayName = lang === "zh" && student.nameCht ? student.nameCht : student.name;
  const topics = globalSubject?.topics ?? [];
  const assessments = cls.assessments ?? [];

  // Helper: get score total for a student in an assessment
  const getScoreTotal = (assessment: typeof assessments[0], sid: string) => {
    const entry = assessment.scores.find((s: ScoreEntry) => s.studentId === sid);
    if (!entry) return null;
    if (Array.isArray(entry.scores)) {
      return (entry.scores as Array<{ itemId: string; score: number | null }>).reduce((s, e) => s + (e.score ?? 0), 0);
    }
    return Object.values(entry.scores as Record<string, number | null>).reduce((s: number, v) => s + (v ?? 0), 0);
  };

  const getScoreMap = (assessment: typeof assessments[0], sid: string): Record<string, number> => {
    const entry = assessment.scores.find((s: ScoreEntry) => s.studentId === sid);
    if (!entry) return {};
    const map: Record<string, number> = {};
    if (Array.isArray(entry.scores)) {
      (entry.scores as Array<{ itemId: string; score: number | null }>).forEach(s => { map[s.itemId] = s.score ?? 0; });
    } else {
      Object.entries(entry.scores as Record<string, number | null>).forEach(([k, v]) => { map[k] = v ?? 0; });
    }
    return map;
  };

  const getAssessmentMax = (assessment: typeof assessments[0]) =>
    assessment.markSheet.filter(i => !i.isSection).reduce((s, i) => s + (i.maxMark || 0), 0);

  // Assessment history
  const assessmentHistory = assessments.map(a => {
    const total = getScoreTotal(a, studentId);
    const max = getAssessmentMax(a);
    const pct = max > 0 && total !== null ? Math.round((total / max) * 100) : null;
    const nature = getNature(a.natureId ?? "");
    const classTotals = cls.students
      .map(s => getScoreTotal(a, s.id))
      .filter(v => v !== null) as number[];
    classTotals.sort((a, b) => b - a);
    const rank = total !== null ? classTotals.indexOf(total) + 1 : null;
    return {
      id: a.id,
      title: lang === "zh" && a.titleCht ? a.titleCht : a.title,
      code: a.code,
      date: a.date,
      nature: nature ? (lang === "zh" && nature.nameCht ? nature.nameCht : nature.name) : "",
      isExam: nature?.isExam ?? false,
      total,
      max,
      pct,
      rank,
      classSize: classTotals.length,
    };
  });

  // Topic analysis
  const topicAnalysis = topics.map(topic => {
    let earned = 0, max = 0;
    assessments.forEach(a => {
      const items = a.markSheet.filter(i => !i.isSection && i.topicId === topic.id);
      if (items.length === 0) return;
      const scoreMap = getScoreMap(a, studentId);
      items.forEach(item => {
        earned += scoreMap[item.id] ?? 0;
        max += item.maxMark || 0;
      });
    });
    const pct = max > 0 ? Math.round((earned / max) * 100) : null;
    return {
      id: topic.id,
      name: lang === "zh" && topic.nameCht ? topic.nameCht : topic.name,
      code: topic.code,
      pct,
      earned,
      max,
      status: pct === null ? "none" : pct >= 70 ? "strong" : pct >= 50 ? "average" : "weak",
    };
  });

  // Overall stats
  const gradedAssessments = assessmentHistory.filter(a => a.pct !== null);
  const caHistory = gradedAssessments.filter(a => !a.isExam);
  const examHistory = gradedAssessments.filter(a => a.isExam);
  const avgPct = gradedAssessments.length > 0
    ? Math.round(gradedAssessments.reduce((s, a) => s + (a.pct ?? 0), 0) / gradedAssessments.length)
    : null;

  // Trend
  const trendIcon = caHistory.length >= 2
    ? (caHistory[caHistory.length - 1].pct! > caHistory[caHistory.length - 2].pct!
      ? <TrendingUp className="w-4 h-4 text-green-500" />
      : caHistory[caHistory.length - 1].pct! < caHistory[caHistory.length - 2].pct!
      ? <TrendingDown className="w-4 h-4 text-red-500" />
      : <Minus className="w-4 h-4 text-slate-400" />)
    : null;

  const handlePrint = () => {
    window.print();
  };

  const colorForPct = (pct: number | null) =>
    pct === null ? "#94a3b8" : pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  const today = new Date().toLocaleDateString(lang === "zh" ? "zh-HK" : "en-GB", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <>
      {/* ── Print CSS: only show #student-profile-print, hide everything else ── */}
      <style>{`
        @media print {
          /* Hide everything on the page */
          body > * { display: none !important; }
          /* Show only the print portal */
          #student-profile-print-portal { display: block !important; position: fixed; inset: 0; background: white; z-index: 99999; }
          /* Reset print margins */
          @page { margin: 15mm 12mm; size: A4; }
          /* Print-specific typography */
          #student-profile-print-portal * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Allow page breaks between sections */
          .print-section { page-break-inside: avoid; break-inside: avoid; }
          .print-allow-break { page-break-inside: auto; break-inside: auto; }
        }
        @media screen {
          #student-profile-print-portal { display: none; }
        }
      `}</style>

      {/* ── Print-only portal (hidden on screen, shown when printing) ── */}
      <div id="student-profile-print-portal">
        <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: "11px", color: "#1e293b", lineHeight: "1.5" }}>

          {/* Report Header */}
          <div className="print-section" style={{ borderBottom: "2px solid #1e40af", paddingBottom: "10px", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "18px", fontWeight: "800", color: "#1e40af", margin: "0 0 3px 0" }}>
                  {lang === "zh" ? "學生成績報告" : "Student Performance Report"}
                </h1>
                <p style={{ margin: "0", color: "#64748b", fontSize: "10px" }}>
                  {lang === "zh" ? "生成日期" : "Generated"}: {today}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0", fontWeight: "700", fontSize: "13px" }}>{displayName}</p>
                <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>
                  {t("classNo")}: {student.classNo} · {cls.name} · {subjectName} · {year.label}
                </p>
              </div>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="print-section" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "14px" }}>
            {[
              { label: lang === "zh" ? "整體平均" : "Overall Avg", value: avgPct !== null ? `${avgPct}%` : "—", color: avgPct !== null ? (avgPct >= 70 ? "#16a34a" : avgPct >= 50 ? "#d97706" : "#dc2626") : "#94a3b8" },
              { label: lang === "zh" ? "持續評估" : "CA Assessments", value: String(caHistory.length), color: "#2563eb" },
              { label: lang === "zh" ? "考試" : "Exams", value: String(examHistory.length), color: "#7c3aed" },
              { label: lang === "zh" ? "強項課題" : "Strong Topics", value: String(topicAnalysis.filter(t => t.status === "strong").length), color: "#16a34a" },
            ].map((stat, i) => (
              <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px", textAlign: "center", background: "#f8fafc" }}>
                <p style={{ margin: "0 0 3px 0", fontSize: "9px", color: "#64748b" }}>{stat.label}</p>
                <p style={{ margin: "0", fontSize: "20px", fontWeight: "800", color: stat.color, fontFamily: "monospace" }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Assessment History Table */}
          <div className="print-section" style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", margin: "0 0 6px 0", borderLeft: "3px solid #1e40af", paddingLeft: "8px" }}>
              {lang === "zh" ? "評估歷史" : "Assessment History"}
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ background: "#1e40af", color: "white" }}>
                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: "600" }}>{lang === "zh" ? "評估名稱" : "Assessment"}</th>
                  <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>{lang === "zh" ? "類型" : "Type"}</th>
                  <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>{lang === "zh" ? "日期" : "Date"}</th>
                  <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>{lang === "zh" ? "分數" : "Score"}</th>
                  <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>%</th>
                  <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>{lang === "zh" ? "班級排名" : "Rank"}</th>
                </tr>
              </thead>
              <tbody>
                {assessmentHistory.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "10px", textAlign: "center", color: "#94a3b8" }}>—</td></tr>
                ) : assessmentHistory.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "5px 8px", fontWeight: "600" }}>
                      {a.title}{a.code ? ` (${a.code})` : ""}
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "center" }}>
                      <span style={{ background: a.isExam ? "#ede9fe" : "#dbeafe", color: a.isExam ? "#6d28d9" : "#1d4ed8", borderRadius: "3px", padding: "1px 5px", fontSize: "9px", fontWeight: "600" }}>
                        {a.nature || (a.isExam ? "Exam" : "CA")}
                      </span>
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "center", color: "#64748b" }}>{a.date || "—"}</td>
                    <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace" }}>
                      {a.total !== null ? `${a.total}/${a.max}` : "—"}
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: "700", fontFamily: "monospace", color: a.pct !== null ? colorForPct(a.pct) : "#94a3b8" }}>
                      {a.pct !== null ? `${a.pct}%` : "—"}
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace", color: "#64748b" }}>
                      {a.rank !== null ? `${a.rank}/${a.classSize}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Topic Analysis Table */}
          {topics.length > 0 && (
            <div className="print-allow-break" style={{ marginBottom: "14px" }}>
              <h2 style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", margin: "0 0 6px 0", borderLeft: "3px solid #1e40af", paddingLeft: "8px" }}>
                {lang === "zh" ? "課題分析" : "Topic Analysis"}
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                <thead>
                  <tr style={{ background: "#1e40af", color: "white" }}>
                    <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: "600" }}>{lang === "zh" ? "課題" : "Topic"}</th>
                    <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>{lang === "zh" ? "得分" : "Score"}</th>
                    <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>%</th>
                    <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: "600" }}>{lang === "zh" ? "水平" : "Level"}</th>
                    <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: "600", width: "30%" }}>{lang === "zh" ? "進度條" : "Progress"}</th>
                  </tr>
                </thead>
                <tbody>
                  {topicAnalysis.filter(t => t.max > 0).map((topic, i) => (
                    <tr key={topic.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "5px 8px" }}>
                        {topic.code && <span style={{ fontFamily: "monospace", color: "#94a3b8", marginRight: "4px", fontSize: "9px" }}>{topic.code}</span>}
                        <span style={{ fontWeight: "600" }}>{topic.name}</span>
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace" }}>
                        {topic.max > 0 ? `${topic.earned}/${topic.max}` : "—"}
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: "700", fontFamily: "monospace", color: colorForPct(topic.pct) }}>
                        {topic.pct !== null ? `${topic.pct}%` : "—"}
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        {topic.pct !== null ? (
                          <span style={{
                            background: topic.status === "strong" ? "#dcfce7" : topic.status === "average" ? "#fef9c3" : "#fee2e2",
                            color: topic.status === "strong" ? "#16a34a" : topic.status === "average" ? "#b45309" : "#dc2626",
                            borderRadius: "3px", padding: "1px 5px", fontSize: "9px", fontWeight: "700"
                          }}>
                            {topic.status === "strong" ? (lang === "zh" ? "強" : "Strong") : topic.status === "average" ? (lang === "zh" ? "中" : "Average") : (lang === "zh" ? "弱" : "Weak")}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "5px 8px" }}>
                        {topic.pct !== null && (
                          <div style={{ background: "#e2e8f0", borderRadius: "3px", height: "8px", overflow: "hidden" }}>
                            <div style={{ background: colorForPct(topic.pct), height: "100%", width: `${topic.pct}%`, borderRadius: "3px" }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="print-section" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#94a3b8" }}>
            <span>{subjectName} · {cls.name} · {year.label}</span>
            <span>{lang === "zh" ? "由 Maths Analytics 生成" : "Generated by Maths Analytics"}</span>
          </div>
        </div>
      </div>

      {/* ── Screen view (normal UI) ── */}
      <div className="space-y-4 animate-in fade-in duration-300">
        <HierarchyBreadcrumb items={[
          { label: t("schoolYears"), href: "/school-years" },
          { label: year.label, href: `/school-years/${yearId}/subjects` },
          { label: subjectName, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
          { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
          { label: displayName },
          { label: t("studentProfile") },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1 as any)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-bold text-slate-800">{displayName}</h2>
              {trendIcon}
            </div>
            <p className="text-sm text-slate-500 mt-0.5 ml-7">
              {t("classNo")}: {student.classNo} · {subjectName} · {cls.name} · {year.label}
            </p>
          </div>
          <Button onClick={handlePrint} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4" /> {lang === "zh" ? "下載 PDF 報告" : "Download PDF Report"}
          </Button>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{t("overallAvg")}</p>
            <p className={cn("text-3xl font-bold font-mono", avgPct !== null ? (avgPct >= 70 ? "text-green-600" : avgPct >= 50 ? "text-amber-600" : "text-red-600") : "text-slate-300")}>
              {avgPct !== null ? `${avgPct}%` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{t("caAssessments")}</p>
            <p className="text-3xl font-bold font-mono text-blue-600">{caHistory.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{t("examAssessments")}</p>
            <p className="text-3xl font-bold font-mono text-purple-600">{examHistory.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{t("strongTopics")}</p>
            <p className="text-3xl font-bold font-mono text-green-600">
              {topicAnalysis.filter(t => t.status === "strong").length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Assessment history */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-700">{t("assessmentHistory")}</p>
            </div>
            {gradedAssessments.length > 0 && (
              <div className="p-3">
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={gradedAssessments} margin={{ top: 5, right: 5, left: -20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="code" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`]} />
                    <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                      {gradedAssessments.map((entry, i) => (
                        <Cell key={i} fill={colorForPct(entry.pct)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-3 py-1.5 text-xs font-bold text-slate-500">{t("assessment")}</th>
                    <th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("score")}</th>
                    <th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">%</th>
                    <th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("rank")}</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentHistory.map(a => (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5">
                        <div>
                          <span className="font-semibold text-slate-800 text-xs">{a.title}</span>
                          {a.code && <span className="text-slate-400 text-xs ml-1">({a.code})</span>}
                        </div>
                        {a.nature && (
                          <Badge variant="secondary" className={cn("text-[10px] h-4 mt-0.5", a.isExam ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                            {a.nature}
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-slate-700">
                        {a.total !== null ? `${a.total}/${a.max}` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {a.pct !== null ? (
                          <span className={cn("font-mono font-bold", a.pct >= 70 ? "text-green-600" : a.pct >= 50 ? "text-amber-600" : "text-red-600")}>
                            {a.pct}%
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-slate-500 text-xs">
                        {a.rank !== null ? `${a.rank}/${a.classSize}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Topic analysis */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-700">{t("topicAnalysis")}</p>
            </div>
            {topics.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">{t("noTopicsYet")}</div>
            ) : (
              <>
                {topicAnalysis.filter(t => t.pct !== null).length >= 3 && (
                  <div className="p-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <RadarChart data={topicAnalysis.filter(t => t.pct !== null)}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                        <Radar dataKey="pct" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="text-left px-3 py-1.5 text-xs font-bold text-slate-500">{t("topic")}</th>
                        <th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("score")}</th>
                        <th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topicAnalysis.map(topic => (
                        <tr key={topic.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-1.5">
                            {topic.code && <span className="text-xs font-mono text-slate-400 mr-1">{topic.code}</span>}
                            <span className="font-semibold text-slate-800 text-xs">{topic.name}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono text-slate-700 text-xs">
                            {topic.max > 0 ? `${topic.earned}/${topic.max}` : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {topic.pct !== null ? (
                              <span className={cn(
                                "text-xs font-bold",
                                topic.status === "strong" ? "text-green-600" : topic.status === "average" ? "text-amber-600" : "text-red-600"
                              )}>
                                {topic.pct}% · {topic.status === "strong" ? t("strong") : topic.status === "average" ? t("average") : t("weak")}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/*
 * Student Profile Page — Individual student performance report
 * Sections: Overview | Assessment History | Topic Analysis | Print (1-page PDF)
 * Design: Institutional Clarity
 */
import { useParams, useLocation } from "wouter";
import { useRef } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
    // Class rank
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

  // Trend: compare last 2 assessments
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

  return (
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
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5 print:hidden">
          <Printer className="w-4 h-4" /> {t("printProfile")}
        </Button>
      </div>

      {/* Print-friendly profile */}
      <div ref={printRef} className="space-y-4 print:space-y-3">

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
            {/* Bar chart */}
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
                {/* Radar chart */}
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

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #root > * { visibility: hidden; }
          [data-print-profile] { visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

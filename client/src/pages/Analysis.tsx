/*
 * Analysis Page — Class-wide topic strength/weakness analysis
 * Tabs: Topic Performance | CA vs Exam Summary | Question Analysis
 * Design: Institutional Clarity
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { ScoreEntry } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { cn } from "@/lib/utils";

export default function Analysis() {
  const { yearId, subjectId, classId } = useParams<{ yearId: string; subjectId: string; classId: string }>();
  const { getSchoolYear, getSubject, getClass, getGlobalSubject, getNature } = useData();
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();

  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);
  const globalSubject = getGlobalSubject(subjectId);

  if (!year || !subject || !cls) {
    return <div className="text-slate-400 text-sm p-4">{t("noData")}</div>;
  }

  const subjectName = lang === "zh" ? subject.nameCht : subject.name;
  const topics = globalSubject?.topics ?? [];
  const assessments = cls.assessments ?? [];
  const students = cls.students ?? [];

  // ── Topic performance analysis ──
  const topicData = topics.map(topic => {
    let totalEarned = 0;
    let totalMax = 0;
    assessments.forEach(assessment => {
      const topicItems = assessment.markSheet.filter(i => !i.isSection && i.topicId === topic.id);
      if (topicItems.length === 0) return;
      const topicMax = topicItems.reduce((s, i) => s + (i.maxMark || 0), 0);
      assessment.scores.forEach((scoreEntry: ScoreEntry) => {
        const scoreMap: Record<string, number> = {};
        if (Array.isArray(scoreEntry.scores)) {
          (scoreEntry.scores as Array<{ itemId: string; score: number | null }>).forEach(s => {
            scoreMap[s.itemId] = s.score ?? 0;
          });
        } else {
          Object.entries(scoreEntry.scores as Record<string, number | null>).forEach(([k, v]) => {
            scoreMap[k] = v ?? 0;
          });
        }
        topicItems.forEach(item => {
          totalEarned += scoreMap[item.id] ?? 0;
          totalMax += item.maxMark || 0;
        });
      });
    });
    const pct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : null;
    return {
      id: topic.id,
      name: lang === "zh" && topic.nameCht ? topic.nameCht : topic.name,
      code: topic.code,
      pct,
      status: pct === null ? "none" : pct >= 70 ? "strong" : pct >= 50 ? "average" : "weak",
    };
  });

  // ── CA vs Exam summary ──
  const caAssessments = assessments.filter(a => {
    const nature = getNature(a.natureId ?? "");
    return nature && !nature.isExam;
  });
  const examAssessments = assessments.filter(a => {
    const nature = getNature(a.natureId ?? "");
    return nature && nature.isExam;
  });

  const getStudentTotal = (assessment: typeof assessments[0], studentId: string) => {
    const entry = assessment.scores.find((s: ScoreEntry) => s.studentId === studentId);
    if (!entry) return null;
    if (Array.isArray(entry.scores)) {
      return (entry.scores as Array<{ itemId: string; score: number | null }>).reduce((s, e) => s + (e.score ?? 0), 0);
    }
    return Object.values(entry.scores as Record<string, number | null>).reduce((s: number, v) => s + (v ?? 0), 0);
  };

  const getAssessmentMax = (assessment: typeof assessments[0]) =>
    assessment.markSheet.filter(i => !i.isSection).reduce((s, i) => s + (i.maxMark || 0), 0);

  const studentSummary = students.map(student => {
    let caTotalEarned = 0;
    let caTotalMax = 0;
    caAssessments.forEach(a => {
      const t = getStudentTotal(a, student.id);
      if (t !== null) {
        caTotalEarned += t;
        caTotalMax += getAssessmentMax(a);
      }
    });
    let examTotalEarned = 0;
    let examTotalMax = 0;
    examAssessments.forEach(a => {
      const t = getStudentTotal(a, student.id);
      if (t !== null) {
        examTotalEarned += t;
        examTotalMax += getAssessmentMax(a);
      }
    });
    return {
      student,
      caPct: caTotalMax > 0 ? Math.round((caTotalEarned / caTotalMax) * 100) : null,
      examPct: examTotalMax > 0 ? Math.round((examTotalEarned / examTotalMax) * 100) : null,
      caTotalEarned,
      caTotalMax,
      examTotalEarned,
      examTotalMax,
    };
  }).sort((a, b) => {
    const aScore = (a.caPct ?? 0) + (a.examPct ?? 0);
    const bScore = (b.caPct ?? 0) + (b.examPct ?? 0);
    return bScore - aScore;
  });

  const colorForStatus = (status: string) =>
    status === "strong" ? "#22c55e" : status === "average" ? "#f59e0b" : status === "weak" ? "#ef4444" : "#94a3b8";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subjectName, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
        { label: t("classAnalysis") },
      ]} />

      <div>
        <h2 className="text-xl font-bold text-slate-800">{t("classAnalysis")}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subjectName} · {cls.name} · {students.length} {t("students")}</p>
      </div>

      <Tabs defaultValue="topics">
        <TabsList className="mb-4">
          <TabsTrigger value="topics">{t("topicPerformance")}</TabsTrigger>
          <TabsTrigger value="summary">{t("classSummary")}</TabsTrigger>
          <TabsTrigger value="questions">{t("questionAnalysis")}</TabsTrigger>
        </TabsList>

        {/* ── Topic performance tab ── */}
        <TabsContent value="topics">
          {topics.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-400 text-sm">{t("noTopicsYet")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate(`/school-years/${yearId}/subjects/${subjectId}/topics`)}
              >
                {t("addTopic")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bar chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3">{t("topicPerformance")} (%)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicData.filter(d => d.pct !== null)} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, t("classAverage")]} />
                    <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "70%", fontSize: 9, fill: "#22c55e" }} />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "50%", fontSize: 9, fill: "#f59e0b" }} />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                      {topicData.filter(d => d.pct !== null).map((entry, i) => (
                        <Cell key={i} fill={colorForStatus(entry.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Topic cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topicData.map(topic => (
                  <div key={topic.id} className={cn(
                    "bg-white rounded-xl border-2 p-4",
                    topic.status === "strong" ? "border-green-200"
                      : topic.status === "average" ? "border-amber-200"
                      : topic.status === "weak" ? "border-red-200"
                      : "border-slate-200"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {topic.code && <p className="text-xs font-mono text-slate-400">{topic.code}</p>}
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{topic.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {topic.pct !== null ? (
                          <>
                            <p className={cn(
                              "text-2xl font-bold font-mono",
                              topic.status === "strong" ? "text-green-600"
                                : topic.status === "average" ? "text-amber-600"
                                : "text-red-600"
                            )}>{topic.pct}%</p>
                            <p className={cn(
                              "text-xs font-semibold",
                              topic.status === "strong" ? "text-green-500"
                                : topic.status === "average" ? "text-amber-500"
                                : "text-red-500"
                            )}>
                              {topic.status === "strong" ? t("strong") : topic.status === "average" ? t("average") : t("weak")}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">{t("notSet")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── CA vs Exam summary tab ── */}
        <TabsContent value="summary">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">{t("studentName")}</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">{t("caAssessments")}</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">{t("examAssessments")}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSummary.map((row, i) => {
                    const displayName = lang === "zh" && row.student.nameCht ? row.student.nameCht : row.student.name;
                    return (
                      <tr key={row.student.id} className={cn("border-b border-slate-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                        <td className="px-3 py-2 text-xs font-mono text-slate-400">{row.student.classNo}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => navigate(`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/students/${row.student.id}/profile`)}
                            className="font-semibold text-slate-800 hover:text-blue-600 transition-colors text-left"
                          >
                            {displayName}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.caPct !== null ? (
                            <span className={cn(
                              "font-mono font-bold",
                              row.caPct >= 70 ? "text-green-600" : row.caPct >= 50 ? "text-amber-600" : "text-red-600"
                            )}>
                              {row.caTotalEarned}/{row.caTotalMax} ({row.caPct}%)
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.examPct !== null ? (
                            <span className={cn(
                              "font-mono font-bold",
                              row.examPct >= 70 ? "text-green-600" : row.examPct >= 50 ? "text-amber-600" : "text-red-600"
                            )}>
                              {row.examTotalEarned}/{row.examTotalMax} ({row.examPct}%)
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Question analysis tab ── */}
        <TabsContent value="questions">
          <div className="space-y-4">
            {assessments.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">{t("noAssessmentsYet")}</div>
            ) : (
              assessments.map(assessment => {
                const questions = assessment.markSheet.filter(i => !i.isSection);
                if (questions.length === 0) return null;
                const assessTitle = lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title;
                const qData = questions.map(q => {
                  const scores: number[] = [];
                  assessment.scores.forEach((entry: ScoreEntry) => {
                    let scoreMap: Record<string, number> = {};
                    if (Array.isArray(entry.scores)) {
                      (entry.scores as Array<{ itemId: string; score: number | null }>).forEach(s => { scoreMap[s.itemId] = s.score ?? 0; });
                    } else {
                      Object.entries(entry.scores as Record<string, number | null>).forEach(([k, v]) => { scoreMap[k] = v ?? 0; });
                    }
                    scores.push(scoreMap[q.id] ?? 0);
                  });
                  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                  const pct = q.maxMark > 0 ? Math.round((avg / q.maxMark) * 100) : 0;
                  return { label: q.label, avg: Math.round(avg * 10) / 10, maxMark: q.maxMark, pct };
                });
                return (
                  <div key={assessment.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <p className="text-sm font-bold text-slate-700">{assessTitle}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">{t("questionLabel")}</th>
                            <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">{t("maxMark")}</th>
                            <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">{t("avgMark")}</th>
                            <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qData.map((q, i) => (
                            <tr key={i} className={cn("border-b border-slate-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                              <td className="px-3 py-1.5 font-mono font-bold text-slate-700">{q.label}</td>
                              <td className="px-3 py-1.5 text-center font-mono text-slate-500">{q.maxMark}</td>
                              <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-800">{q.avg}</td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={cn(
                                  "font-mono font-bold",
                                  q.pct >= 70 ? "text-green-600" : q.pct >= 50 ? "text-amber-600" : "text-red-600"
                                )}>{q.pct}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

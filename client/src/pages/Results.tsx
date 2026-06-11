import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Download, ClipboardList, BarChart3, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { ScoreEntry } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { totalMaxMarks } from "@/lib/markSheetParser";
import { buildMarkSheetCSV, downloadCSV, buildExportFilename } from "@/lib/exportUtils";
import { toast } from "sonner";

export default function Results() {
  const { yearId, subjectId, classId, assessmentId } = useParams<{
    yearId: string; subjectId: string; classId: string; assessmentId: string;
  }>();
  const { getSchoolYear, getSubject, getClass, getAssessment } = useData();
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);

  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);
  const assessment = getAssessment(yearId, subjectId, classId, assessmentId);

  if (!year || !subject || !cls || !assessment) {
    return <div className="text-slate-400 text-sm">{t("noData")}</div>;
  }

  const markSheet = assessment.markSheet;
  const questions = markSheet.filter(i => !i.isSection);
  const maxTotal = totalMaxMarks(markSheet);

  const sortedStudents = [...cls.students].sort((a, b) =>
    a.classNo.localeCompare(b.classNo, undefined, { numeric: true })
  );

  const getScore = (studentId: string, itemId: string): number | null => {
    const entry = assessment.scores.find((s: ScoreEntry) => s.studentId === studentId);
    if (!entry) return null;
    const v = entry.scores[itemId];
    return v ?? null;
  };

  const getStudentTotal = (studentId: string): number | null => {
    const entry = assessment.scores.find((s: ScoreEntry) => s.studentId === studentId);
    if (!entry) return null;
    return Object.values(entry.scores).reduce((sum: number, v) => sum + (v ?? 0), 0);
  };

  const gradedStudents = sortedStudents.filter(s => assessment.scores.some((e: ScoreEntry) => e.studentId === s.id));
  const totals = gradedStudents.map(s => getStudentTotal(s.id) ?? 0);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const high = totals.length ? Math.max(...totals) : 0;
  const low = totals.length ? Math.min(...totals) : 0;

  // Per-question averages
  const qStats = questions.map(q => {
    const scores = gradedStudents.map(s => getScore(s.id, q.id)).filter(v => v !== null) as number[];
    const qAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...q, avg: qAvg, scores };
  });

  const handleExportCSV = () => {
    const csv = buildMarkSheetCSV(assessment, cls.students);
    downloadCSV(csv, `${cls.name}_${assessment.title}.csv`);
    toast.success(t("exportCSV"));
  };

  const handleCopyCSV = () => {
    const csv = buildMarkSheetCSV(assessment, cls.students);
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subject.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
        { label: assessment.title },
        { label: t("results") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("classResults")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{assessment.title} · {cls.name} · {gradedStudents.length}/{sortedStudents.length} graded</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/grading`)} className="gap-1.5">
            <ClipboardList className="w-4 h-4" /> {t("enterScores")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyCSV} className="gap-1.5">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {t("copyToClipboard")}
          </Button>
          <Button size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-4 h-4" /> {t("exportCSV")}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("avgScore"), value: avg.toFixed(1), sub: `/ ${maxTotal}` },
          { label: t("highScore"), value: high, sub: `/ ${maxTotal}` },
          { label: t("lowScore"), value: low, sub: `/ ${maxTotal}` },
          { label: t("gradedCount"), value: gradedStudents.length, sub: `/ ${sortedStudents.length}` },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold font-mono text-slate-800">
              {stat.value}
              <span className="text-sm text-slate-400 ml-1">{stat.sub}</span>
            </p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">{t("classSummary")}</TabsTrigger>
          <TabsTrigger value="questions"><BarChart3 className="w-3.5 h-3.5 mr-1" />{t("questionAnalysis")}</TabsTrigger>
          <TabsTrigger value="export">{t("googleSheetsExport")}</TabsTrigger>
        </TabsList>

        {/* ── Class summary table ── */}
        <TabsContent value="table">
          <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
            <table className="w-full text-xs mark-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left w-10 sticky left-0 bg-slate-50">#</th>
                  <th className="px-3 py-2 text-left sticky left-10 bg-slate-50 min-w-[120px]">{t("studentName")}</th>
                  {questions.map(q => (
                    <th key={q.id} className="px-2 py-2 text-center min-w-[52px] font-mono">
                      <div>{q.label}</div>
                      <div className="text-slate-400 font-normal">/{q.maxMark}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-bold min-w-[60px]">{t("total")}</th>
                  <th className="px-3 py-2 text-center min-w-[60px]">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => {
                  const total = getStudentTotal(student.id);
                  const isGraded = total !== null;
                  const pct = isGraded && maxTotal > 0 ? Math.round((total / maxTotal) * 100) : null;
                  return (
                    <tr key={student.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                      <td className="px-3 py-2 font-mono text-slate-400 sticky left-0 bg-inherit">{student.classNo}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 sticky left-10 bg-inherit">{student.name}</td>
                      {questions.map(q => {
                        const score = getScore(student.id, q.id);
                        return (
                          <td key={q.id} className={`px-2 py-2 text-center font-mono ${score === null ? "text-slate-300" : score < q.maxMark * 0.5 ? "text-red-600" : "text-slate-700"}`}>
                            {score === null ? "—" : score}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-2 text-center font-bold font-mono ${!isGraded ? "text-slate-300" : ""}`}>
                        {isGraded ? total : "—"}
                      </td>
                      <td className={`px-3 py-2 text-center font-mono text-xs ${pct === null ? "text-slate-300" : pct >= 50 ? "text-emerald-600" : "text-red-500"}`}>
                        {pct === null ? "—" : `${pct}%`}
                      </td>
                    </tr>
                  );
                })}
                {/* Average row */}
                {gradedStudents.length > 0 && (
                  <tr className="border-t-2 border-slate-300 bg-blue-50">
                    <td colSpan={2} className="px-3 py-2 font-bold text-slate-600 text-xs uppercase tracking-wide">{t("avgScore")}</td>
                    {questions.map(q => {
                      const stat = qStats.find(s => s.id === q.id);
                      return (
                        <td key={q.id} className="px-2 py-2 text-center font-mono text-blue-700 font-semibold">
                          {stat ? stat.avg.toFixed(1) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold font-mono text-blue-700">{avg.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center font-mono text-blue-700 text-xs">
                      {maxTotal > 0 ? `${Math.round((avg / maxTotal) * 100)}%` : "—"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Question analysis ── */}
        <TabsContent value="questions">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm mark-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 text-left">{t("questionLabel")}</th>
                  <th className="px-4 py-2 text-center">{t("maxMark")}</th>
                  <th className="px-4 py-2 text-center">{t("avgMark")}</th>
                  <th className="px-4 py-2 text-center">%</th>
                  <th className="px-4 py-2 text-left">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {qStats.map((q, idx) => {
                  const pct = q.maxMark > 0 ? (q.avg / q.maxMark) * 100 : 0;
                  return (
                    <tr key={q.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{q.label}</td>
                      <td className="px-4 py-2.5 text-center font-mono text-slate-500">{q.maxMark}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-800">{q.avg.toFixed(1)}</td>
                      <td className={`px-4 py-2.5 text-center font-mono text-sm ${pct >= 70 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                        {pct.toFixed(0)}%
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Google Sheets export ── */}
        <TabsContent value="export">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg space-y-4">
            <h3 className="font-bold text-slate-800">{t("googleSheetsExport")}</h3>
            <p className="text-sm text-slate-600">{t("googleSheetsDesc")}</p>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
                <span>Click <strong>Download CSV</strong> below to save the mark sheet as a CSV file.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
                <span>Open <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Sheets</a> and create a new spreadsheet.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
                <span>Go to <strong>File → Import → Upload</strong> and select the downloaded CSV file.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">4</span>
                <span>Alternatively, use <strong>Copy to Clipboard</strong> and paste directly into a Google Sheet cell.</span>
              </li>
            </ol>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleExportCSV} className="gap-1.5">
                <Download className="w-4 h-4" /> {t("exportCSV")}
              </Button>
              <Button variant="outline" onClick={handleCopyCSV} className="gap-1.5">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {t("copyToClipboard")}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

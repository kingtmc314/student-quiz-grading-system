/*
 * Grading Page — Reference-style split panel
 * Left: student list with running score + graded indicator
 * Right: per-question score entry card grid, grouped by section, auto-save on blur
 * Design: Institutional Clarity
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, BarChart3, Trash2, Save, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { ScoreEntry } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { totalMaxMarks } from "@/lib/markSheetParser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Grading() {
  const { yearId, subjectId, classId, assessmentId } = useParams<{
    yearId: string; subjectId: string; classId: string; assessmentId: string;
  }>();
  const { getSchoolYear, getSubject, getClass, getAssessment, upsertScore, deleteScore } = useData();
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();

  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);
  const assessment = getAssessment(yearId, subjectId, classId, assessmentId);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, number | "">>({});
  const [dirty, setDirty] = useState(false);

  const sortedStudents = cls
    ? [...cls.students].sort((a, b) => a.classNo.localeCompare(b.classNo, undefined, { numeric: true }))
    : [];

  const selectedStudent = sortedStudents.find(s => s.id === selectedStudentId) ?? null;

  // Load existing scores into draft when student changes
  useEffect(() => {
    if (!assessment || !selectedStudentId) return;
    const existing = assessment.scores.find((s: ScoreEntry) => s.studentId === selectedStudentId);
    if (existing) {
      const map: Record<string, number | ""> = {};
      // Support both array and object score formats
      if (Array.isArray(existing.scores)) {
        (existing.scores as Array<{ itemId: string; score: number | null }>).forEach(s => {
          map[s.itemId] = s.score ?? "";
        });
      } else {
        Object.entries(existing.scores as Record<string, number | null>).forEach(([itemId, score]) => {
          map[itemId] = score ?? "";
        });
      }
      setDraftScores(map);
    } else {
      setDraftScores({});
    }
    setDirty(false);
  }, [selectedStudentId, assessment?.id]);

  if (!year || !subject || !cls || !assessment) {
    return <div className="text-slate-400 text-sm">{t("noData")}</div>;
  }

  const markSheet = assessment.markSheet;
  const questions = markSheet.filter(i => !i.isSection);
  const maxTotal = totalMaxMarks(markSheet);

  const currentTotal = questions.reduce((s, q) => {
    const v = draftScores[q.id];
    return s + (typeof v === "number" ? v : 0);
  }, 0);

  const handleScoreChange = (itemId: string, raw: string) => {
    const val = raw === "" ? "" : parseFloat(raw);
    setDraftScores(prev => ({ ...prev, [itemId]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!selectedStudentId) return;
    const scoreArr = questions.map(q => ({
      itemId: q.id,
      score: typeof draftScores[q.id] === "number" ? (draftScores[q.id] as number) : 0,
    }));
    upsertScore(yearId, subjectId, classId, assessmentId, { studentId: selectedStudentId, scores: scoreArr as any });
    setDirty(false);
    toast.success(t("saved"));
  };

  const handleAutoSave = () => {
    if (dirty) handleSave();
  };

  const handleClear = () => {
    if (!selectedStudentId) return;
    deleteScore(yearId, subjectId, classId, assessmentId, selectedStudentId);
    setDraftScores({});
    setDirty(false);
    toast.success(t("deleted"));
  };

  const navigateStudent = (dir: -1 | 1) => {
    if (dirty) handleSave();
    if (!selectedStudentId) { setSelectedStudentId(sortedStudents[0]?.id ?? null); return; }
    const idx = sortedStudents.findIndex(s => s.id === selectedStudentId);
    const next = sortedStudents[idx + dir];
    if (next) setSelectedStudentId(next.id);
  };

  const getStudentTotal = (studentId: string) => {
    const sc = assessment.scores.find((s: ScoreEntry) => s.studentId === studentId);
    if (!sc) return null;
    if (Array.isArray(sc.scores)) {
      return (sc.scores as Array<{ itemId: string; score: number | null }>).reduce((sum, s) => sum + (s.score ?? 0), 0);
    }
    return Object.values(sc.scores as Record<string, number | null>).reduce((sum: number, v) => sum + (v ?? 0), 0);
  };

  const assessTitle = lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title;
  const subjectName = lang === "zh" ? subject.nameCht : subject.name;

  // Group mark sheet for card display
  const groups: Array<{ sectionLabel?: string; questions: typeof questions }> = [];
  let curGroup: { sectionLabel?: string; questions: typeof questions } = { questions: [] };
  markSheet.forEach(item => {
    if (item.isSection) {
      if (curGroup.questions.length > 0 || curGroup.sectionLabel) groups.push(curGroup);
      curGroup = { sectionLabel: item.label, questions: [] };
    } else {
      curGroup.questions.push(item);
    }
  });
  if (curGroup.questions.length > 0 || curGroup.sectionLabel) groups.push(curGroup);

  const selectedIdx = sortedStudents.findIndex(s => s.id === selectedStudentId);

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subjectName, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
        { label: assessTitle },
        { label: t("enterScores") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("enterScores")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{assessTitle} · {cls.name} · {t("total")}: {maxTotal}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/results`)}
          className="gap-1.5"
        >
          <BarChart3 className="w-4 h-4" /> {t("viewResults")}
        </Button>
      </div>

      {markSheet.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-700 text-sm">
          ⚠ {lang === "en" ? "No mark sheet configured yet." : "尚未設定評分表。"}{" "}
          <button
            onClick={() => navigate(`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/marksheet`)}
            className="underline font-semibold hover:text-amber-900"
          >
            {t("editMarkSheet")}
          </button>
        </div>
      ) : (
        <div className="flex gap-3 h-[calc(100vh-220px)] min-h-[400px]">
          {/* ── Left: Student list ── */}
          <div className="w-52 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {t("students")} ({sortedStudents.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedStudents.map(student => {
                const total = getStudentTotal(student.id);
                const isSelected = selectedStudentId === student.id;
                const isGraded = total !== null;
                const displayName = lang === "zh" && student.nameCht ? student.nameCht : student.name;
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors",
                      isSelected ? "bg-blue-600 text-white" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isGraded
                          ? <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-blue-200" : "text-green-500")} />
                          : <Circle className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-blue-200" : "text-slate-300")} />
                        }
                        <span className={cn("text-xs font-mono shrink-0", isSelected ? "text-blue-200" : "text-slate-400")}>
                          {student.classNo}
                        </span>
                        <span className={cn("text-sm font-semibold truncate", isSelected ? "text-white" : "text-slate-800")}>
                          {displayName}
                        </span>
                      </div>
                      {isGraded && (
                        <span className={cn("text-xs font-mono font-bold shrink-0", isSelected ? "text-blue-100" : "text-blue-600")}>
                          {total}/{maxTotal}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Score entry ── */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
            {!selectedStudent ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                {t("selectStudentPrompt")}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateStudent(-1)}
                      disabled={selectedIdx <= 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <span className="font-mono text-xs text-slate-400">{selectedStudent.classNo}</span>
                      <span className="font-bold text-slate-800 ml-2">
                        {lang === "zh" && selectedStudent.nameCht ? selectedStudent.nameCht : selectedStudent.name}
                      </span>
                      {selectedStudent.nameCht && lang === "en" && (
                        <span className="text-slate-400 text-xs ml-1">({selectedStudent.nameCht})</span>
                      )}
                    </div>
                    <button
                      onClick={() => navigateStudent(1)}
                      disabled={selectedIdx >= sortedStudents.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-400">{selectedIdx + 1} / {sortedStudents.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold font-mono text-blue-600 leading-none">{currentTotal}</p>
                      <p className="text-xs text-slate-400">/ {maxTotal}{maxTotal > 0 ? ` (${Math.round((currentTotal / maxTotal) * 100)}%)` : ""}</p>
                    </div>
                    <button
                      onClick={handleClear}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={t("clearRecord")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Button size="sm" onClick={handleSave} disabled={!dirty} className="gap-1.5 h-8 text-xs">
                      <Save className="w-3.5 h-3.5" /> {t("save")}
                    </Button>
                  </div>
                </div>

                {/* Score card grid */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {groups.map((group, gi) => (
                    <div key={gi}>
                      {group.sectionLabel && (
                        <div className="mb-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{group.sectionLabel}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {group.questions.map(item => {
                          const val = draftScores[item.id];
                          const numVal = typeof val === "number" ? val : NaN;
                          const isOver = !isNaN(numVal) && numVal > item.maxMark;
                          const isNeg = !isNaN(numVal) && numVal < 0;
                          const hasVal = val !== "" && !isNaN(numVal);
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "rounded-lg border-2 p-2 transition-all",
                                isOver || isNeg
                                  ? "border-red-300 bg-red-50"
                                  : hasVal
                                  ? "border-green-300 bg-green-50"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              )}
                            >
                              <p className="text-xs font-mono font-bold text-slate-600 mb-1 truncate">{item.label}</p>
                              <div className="flex items-center gap-0.5">
                                <Input
                                  type="number"
                                  min={0}
                                  max={item.maxMark}
                                  step={0.5}
                                  value={val === "" ? "" : (val ?? "")}
                                  onChange={e => handleScoreChange(item.id, e.target.value)}
                                  onBlur={handleAutoSave}
                                  className={cn(
                                    "h-8 text-center font-mono text-sm font-bold border-0 bg-transparent p-0 focus-visible:ring-0",
                                    isOver || isNeg ? "text-red-600" : hasVal ? "text-green-700" : "text-slate-800"
                                  )}
                                  placeholder="—"
                                />
                                <span className="text-[10px] text-slate-400 shrink-0">/{item.maxMark}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer nav */}
                <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => navigateStudent(-1)} disabled={selectedIdx <= 0} className="gap-1 text-xs h-7">
                    <ChevronLeft className="w-3.5 h-3.5" /> {t("prev")}
                  </Button>
                  <span className="text-xs text-slate-400">{selectedIdx + 1} / {sortedStudents.length}</span>
                  <Button variant="outline" size="sm" onClick={() => navigateStudent(1)} disabled={selectedIdx >= sortedStudents.length - 1} className="gap-1 text-xs h-7">
                    {t("next")} <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

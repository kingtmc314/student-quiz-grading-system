import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, BarChart3, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { ScoreEntry } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { totalMaxMarks } from "@/lib/markSheetParser";
import { toast } from "sonner";

export default function Grading() {
  const { yearId, subjectId, classId, assessmentId } = useParams<{
    yearId: string; subjectId: string; classId: string; assessmentId: string;
  }>();
  const { getSchoolYear, getSubject, getClass, getAssessment, upsertScore, deleteScore } = useData();
  const { t } = useI18n();
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
  const existingScore = assessment?.scores.find((s: ScoreEntry) => s.studentId === selectedStudentId) ?? null;

  // Load existing scores into draft when student changes
  useEffect(() => {
    if (!assessment || !selectedStudentId) return;
    const existing = assessment.scores.find((s: ScoreEntry) => s.studentId === selectedStudentId);
    if (existing) {
      const map: Record<string, number | ""> = {};
      Object.entries(existing.scores).forEach(([itemId, score]) => {
        map[itemId] = score ?? "";
      });
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
    const itemScores = questions.map(q => ({
      itemId: q.id,
      score: typeof draftScores[q.id] === "number" ? (draftScores[q.id] as number) : 0,
    }));
    upsertScore(yearId, subjectId, classId, assessmentId, selectedStudentId, itemScores);
    setDirty(false);
    toast.success(t("saved"));
  };

  const handleClear = () => {
    if (!selectedStudentId) return;
    deleteScore(yearId, subjectId, classId, assessmentId, selectedStudentId);
    setDraftScores({});
    setDirty(false);
    toast.success(t("deleted"));
  };

  const navigateStudent = (dir: -1 | 1) => {
    if (!selectedStudentId) { setSelectedStudentId(sortedStudents[0]?.id ?? null); return; }
    const idx = sortedStudents.findIndex(s => s.id === selectedStudentId);
    const next = sortedStudents[idx + dir];
    if (next) setSelectedStudentId(next.id);
  };

  const getStudentTotal = (studentId: string) => {
    const sc = assessment.scores.find((s: ScoreEntry) => s.studentId === studentId);
    if (!sc) return null;
    return Object.values(sc.scores).reduce((sum: number, v) => sum + (v ?? 0), 0);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subject.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
        { label: assessment.title },
        { label: t("enterScores") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("enterScores")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{assessment.title} · {cls.name} · {t("maxMark")}: {maxTotal}</p>
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
          ⚠ {t("markSheet")} not configured yet.{" "}
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
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("students")}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedStudents.map(student => {
                const total = getStudentTotal(student.id);
                const isSelected = selectedStudentId === student.id;
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 transition-colors ${
                      isSelected ? "bg-blue-600 text-white" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <p className={`text-xs font-mono ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          {student.classNo}
                        </p>
                        <p className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-slate-800"}`}>
                          {student.name}
                        </p>
                      </div>
                      {total !== null && (
                        <span className={`text-xs font-mono font-bold shrink-0 ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
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
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigateStudent(-1)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <span className="font-mono text-xs text-slate-400">{selectedStudent.classNo}</span>
                      <span className="font-bold text-slate-800 ml-2">{selectedStudent.name}</span>
                    </div>
                    <button onClick={() => navigateStudent(1)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-slate-700">
                      {currentTotal} / {maxTotal}
                      {maxTotal > 0 && (
                        <span className="text-slate-400 ml-1">({Math.round((currentTotal / maxTotal) * 100)}%)</span>
                      )}
                    </span>
                    {existingScore && (
                      <button onClick={handleClear} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title={t("clearRecord")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <Button size="sm" onClick={handleSave} disabled={!dirty} className="gap-1.5 h-7 text-xs">
                      <Save className="w-3.5 h-3.5" /> {t("save")}
                    </Button>
                  </div>
                </div>

                {/* Score grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {markSheet.map(item => {
                    if (item.isSection) {
                      return (
                        <div key={item.id} className="mt-4 mb-2 first:mt-0">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-blue-600 border-b border-blue-100 pb-1">
                            {item.label}
                          </h4>
                        </div>
                      );
                    }
                    const val = draftScores[item.id];
                    const isOver = typeof val === "number" && val > item.maxMark;
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <span className="font-mono text-sm font-semibold text-slate-700 w-24 shrink-0">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={item.maxMark}
                            step={0.5}
                            value={val === "" ? "" : val ?? ""}
                            onChange={e => handleScoreChange(item.id, e.target.value)}
                            className={`h-8 w-20 text-center font-mono text-sm ${isOver ? "border-red-400 bg-red-50" : ""}`}
                            placeholder="—"
                          />
                          <span className="text-xs text-slate-400 font-mono">/ {item.maxMark}</span>
                          {isOver && <span className="text-xs text-red-500">!</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer nav */}
                <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => navigateStudent(-1)} className="gap-1 text-xs h-7">
                    <ChevronLeft className="w-3.5 h-3.5" /> {t("prev")}
                  </Button>
                  <span className="text-xs text-slate-400">
                    {sortedStudents.findIndex(s => s.id === selectedStudentId) + 1} / {sortedStudents.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => navigateStudent(1)} className="gap-1 text-xs h-7">
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

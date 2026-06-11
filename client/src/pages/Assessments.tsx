import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plus, Trash2, ClipboardList, FileEdit, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { Term, AssessmentNature } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

const NATURE_COLORS: Record<AssessmentNature, string> = {
  Quiz: "bg-blue-100 text-blue-700 border-blue-200",
  Test: "bg-amber-100 text-amber-700 border-amber-200",
  Exam: "bg-red-100 text-red-700 border-red-200",
};

export default function Assessments() {
  const { yearId, subjectId, classId } = useParams<{ yearId: string; subjectId: string; classId: string }>();
  const { getSchoolYear, getSubject, getClass, addAssessment, deleteAssessment } = useData();
  const { t } = useI18n();
  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);

  const [showAdd, setShowAdd] = useState(false);
  const [newTerm, setNewTerm] = useState<Term>("Term 1");
  const [newNature, setNewNature] = useState<AssessmentNature>("Quiz");
  const [newTitle, setNewTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!year || !subject || !cls) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    const a = addAssessment(yearId, subjectId, classId, newTerm, newNature, title);
    setNewTitle("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteAssessment(yearId, subjectId, classId, deleteId);
    setDeleteId(null);
    toast.success(t("deleted"));
  };

  const termLabel = (term: Term) => term === "Term 1" ? t("term1") : t("term2");
  const natureLabel = (n: AssessmentNature) => n === "Quiz" ? t("quiz") : n === "Test" ? t("test") : t("exam");

  // Group by term
  const terms: Term[] = ["Term 1", "Term 2"];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subject.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name },
        { label: t("assessments") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("assessments")} — {cls.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{subject.name} · {year.label}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/students`}>
            <a className="text-xs font-semibold text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-blue-300 transition-colors">
              {t("students")}
            </a>
          </Link>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> {t("addAssessment")}
          </Button>
        </div>
      </div>

      {cls.assessments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">{t("noAssessmentsYet")}</div>
      ) : (
        terms.map(term => {
          const termAssessments = cls.assessments.filter(a => a.term === term);
          if (termAssessments.length === 0) return null;
          return (
            <div key={term}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{termLabel(term)}</h3>
              <div className="space-y-2">
                {termAssessments.map(assessment => {
                  const hasMarkSheet = assessment.markSheet.length > 0;
                  const scoredCount = assessment.scores.length;
                  const totalStudents = cls.students.length;
                  return (
                    <div key={assessment.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200">
                          <ClipboardList className="w-4.5 h-4.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-slate-800">{assessment.title}</span>
                            <Badge className={`text-xs border ${NATURE_COLORS[assessment.nature]}`} variant="outline">
                              {natureLabel(assessment.nature)}
                            </Badge>
                            {hasMarkSheet && (
                              <span className="text-xs text-slate-400 font-mono">
                                {assessment.markSheet.filter(i => !i.isSection).reduce((s, i) => s + i.maxMark, 0)} {t("maxMark")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {scoredCount}/{totalStudents} {t("students").toLowerCase()} graded
                            {!hasMarkSheet && <span className="ml-2 text-amber-500">⚠ {t("markSheet")} not set</span>}
                          </p>
                        </div>
                        <button onClick={() => setDeleteId(assessment.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Link href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessment.id}/marksheet`}>
                          <a className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                            <FileEdit className="w-3.5 h-3.5" /> {t("editMarkSheet")}
                          </a>
                        </Link>
                        <Link href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessment.id}/grading`}>
                          <a className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                            <ClipboardList className="w-3.5 h-3.5" /> {t("enterScores")}
                          </a>
                        </Link>
                        <Link href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessment.id}/results`}>
                          <a className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <BarChart3 className="w-3.5 h-3.5" /> {t("viewResults")}
                          </a>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addAssessment")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">{t("term")}</label>
              <Select value={newTerm} onValueChange={v => setNewTerm(v as Term)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1">{t("term1")}</SelectItem>
                  <SelectItem value="Term 2">{t("term2")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">{t("nature")}</label>
              <Select value={newNature} onValueChange={v => setNewNature(v as AssessmentNature)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quiz">{t("quiz")}</SelectItem>
                  <SelectItem value="Test">{t("test")}</SelectItem>
                  <SelectItem value="Exam">{t("exam")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">{t("title")}</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Quiz 1 — Differentiation" onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={!newTitle.trim()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("delete")}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">{t("deleteConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

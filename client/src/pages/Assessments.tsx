import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plus, Trash2, ClipboardList, FileEdit, BarChart3, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { Term } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

const NATURE_COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700 border-blue-200",
  amber:  "bg-amber-100 text-amber-700 border-amber-200",
  red:    "bg-red-100 text-red-700 border-red-200",
  green:  "bg-green-100 text-green-700 border-green-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function Assessments() {
  const { yearId, subjectId, classId } = useParams<{ yearId: string; subjectId: string; classId: string }>();
  const { getSchoolYear, getSubject, getClass, addAssessment, deleteAssessment, natures, teachers } = useData();
  const { t, lang } = useI18n();
  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);

  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTitleCht, setNewTitleCht] = useState("");
  const [newTerm, setNewTerm] = useState<Term>("Term 1");
  const [newNatureId, setNewNatureId] = useState<string>(natures[0]?.id ?? "");
  const [newTeacherId, setNewTeacherId] = useState<string>(teachers[0]?.id ?? "");
  const [newDate, setNewDate] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!year || !subject || !cls) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const subjectDisplayName = lang === "zh" ? subject.nameCht : subject.name;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title || !newNatureId) return;
    addAssessment(yearId, subjectId, classId, {
      code: newCode.trim(),
      title,
      titleCht: newTitleCht.trim(),
      term: newTerm,
      natureId: newNatureId,
      teacherId: newTeacherId,
      date: newDate,
      topicIds: [],
    });
    setNewCode(""); setNewTitle(""); setNewTitleCht(""); setNewDate("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteAssessment(yearId, subjectId, classId, deleteId);
    setDeleteId(null);
    toast.success(t("deleted"));
  };

  const termLabel = (term: Term) => {
    if (term === "Term 1") return t("term1");
    if (term === "Term 2") return t("term2");
    return t("fullYear");
  };

  const terms: Term[] = ["Term 1", "Term 2", "Full Year"];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subjectDisplayName, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name },
        { label: t("assessments") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("assessments")} — {cls.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{subjectDisplayName} · {year.label}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/students`}
            className="text-xs font-semibold text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-blue-300 transition-colors"
          >
            {t("students")}
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
                  const nature = natures.find(n => n.id === assessment.natureId);
                  const hasMarkSheet = assessment.markSheet.length > 0;
                  const scoredCount = assessment.scores.length;
                  const totalStudents = cls.students.length;
                  const maxMark = assessment.markSheet.filter(i => !i.isSection).reduce((s, i) => s + i.maxMark, 0);
                  const natureColorClass = nature ? (NATURE_COLOR_MAP[nature.color] ?? "bg-slate-100 text-slate-700 border-slate-200") : "bg-slate-100 text-slate-700 border-slate-200";
                  const natureLabel = nature ? (lang === "zh" ? nature.nameCht : nature.name) : "—";
                  const assessTitle = lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title;

                  return (
                    <div key={assessment.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200">
                          <ClipboardList className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {assessment.code && (
                              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{assessment.code}</span>
                            )}
                            <span className="font-bold text-slate-800">{assessTitle}</span>
                            {nature && (
                              <Badge className={`text-xs border ${natureColorClass}`} variant="outline">
                                {natureLabel}
                              </Badge>
                            )}
                            {nature?.isExam && (
                              <Badge className="text-xs border bg-red-50 text-red-600 border-red-200" variant="outline">Exam</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            {assessment.date && (
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{assessment.date}</span>
                            )}
                            {hasMarkSheet && (
                              <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{maxMark} {t("maxMark")}</span>
                            )}
                            <span>{scoredCount}/{totalStudents} {t("graded")}</span>
                            {!hasMarkSheet && <span className="text-amber-500">⚠ {t("markSheet")} not set</span>}
                          </div>
                        </div>
                        <button onClick={() => setDeleteId(assessment.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <Link
                          href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessment.id}/marksheet`}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                        >
                          <FileEdit className="w-3.5 h-3.5" /> {t("editMarkSheet")}
                        </Link>
                        <Link
                          href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessment.id}/grading`}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <ClipboardList className="w-3.5 h-3.5" /> {t("enterScores")}
                        </Link>
                        <Link
                          href={`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessment.id}/results`}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <BarChart3 className="w-3.5 h-3.5" /> {t("viewResults")}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("addAssessment")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("code")} (e.g. T1Q1)</label>
                <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="T1Q1" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("date")}</label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">{t("title")} (English)</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Quiz 1 — Differentiation" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">{t("titleCht")}</label>
              <Input value={newTitleCht} onChange={e => setNewTitleCht(e.target.value)} placeholder="小測一 — 微分" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("term")}</label>
                <Select value={newTerm} onValueChange={v => setNewTerm(v as Term)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1">{t("term1")}</SelectItem>
                    <SelectItem value="Term 2">{t("term2")}</SelectItem>
                    <SelectItem value="Full Year">{t("fullYear")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("nature")}</label>
                <Select value={newNatureId} onValueChange={setNewNatureId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {natures.map(n => (
                      <SelectItem key={n.id} value={n.id}>{lang === "zh" ? n.nameCht : n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">{t("teacher")}</label>
              <Select value={newTeacherId} onValueChange={setNewTeacherId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teachers.map(tc => (
                    <SelectItem key={tc.id} value={tc.id}>{lang === "zh" ? tc.nameCht : tc.name} ({tc.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={!newTitle.trim() || !newNatureId}>{t("save")}</Button>
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

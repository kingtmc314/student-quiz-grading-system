import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plus, Trash2, ArrowRight, BookOpen, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

export default function Subjects() {
  const { yearId } = useParams<{ yearId: string }>();
  const { getSchoolYear, subjects, addSubjectToYear, removeSubjectFromYear, getGlobalSubject } = useData();
  const { t, lang } = useI18n();
  const year = getSchoolYear(yearId);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);

  if (!year) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  // Subjects already linked to this year
  const linkedSubjectIds = new Set(year.subjects.map(ys => ys.subjectId));
  // Available to add
  const availableSubjects = subjects.filter(s => !linkedSubjectIds.has(s.id));

  const handleAdd = () => {
    if (!selectedSubjectId) return;
    addSubjectToYear(yearId, selectedSubjectId);
    setSelectedSubjectId("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleDelete = () => {
    if (!deleteSubjectId) return;
    removeSubjectFromYear(yearId, deleteSubjectId);
    setDeleteSubjectId(null);
    toast.success(t("deleted"));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label },
        { label: t("subjects") },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("subjects")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t("schoolYear")}: <span className="font-mono font-semibold">{year.label}</span></p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> {t("addSubject")}
        </Button>
      </div>

      {year.subjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">{t("noData")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {year.subjects.map((ys) => {
            const sub = getGlobalSubject(ys.subjectId);
            if (!sub) return null;
            const displayName = lang === "zh" ? sub.nameCht : sub.name;
            return (
              <div key={ys.subjectId} className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{displayName}</p>
                  <p className="text-xs text-slate-400 font-mono">{sub.code} · {sub.form}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Tags className="w-3 h-3" />{sub.topics.length} {t("topics")}
                    </Badge>
                    <span className="text-xs text-slate-400">{ys.classes.length} {t("classes")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/school-years/${yearId}/subjects/${ys.subjectId}/classes`}
                    className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteSubjectId(ys.subjectId)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add subject dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addSubject")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-xs text-slate-500">Select a subject from the global registry to link to this school year. Manage subjects and topics in <strong>Settings → Subjects</strong>.</p>
            {availableSubjects.length === 0 ? (
              <p className="text-sm text-slate-400 italic">All subjects are already linked, or no subjects exist. Go to Settings to add subjects.</p>
            ) : (
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {lang === "zh" ? s.nameCht : s.name} ({s.code} · {s.form})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={!selectedSubjectId}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteSubjectId} onOpenChange={() => setDeleteSubjectId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("delete")}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">{t("deleteConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSubjectId(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

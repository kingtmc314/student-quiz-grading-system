import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plus, Trash2, ArrowRight, Users, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

export default function Classes() {
  const { yearId, subjectId } = useParams<{ yearId: string; subjectId: string }>();
  const { getSchoolYear, getSubject, addClass, deleteClass } = useData();
  const { t } = useI18n();
  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!year || !subject) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addClass(yearId, subjectId, name);
    setNewName("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteClass(yearId, subjectId, deleteId);
    setDeleteId(null);
    toast.success(t("deleted"));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subject.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: t("classes") },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("classes")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{subject.name} · {year.label}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> {t("addClass")}
        </Button>
      </div>

      {subject.classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">{t("noData")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subject.classes.map((cls) => (
            <div key={cls.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 font-mono">{cls.name}</p>
                  <p className="text-xs text-slate-500">{cls.students.length} {t("students")}</p>
                </div>
                <button onClick={() => setDeleteId(cls.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <Link href={`/school-years/${yearId}/subjects/${subjectId}/classes/${cls.id}/students`}>
                  <a className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                    <Users className="w-3.5 h-3.5" /> {t("students")}
                  </a>
                </Link>
                <Link href={`/school-years/${yearId}/subjects/${subjectId}/classes/${cls.id}/assessments`}>
                  <a className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                    <ClipboardList className="w-3.5 h-3.5" /> {t("assessments")}
                  </a>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addClass")}</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{t("name")} (e.g. 6A)</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="6A" onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

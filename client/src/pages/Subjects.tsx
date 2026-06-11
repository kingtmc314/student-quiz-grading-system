import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plus, Trash2, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

export default function Subjects() {
  const { yearId } = useParams<{ yearId: string }>();
  const { getSchoolYear, addSubject, deleteSubject } = useData();
  const { t } = useI18n();
  const year = getSchoolYear(yearId);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!year) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addSubject(yearId, name);
    setNewName("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSubject(yearId, deleteId);
    setDeleteId(null);
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
          {year.subjects.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{sub.name}</p>
                <p className="text-xs text-slate-500">{sub.classes.length} {t("classes")}</p>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/school-years/${yearId}/subjects/${sub.id}/classes`}>
                  <a className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Link>
                <button onClick={() => setDeleteId(sub.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addSubject")}</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{t("name")} (e.g. Mathematics M2)</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Mathematics M2" onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
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

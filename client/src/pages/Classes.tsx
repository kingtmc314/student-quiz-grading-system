import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plus, Trash2, Users, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

export default function Classes() {
  const { yearId, subjectId } = useParams<{ yearId: string; subjectId: string }>();
  const { getSchoolYear, getSubject, getYearSubject, addClass, deleteClass, teachers } = useData();
  const { t, lang } = useI18n();
  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const ys = getYearSubject(yearId, subjectId);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newForm, setNewForm] = useState("S6");
  const [newTeacherId, setNewTeacherId] = useState<string>(teachers[0]?.id ?? "");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!year || !subject || !ys) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const subjectDisplayName = lang === "zh" ? subject.nameCht : subject.name;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addClass(yearId, subjectId, { name, form: newForm, teacherId: newTeacherId });
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
        { label: subjectDisplayName },
        { label: t("classes") },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("classes")} — {subjectDisplayName}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{year.label}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> {t("addClass")}
        </Button>
      </div>

      {ys.classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">{t("noData")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ys.classes.map((cls) => {
            const teacher = teachers.find(tc => tc.id === cls.teacherId);
            const teacherName = teacher ? (lang === "zh" ? teacher.nameCht : teacher.name) : "—";
            return (
              <div key={cls.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="font-bold text-blue-700 text-sm">{cls.name}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800">{cls.name}</p>
                    <p className="text-xs text-slate-400">{cls.form} · {teacherName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{cls.students.length} {t("students").toLowerCase()} · {cls.assessments.length} {t("assessments").toLowerCase()}</p>
                  </div>
                  <button onClick={() => setDeleteId(cls.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/school-years/${yearId}/subjects/${subjectId}/classes/${cls.id}/students`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" /> {t("students")}
                  </Link>
                  <Link
                    href={`/school-years/${yearId}/subjects/${subjectId}/classes/${cls.id}/assessments`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> {t("assessments")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addClass")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">{t("className")} (e.g. 6A)</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="6A" onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">{t("form")}</label>
              <Select value={newForm} onValueChange={setNewForm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["S1","S2","S3","S4","S5","S6"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {teachers.length > 0 && (
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
            )}
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

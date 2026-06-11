import { useState } from "react";
import { useParams } from "wouter";
import { Plus, Trash2, Upload, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";

export default function Students() {
  const { yearId, subjectId, classId } = useParams<{ yearId: string; subjectId: string; classId: string }>();
  const { getSchoolYear, getSubject, getClass, addStudent, updateStudent, deleteStudent, importStudents } = useData();
  const { t } = useI18n();
  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const cls = getClass(yearId, subjectId, classId);

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newClassNo, setNewClassNo] = useState("");
  const [newName, setNewName] = useState("");
  const [importText, setImportText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editClassNo, setEditClassNo] = useState("");
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!year || !subject || !cls) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const handleAdd = () => {
    if (!newClassNo.trim() || !newName.trim()) return;
    addStudent(yearId, subjectId, classId, newClassNo.trim(), newName.trim());
    setNewClassNo(""); setNewName("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleImport = () => {
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split(/\t|,/).map(p => p.trim());
      return { classNo: parts[0] || "", name: parts[1] || "" };
    }).filter(p => p.classNo && p.name);
    if (parsed.length === 0) { toast.error(t("parseError")); return; }
    importStudents(yearId, subjectId, classId, parsed);
    setImportText(""); setShowImport(false);
    toast.success(`${t("saved")} (${parsed.length})`);
  };

  const startEdit = (id: string, classNo: string, name: string) => {
    setEditId(id); setEditClassNo(classNo); setEditName(name);
  };

  const saveEdit = () => {
    if (!editId || !editClassNo.trim() || !editName.trim()) return;
    updateStudent(yearId, subjectId, classId, editId, editClassNo.trim(), editName.trim());
    setEditId(null);
    toast.success(t("saved"));
  };

  const sorted = [...cls.students].sort((a, b) =>
    a.classNo.localeCompare(b.classNo, undefined, { numeric: true })
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subject.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
        { label: t("students") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("students")} — {cls.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{cls.students.length} {t("students").toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
            <Upload className="w-4 h-4" /> {t("import")}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> {t("addStudent")}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm mark-table">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left w-24">{t("classNo")}</th>
              <th className="px-4 py-3 text-left">{t("studentName")}</th>
              <th className="px-4 py-3 text-right w-24">{t("edit")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{t("noData")}</td></tr>
            ) : sorted.map(student => (
              <tr key={student.id} className="border-b border-slate-100 last:border-0">
                {editId === student.id ? (
                  <>
                    <td className="px-3 py-2">
                      <Input value={editClassNo} onChange={e => setEditClassNo(e.target.value)} className="h-7 text-xs font-mono w-20" />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" onKeyDown={e => e.key === "Enter" && saveEdit()} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={saveEdit} className="p-1 rounded text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 font-mono text-slate-700">{student.classNo}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-medium">{student.name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(student.id, student.classNo, student.name)} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(student.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addStudent")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">{t("classNo")}</label>
              <Input value={newClassNo} onChange={e => setNewClassNo(e.target.value)} placeholder="01" autoFocus />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">{t("studentName")}</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Chan Tai Man" onKeyDown={e => e.key === "Enter" && handleAdd()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={!newClassNo.trim() || !newName.trim()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("import")} {t("students")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-xs text-slate-500">{t("importStudentsHint")}</p>
            <Textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"01\tChan Tai Man\n02\tLee Siu Ming\n03\t王大明"}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>{t("cancel")}</Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>{t("import")}</Button>
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
            <Button variant="destructive" onClick={() => { if (deleteId) { deleteStudent(yearId, subjectId, classId, deleteId); setDeleteId(null); toast.success(t("deleted")); } }}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

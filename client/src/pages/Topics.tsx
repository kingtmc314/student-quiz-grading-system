import { useState } from "react";
import { useParams } from "wouter";
import { BookOpen, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { toast } from "sonner";
import type { Topic } from "@/contexts/DataContext";

export default function Topics() {
  const { yearId, subjectId } = useParams<{ yearId: string; subjectId: string }>();
  const { getSchoolYear, getGlobalSubject, addTopic, updateTopic, deleteTopic, reorderTopics } = useData();
  const { t, lang } = useI18n();

  const year = getSchoolYear(yearId);
  const subject = getGlobalSubject(subjectId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", nameCht: "" });
  const [dragging, setDragging] = useState<string | null>(null);

  if (!year || !subject) {
    return <div className="text-slate-400 text-sm p-4">{t("noData")}</div>;
  }

  const topics = subject.topics ?? [];

  const openAdd = () => { setEditing(null); setForm({ code: "", name: "", nameCht: "" }); setOpen(true); };
  const openEdit = (tp: Topic) => { setEditing(tp); setForm({ code: tp.code ?? "", name: tp.name, nameCht: tp.nameCht ?? "" }); setOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t("validationError")); return; }
    if (editing) {
      updateTopic(subjectId, editing.id, { code: form.code.trim(), name: form.name.trim(), nameCht: form.nameCht.trim() });
    } else {
      addTopic(subjectId, { code: form.code.trim(), name: form.name.trim(), nameCht: form.nameCht.trim() });
    }
    toast.success(t("saved")); setOpen(false);
  };

  // Simple drag-and-drop reorder
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    const ids = topics.map(tp => tp.id);
    const fromIdx = ids.indexOf(dragging);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, dragging);
    reorderTopics(subjectId, newIds);
  };
  const handleDragEnd = () => setDragging(null);

  const subjectDisplayName = lang === "zh" ? (subject.nameCht || subject.name) : subject.name;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subjectDisplayName, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: t("topics") },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{t("subjectTopics")}</h2>
            <p className="text-sm text-slate-500">{subjectDisplayName} · {topics.length} topic(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" />{t("addTopic")}
        </Button>
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("noTopicsYet")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {topics.map((tp, idx) => (
            <div
              key={tp.id}
              draggable
              onDragStart={() => handleDragStart(tp.id)}
              onDragOver={e => handleDragOver(e, tp.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 cursor-grab transition-all ${dragging === tp.id ? "opacity-50 scale-95" : ""}`}
            >
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-mono shrink-0">{idx + 1}</span>
              {tp.code && (
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded shrink-0">{tp.code}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{tp.name}</p>
                {tp.nameCht && <p className="text-sm text-slate-500 truncate">{tp.nameCht}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(tp)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => setDeleteId(tp.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("addTopic")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("topicCode")}</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. T1, 1.1" />
            </div>
            <div>
              <Label>{t("topicNameEn")} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Differentiation" />
            </div>
            <div>
              <Label>{t("topicNameZh")}</Label>
              <Input value={form.nameCht} onChange={e => setForm(f => ({ ...f, nameCht: e.target.value }))} placeholder="e.g. 微分" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteTopic(subjectId, deleteId!); toast.success(t("deleted")); setDeleteId(null); }}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

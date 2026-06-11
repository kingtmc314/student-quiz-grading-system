import { useState } from "react";
import { Settings2, Users, Tag, BarChart2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { Teacher, AssessmentNature, WeightingScheme } from "@/contexts/DataContext";

// ─── Teacher Management ───────────────────────────────────────────────────────
function TeachersTab() {
  const { teachers, addTeacher, updateTeacher, deleteTeacher } = useData();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", nameCht: "", code: "", email: "" });

  const openAdd = () => { setEditing(null); setForm({ name: "", nameCht: "", code: "", email: "" }); setOpen(true); };
  const openEdit = (tc: Teacher) => { setEditing(tc); setForm({ name: tc.name, nameCht: tc.nameCht ?? "", code: tc.code ?? "", email: tc.email ?? "" }); setOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t("validationError")); return; }
    if (editing) {
      updateTeacher(editing.id, { name: form.name.trim(), nameCht: form.nameCht.trim(), code: form.code.trim(), email: form.email.trim() });
    } else {
      addTeacher({ name: form.name.trim(), nameCht: form.nameCht.trim(), code: form.code.trim(), email: form.email.trim() });
    }
    toast.success(t("saved")); setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{teachers.length === 0 ? t("noTeachersYet") : `${teachers.length} teacher(s)`}</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus className="w-4 h-4" />{t("addTeacher")}</Button>
      </div>
      <div className="space-y-2">
        {teachers.map(tc => (
          <div key={tc.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div>
              <p className="font-semibold text-slate-800">{tc.name}{tc.nameCht ? ` · ${tc.nameCht}` : ""}</p>
              <p className="text-xs text-slate-400">{[tc.code, tc.email].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(tc)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => setDeleteId(tc.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("addTeacher")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")} * (English)</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("nameCht")} (Chinese)</Label><Input value={form.nameCht} onChange={e => setForm(f => ({ ...f, nameCht: e.target.value }))} /></div>
            <div><Label>{t("teacherCode")}</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. TCH01" /></div>
            <div><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="teacher@school.edu.hk" /></div>
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
            <AlertDialogAction onClick={() => { deleteTeacher(deleteId!); toast.success(t("deleted")); setDeleteId(null); }}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Nature Management ────────────────────────────────────────────────────────
const PRESET_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

function NaturesTab() {
  const { natures, addNature, updateNature, deleteNature } = useData();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentNature | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", nameCht: "", color: "#3b82f6", isExam: false });

  const openAdd = () => { setEditing(null); setForm({ name: "", nameCht: "", color: "#3b82f6", isExam: false }); setOpen(true); };
  const openEdit = (n: AssessmentNature) => { setEditing(n); setForm({ name: n.name, nameCht: n.nameCht ?? "", color: n.color ?? "#3b82f6", isExam: n.isExam ?? false }); setOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t("validationError")); return; }
    if (editing) {
      updateNature(editing.id, { name: form.name.trim(), nameCht: form.nameCht.trim(), color: form.color, isExam: form.isExam });
    } else {
      addNature({ name: form.name.trim(), nameCht: form.nameCht.trim(), color: form.color, isExam: form.isExam });
    }
    toast.success(t("saved")); setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{natures.length === 0 ? t("noNaturesYet") : `${natures.length} nature(s)`}</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus className="w-4 h-4" />{t("addNature")}</Button>
      </div>
      <div className="space-y-2">
        {natures.map(n => (
          <div key={n.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ background: n.color ?? "#3b82f6" }} />
              <div>
                <p className="font-semibold text-slate-800">{n.name}{n.nameCht ? ` · ${n.nameCht}` : ""}</p>
                <p className="text-xs text-slate-400">{n.isExam ? "Exam (separate from CA)" : "Continuous Assessment (CA)"}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => setDeleteId(n.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("addNature")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")} * (English)</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Quiz" /></div>
            <div><Label>{t("nameCht")} (Chinese)</Label><Input value={form.nameCht} onChange={e => setForm(f => ({ ...f, nameCht: e.target.value }))} placeholder="e.g. 小測" /></div>
            <div>
              <Label>{t("natureColor")}</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: form.color === c ? "#1e293b" : "transparent" }}>
                    {form.color === c && <Check className="w-3 h-3 text-white mx-auto" />}
                  </button>
                ))}
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border border-slate-200" title="Custom color" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isExam} onCheckedChange={v => setForm(f => ({ ...f, isExam: v }))} id="isExam" />
              <Label htmlFor="isExam">{t("natureIsExam")}</Label>
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
            <AlertDialogAction onClick={() => { deleteNature(deleteId!); toast.success(t("deleted")); setDeleteId(null); }}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Weighting Schemes ────────────────────────────────────────────────────────
// WeightingScheme shape: { id, form, subjectId, label, caEntries: [{natureId, percentage}], examPercentage }
function WeightingTab() {
  const { weightingSchemes, natures, addWeightingScheme, updateWeightingScheme, deleteWeightingScheme } = useData();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeightingScheme | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    label: string;
    form: string;
    subjectId: string;
    caEntries: { natureId: string; percentage: number }[];
    examPercentage: number;
  }>({ label: "", form: "", subjectId: "", caEntries: [], examPercentage: 0 });

  // Only CA natures (non-exam) get caEntries
  const caNatures = natures.filter(n => !n.isExam);

  const openAdd = () => {
    setEditing(null);
    setForm({
      label: "", form: "", subjectId: "",
      caEntries: caNatures.map(n => ({ natureId: n.id, percentage: 0 })),
      examPercentage: 0
    });
    setOpen(true);
  };

  const openEdit = (s: WeightingScheme) => {
    setEditing(s);
    const caEntries = caNatures.map(n => {
      const existing = s.caEntries.find(e => e.natureId === n.id);
      return { natureId: n.id, percentage: existing?.percentage ?? 0 };
    });
    setForm({ label: s.label, form: s.form, subjectId: s.subjectId, caEntries, examPercentage: s.examPercentage });
    setOpen(true);
  };

  const caTotal = form.caEntries.reduce((s, e) => s + (e.percentage || 0), 0);
  const grandTotal = caTotal + (form.examPercentage || 0);

  const handleSave = () => {
    if (!form.label.trim()) { toast.error(t("validationError")); return; }
    const payload = {
      label: form.label.trim(),
      form: form.form.trim(),
      subjectId: form.subjectId.trim(),
      caEntries: form.caEntries.filter(e => e.percentage > 0),
      examPercentage: form.examPercentage || 0,
    };
    if (editing) {
      updateWeightingScheme(editing.id, payload);
    } else {
      addWeightingScheme(payload);
    }
    toast.success(t("saved")); setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{weightingSchemes.length === 0 ? t("noSchemesYet") : `${weightingSchemes.length} scheme(s)`}</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5" disabled={natures.length === 0}><Plus className="w-4 h-4" />{t("addWeightingScheme")}</Button>
      </div>
      {natures.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Please add Assessment Natures first before creating weighting schemes.
        </p>
      )}
      <div className="space-y-2">
        {weightingSchemes.map(s => (
          <div key={s.id} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-800">{s.label}</p>
                <p className="text-xs text-slate-400">{[s.form && `Form ${s.form}`, s.subjectId].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => setDeleteId(s.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.caEntries.filter(e => e.percentage > 0).map(e => {
                const nat = natures.find(n => n.id === e.natureId);
                return nat ? (
                  <span key={e.natureId} className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: nat.color ?? "#3b82f6" }}>
                    {nat.name}: {e.percentage}%
                  </span>
                ) : null;
              })}
              {s.examPercentage > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white bg-red-500">
                  Exam: {s.examPercentage}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("addWeightingScheme")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("schemeLabel")} *</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Form 6 Maths M2" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t("formLevel")}</Label><Input value={form.form} onChange={e => setForm(f => ({ ...f, form: e.target.value }))} placeholder="e.g. S6" /></div>
              <div><Label>{t("subject")}</Label><Input value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))} placeholder="e.g. M2" /></div>
            </div>
            <div>
              <Label className="mb-2 block">CA Weighting per Nature</Label>
              <div className="space-y-2">
                {form.caEntries.map((entry, idx) => {
                  const nat = natures.find(n => n.id === entry.natureId);
                  if (!nat) return null;
                  return (
                    <div key={entry.natureId} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: nat.color ?? "#3b82f6" }} />
                      <span className="text-sm flex-1">{nat.name}{nat.nameCht ? ` (${nat.nameCht})` : ""}</span>
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} max={100} value={entry.percentage}
                          onChange={e => {
                            const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                            setForm(f => ({ ...f, caEntries: f.caEntries.map((en, i) => i === idx ? { ...en, percentage: v } : en) }));
                          }}
                          className="w-20 text-right font-mono" />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="flex-1">{t("examPercentage")}</Label>
              <div className="flex items-center gap-1">
                <Input type="number" min={0} max={100} value={form.examPercentage}
                  onChange={e => setForm(f => ({ ...f, examPercentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                  className="w-20 text-right font-mono" />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>
            <div className={`text-sm font-semibold flex items-center gap-1 ${grandTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}>
              {grandTotal === 100 ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              Total: {grandTotal}% {grandTotal !== 100 && "(should be 100%)"}
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
            <AlertDialogAction onClick={() => { deleteWeightingScheme(deleteId!); toast.success(t("deleted")); setDeleteId(null); }}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("settings")}</h1>
          <p className="text-sm text-slate-500">Manage teachers, assessment natures, and weighting schemes</p>
        </div>
      </div>

      <Tabs defaultValue="teachers">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teachers" className="gap-1.5"><Users className="w-4 h-4" />{t("teacherManagement")}</TabsTrigger>
          <TabsTrigger value="natures" className="gap-1.5"><Tag className="w-4 h-4" />{t("natureManagement")}</TabsTrigger>
          <TabsTrigger value="weighting" className="gap-1.5"><BarChart2 className="w-4 h-4" />{t("weightingSchemes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="teachers" className="mt-4"><TeachersTab /></TabsContent>
        <TabsContent value="natures" className="mt-4"><NaturesTab /></TabsContent>
        <TabsContent value="weighting" className="mt-4"><WeightingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

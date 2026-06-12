/*
 * MainApp.tsx — Single-page tabbed application
 * Design: Institutional Clarity
 * - Dark navy sidebar (#1a2035) with 8 tab buttons
 * - Context selectors: School Year → Subject → Class → Assessment
 * - Tab content renders inline (no routing)
 * - 8 tabs matching reference site structure
 */
import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Users, ClipboardList, BarChart3, Table2, PieChart, User, Settings2, Database,
  GraduationCap, Languages, Save, ChevronDown, ChevronRight, Plus, Trash2,
  BookOpen, Menu, X, Pencil, Check, Upload, FileEdit, Tag, Wand2, FileText,
  ArrowUp, ArrowDown, ChevronLeft, Printer, TrendingUp, TrendingDown, Minus,
  Download, Copy, BarChart2, Tags, CalendarDays, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { nanoid } from "nanoid";
import { parseMarkSheetText, validateMarkSheet, totalMaxMarks } from "@/lib/markSheetParser";
import { buildMarkSheetCSV, downloadCSV } from "@/lib/exportUtils";
import type { Teacher, AssessmentNature, WeightingScheme, Topic, Term, MarkItem, ScoreEntry } from "@/contexts/DataContext";

const APP_VERSION = "v1.0.0";

// ─── Tab IDs ──────────────────────────────────────────────────────────────────
type TabId = "students" | "grading" | "weakness" | "summary" | "chart" | "profile" | "settings" | "backup";

interface TabDef {
  id: TabId;
  labelEn: string;
  labelZh: string;
  icon: React.ElementType;
}

const TABS: TabDef[] = [
  { id: "students",  labelEn: "Student Mgmt",    labelZh: "學生管理",          icon: Users },
  { id: "grading",   labelEn: "Score Entry",      labelZh: "小測成績輸入",      icon: ClipboardList },
  { id: "weakness",  labelEn: "Weakness Analysis",labelZh: "弱點分析",          icon: BarChart3 },
  { id: "summary",   labelEn: "Summary Table",    labelZh: "統測/大考總表",     icon: Table2 },
  { id: "chart",     labelEn: "Topic Charts",     labelZh: "課題圖表分析",      icon: PieChart },
  { id: "profile",   labelEn: "Student Profile",  labelZh: "學生個人檔案",      icon: User },
  { id: "settings",  labelEn: "Settings",         labelZh: "設定",              icon: Settings2 },
  { id: "backup",    labelEn: "Data Backup",      labelZh: "數據備份",          icon: Database },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRESET_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

function colorForPct(pct: number | null): string {
  if (pct === null) return "#94a3b8";
  return pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
}

function getScoreTotal(assessment: { markSheet: MarkItem[]; scores: ScoreEntry[] }, studentId: string): number | null {
  const entry = assessment.scores.find(s => s.studentId === studentId);
  if (!entry) return null;
  if (Array.isArray(entry.scores)) {
    return (entry.scores as Array<{ itemId: string; score: number | null }>).reduce((s, e) => s + (e.score ?? 0), 0);
  }
  return Object.values(entry.scores as Record<string, number | null>).reduce((s: number, v) => s + (v ?? 0), 0);
}

function getScoreMap(assessment: { markSheet: MarkItem[]; scores: ScoreEntry[] }, studentId: string): Record<string, number> {
  const entry = assessment.scores.find(s => s.studentId === studentId);
  if (!entry) return {};
  const map: Record<string, number> = {};
  if (Array.isArray(entry.scores)) {
    (entry.scores as Array<{ itemId: string; score: number | null }>).forEach(s => { map[s.itemId] = s.score ?? 0; });
  } else {
    Object.entries(entry.scores as Record<string, number | null>).forEach(([k, v]) => { map[k] = v ?? 0; });
  }
  return map;
}

function getAssessmentMax(assessment: { markSheet: MarkItem[] }): number {
  return assessment.markSheet.filter(i => !i.isSection).reduce((s, i) => s + (i.maxMark || 0), 0);
}

// ─── Tab: Student Management ──────────────────────────────────────────────────
function StudentMgmtTab({
  yearId, subjectId, classId,
  setYearId, setSubjectId, setClassId,
}: {
  yearId: string; subjectId: string; classId: string;
  setYearId: (v: string) => void;
  setSubjectId: (v: string) => void;
  setClassId: (v: string) => void;
}) {
  const {
    schoolYears, subjects, teachers,
    addSchoolYear, deleteSchoolYear,
    addSubjectToYear, removeSubjectFromYear, getGlobalSubject,
    addClass, deleteClass,
    addStudent, updateStudent, deleteStudent, importStudents,
    getSchoolYear, getYearSubject, getClass,
    addSubject, updateSubject, deleteSubject,
  } = useData();
  const { t, lang } = useI18n();

  // School Year panel
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearLabel, setNewYearLabel] = useState("");
  const [deleteYearId, setDeleteYearId] = useState<string | null>(null);

  // Subject panel
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [selectedSubjectToAdd, setSelectedSubjectToAdd] = useState("");
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);

  // Subject registry panel
  const [showAddGlobalSubject, setShowAddGlobalSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<typeof subjects[0] | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: "", nameCht: "", code: "", form: "S6" });
  const [deleteGlobalSubjectId, setDeleteGlobalSubjectId] = useState<string | null>(null);

  // Class panel
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassForm, setNewClassForm] = useState("S6");
  const [newClassTeacherId, setNewClassTeacherId] = useState(teachers[0]?.id ?? "");
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);

  // Student panel
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [newStuClassNo, setNewStuClassNo] = useState("");
  const [newStuName, setNewStuName] = useState("");
  const [newStuNameCht, setNewStuNameCht] = useState("");
  const [editStuId, setEditStuId] = useState<string | null>(null);
  const [editStuClassNo, setEditStuClassNo] = useState("");
  const [editStuName, setEditStuName] = useState("");
  const [editStuNameCht, setEditStuNameCht] = useState("");
  const [deleteStuId, setDeleteStuId] = useState<string | null>(null);

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const ys = yearId && subjectId ? getYearSubject(yearId, subjectId) : undefined;
  const cls = yearId && subjectId && classId ? getClass(yearId, subjectId, classId) : undefined;

  const linkedSubjectIds = year ? new Set(year.subjects.map(s => s.subjectId)) : new Set<string>();
  const availableSubjects = subjects.filter(s => !linkedSubjectIds.has(s.id));

  const sortedStudents = cls ? [...cls.students].sort((a, b) => a.classNo.localeCompare(b.classNo, undefined, { numeric: true })) : [];

  const handleAddYear = () => {
    if (!newYearLabel.trim()) return;
    addSchoolYear(newYearLabel.trim());
    setNewYearLabel(""); setShowAddYear(false);
    toast.success(t("saved"));
  };

  const handleAddSubjectToYear = () => {
    if (!yearId || !selectedSubjectToAdd) return;
    addSubjectToYear(yearId, selectedSubjectToAdd);
    setSelectedSubjectToAdd(""); setShowAddSubject(false);
    toast.success(t("saved"));
  };

  const handleSaveGlobalSubject = () => {
    if (!subjectForm.name.trim()) { toast.error(t("validationError")); return; }
    if (editingSubject) {
      updateSubject(editingSubject.id, { name: subjectForm.name.trim(), nameCht: subjectForm.nameCht.trim(), code: subjectForm.code.trim(), form: subjectForm.form.trim() });
    } else {
      addSubject({ name: subjectForm.name.trim(), nameCht: subjectForm.nameCht.trim(), code: subjectForm.code.trim(), form: subjectForm.form.trim() });
    }
    toast.success(t("saved")); setShowAddGlobalSubject(false); setEditingSubject(null);
  };

  const handleAddClass = () => {
    if (!yearId || !subjectId || !newClassName.trim()) return;
    addClass(yearId, subjectId, { name: newClassName.trim(), form: newClassForm, teacherId: newClassTeacherId });
    setNewClassName(""); setShowAddClass(false);
    toast.success(t("saved"));
  };

  const handleAddStudent = () => {
    if (!yearId || !subjectId || !classId || !newStuClassNo.trim() || !newStuName.trim()) return;
    addStudent(yearId, subjectId, classId, { classNo: newStuClassNo.trim(), name: newStuName.trim(), nameCht: newStuNameCht.trim() });
    setNewStuClassNo(""); setNewStuName(""); setNewStuNameCht("");
    setShowAddStudent(false); toast.success(t("saved"));
  };

  const handleImport = () => {
    if (!yearId || !subjectId || !classId) return;
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split(/\t|,/).map(p => p.trim());
      return { classNo: parts[0] || "", name: parts[1] || "", nameCht: parts[2] || "" };
    }).filter(p => p.classNo && p.name);
    if (parsed.length === 0) { toast.error(t("parseError")); return; }
    importStudents(yearId, subjectId, classId, parsed);
    setImportText(""); setShowImport(false);
    toast.success(`${t("saved")} (${parsed.length})`);
  };

  const startEditStu = (id: string, classNo: string, name: string, nameCht: string) => {
    setEditStuId(id); setEditStuClassNo(classNo); setEditStuName(name); setEditStuNameCht(nameCht);
  };

  const saveEditStu = () => {
    if (!yearId || !subjectId || !classId || !editStuId || !editStuClassNo.trim() || !editStuName.trim()) return;
    updateStudent(yearId, subjectId, classId, editStuId, { classNo: editStuClassNo.trim(), name: editStuName.trim(), nameCht: editStuNameCht.trim() });
    setEditStuId(null); toast.success(t("saved"));
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-xl font-bold text-slate-800">{lang === "zh" ? "學生管理" : "Student Management"}</h2>

      {/* ── Row 1: School Year + Subject + Class selectors ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* School Years */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("schoolYears")}</p>
            <Button size="sm" variant="ghost" onClick={() => setShowAddYear(true)} className="h-6 w-6 p-0"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="space-y-1">
            {schoolYears.map(y => (
              <div key={y.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors", yearId === y.id ? "bg-blue-500 text-white" : "hover:bg-slate-50 text-slate-700")} onClick={() => { setYearId(y.id); setSubjectId(""); setClassId(""); }}>
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span className="text-sm font-mono font-semibold flex-1">{y.label}</span>
                <button onClick={e => { e.stopPropagation(); setDeleteYearId(y.id); }} className={cn("p-0.5 rounded transition-colors", yearId === y.id ? "text-blue-200 hover:text-white" : "text-slate-300 hover:text-red-500")}><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
            {schoolYears.length === 0 && <p className="text-xs text-slate-400 italic px-2">{t("noData")}</p>}
          </div>
        </div>

        {/* Subjects */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("subjects")}</p>
            {year && <Button size="sm" variant="ghost" onClick={() => setShowAddSubject(true)} className="h-6 w-6 p-0" disabled={!yearId}><Plus className="w-3.5 h-3.5" /></Button>}
          </div>
          {!year ? (
            <p className="text-xs text-slate-400 italic px-2">{lang === "zh" ? "請先選擇學年" : "Select a school year first"}</p>
          ) : (
            <div className="space-y-1">
              {year.subjects.map(ys => {
                const sub = getGlobalSubject(ys.subjectId);
                if (!sub) return null;
                const displayName = lang === "zh" ? sub.nameCht : sub.name;
                return (
                  <div key={ys.subjectId} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors", subjectId === ys.subjectId ? "bg-blue-500 text-white" : "hover:bg-slate-50 text-slate-700")} onClick={() => { setSubjectId(ys.subjectId); setClassId(""); }}>
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-sm font-semibold flex-1 truncate">{displayName}</span>
                    <span className={cn("text-xs font-mono shrink-0", subjectId === ys.subjectId ? "text-blue-200" : "text-slate-400")}>{sub.code}</span>
                    <button onClick={e => { e.stopPropagation(); setDeleteSubjectId(ys.subjectId); }} className={cn("p-0.5 rounded transition-colors", subjectId === ys.subjectId ? "text-blue-200 hover:text-white" : "text-slate-300 hover:text-red-500")}><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })}
              {year.subjects.length === 0 && <p className="text-xs text-slate-400 italic px-2">{t("noData")}</p>}
            </div>
          )}
        </div>

        {/* Classes */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("classes")}</p>
            {ys && <Button size="sm" variant="ghost" onClick={() => setShowAddClass(true)} className="h-6 w-6 p-0" disabled={!subjectId}><Plus className="w-3.5 h-3.5" /></Button>}
          </div>
          {!ys ? (
            <p className="text-xs text-slate-400 italic px-2">{lang === "zh" ? "請先選擇科目" : "Select a subject first"}</p>
          ) : (
            <div className="space-y-1">
              {ys.classes.map(c => {
                const teacher = teachers.find(tc => tc.id === c.teacherId);
                const teacherName = teacher ? (lang === "zh" ? teacher.nameCht : teacher.name) : "";
                return (
                  <div key={c.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors", classId === c.id ? "bg-blue-500 text-white" : "hover:bg-slate-50 text-slate-700")} onClick={() => setClassId(c.id)}>
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-sm font-bold flex-1">{c.name}</span>
                    {teacherName && <span className={cn("text-xs shrink-0", classId === c.id ? "text-blue-200" : "text-slate-400")}>{teacherName}</span>}
                    <button onClick={e => { e.stopPropagation(); setDeleteClassId(c.id); }} className={cn("p-0.5 rounded transition-colors", classId === c.id ? "text-blue-200 hover:text-white" : "text-slate-300 hover:text-red-500")}><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })}
              {ys.classes.length === 0 && <p className="text-xs text-slate-400 italic px-2">{t("noData")}</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── Student roster ── */}
      {cls && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">{cls.name} — {sortedStudents.length} {t("students")}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)} className="gap-1 h-7 text-xs"><Upload className="w-3.5 h-3.5" />{t("import")}</Button>
              <Button size="sm" onClick={() => setShowAddStudent(true)} className="gap-1 h-7 text-xs"><Plus className="w-3.5 h-3.5" />{t("addStudent")}</Button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-4 py-2 text-left w-20 text-xs font-bold uppercase tracking-wider text-slate-500">{t("classNo")}</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{t("studentName")}</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{t("nameCht")}</th>
                  <th className="px-4 py-2 text-right w-24 text-xs font-bold uppercase tracking-wider text-slate-500">{t("edit")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm">{t("noData")}</td></tr>
                ) : sortedStudents.map(student => (
                  <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    {editStuId === student.id ? (
                      <>
                        <td className="px-3 py-2"><Input value={editStuClassNo} onChange={e => setEditStuClassNo(e.target.value)} className="h-7 text-xs font-mono w-16" /></td>
                        <td className="px-3 py-2"><Input value={editStuName} onChange={e => setEditStuName(e.target.value)} className="h-7 text-xs" /></td>
                        <td className="px-3 py-2"><Input value={editStuNameCht} onChange={e => setEditStuNameCht(e.target.value)} className="h-7 text-xs" onKeyDown={e => e.key === "Enter" && saveEditStu()} /></td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={saveEditStu} className="p-1 rounded text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditStuId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{student.classNo}</td>
                        <td className="px-4 py-2.5 text-slate-800 font-medium">{student.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{student.nameCht || <span className="text-slate-300 italic text-xs">—</span>}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => startEditStu(student.id, student.classNo, student.name, student.nameCht)} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteStuId(student.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Subject Registry ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">{lang === "zh" ? "全域科目登記冊" : "Global Subject Registry"}</p>
          <Button size="sm" onClick={() => { setEditingSubject(null); setSubjectForm({ name: "", nameCht: "", code: "", form: "S6" }); setShowAddGlobalSubject(true); }} className="gap-1 h-7 text-xs"><Plus className="w-3.5 h-3.5" />{t("addSubject")}</Button>
        </div>
        <div className="divide-y divide-slate-100">
          {subjects.map(sub => (
            <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{lang === "zh" ? sub.nameCht : sub.name}</p>
                <p className="text-xs text-slate-400 font-mono">{sub.code} · {sub.form} · {sub.topics.length} {t("topics")}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditingSubject(sub); setSubjectForm({ name: sub.name, nameCht: sub.nameCht, code: sub.code, form: sub.form }); setShowAddGlobalSubject(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteGlobalSubjectId(sub.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {subjects.length === 0 && <p className="px-4 py-4 text-sm text-slate-400 italic">{t("noData")}</p>}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showAddYear} onOpenChange={setShowAddYear}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addSchoolYear")}</DialogTitle></DialogHeader>
          <div className="py-2"><Label>{t("label")} (e.g. 2025-26)</Label><Input value={newYearLabel} onChange={e => setNewYearLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddYear()} autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddYear(false)}>{t("cancel")}</Button><Button onClick={handleAddYear} disabled={!newYearLabel.trim()}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteYearId} onOpenChange={() => setDeleteYearId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { deleteSchoolYear(deleteYearId!); if (yearId === deleteYearId) { setYearId(""); setSubjectId(""); setClassId(""); } setDeleteYearId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addSubject")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-xs text-slate-500">{lang === "zh" ? "從全域科目登記冊選擇科目連結至此學年。" : "Select a subject from the global registry to link to this school year."}</p>
            {availableSubjects.length === 0 ? (
              <p className="text-sm text-slate-400 italic">{lang === "zh" ? "所有科目已連結，或尚無科目。" : "All subjects are already linked, or no subjects exist."}</p>
            ) : (
              <Select value={selectedSubjectToAdd} onValueChange={setSelectedSubjectToAdd}>
                <SelectTrigger><SelectValue placeholder={lang === "zh" ? "選擇科目…" : "Select subject…"} /></SelectTrigger>
                <SelectContent>{availableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{lang === "zh" ? s.nameCht : s.name} ({s.code} · {s.form})</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddSubject(false)}>{t("cancel")}</Button><Button onClick={handleAddSubjectToYear} disabled={!selectedSubjectToAdd}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSubjectId} onOpenChange={() => setDeleteSubjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (yearId) removeSubjectFromYear(yearId, deleteSubjectId!); if (subjectId === deleteSubjectId) { setSubjectId(""); setClassId(""); } setDeleteSubjectId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddGlobalSubject} onOpenChange={setShowAddGlobalSubject}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingSubject ? t("edit") : t("addSubject")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t("name")} * (English)</Label><Input value={subjectForm.name} onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))} placeholder="Mathematics Extended Module 2" /></div>
            <div><Label>{t("nameCht")} (Chinese)</Label><Input value={subjectForm.nameCht} onChange={e => setSubjectForm(f => ({ ...f, nameCht: e.target.value }))} placeholder="數學延伸單元二" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><Label>{t("code")}</Label><Input value={subjectForm.code} onChange={e => setSubjectForm(f => ({ ...f, code: e.target.value }))} placeholder="M2" /></div>
              <div><Label>{t("form")}</Label><Select value={subjectForm.form} onValueChange={v => setSubjectForm(f => ({ ...f, form: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["S1","S2","S3","S4","S5","S6"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddGlobalSubject(false)}>{t("cancel")}</Button><Button onClick={handleSaveGlobalSubject}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGlobalSubjectId} onOpenChange={() => setDeleteGlobalSubjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { deleteSubject(deleteGlobalSubjectId!); setDeleteGlobalSubjectId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddClass} onOpenChange={setShowAddClass}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addClass")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{lang === "zh" ? "班別名稱" : "Class Name"} (e.g. 6A)</Label><Input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="6A" autoFocus onKeyDown={e => e.key === "Enter" && handleAddClass()} /></div>
            <div><Label>{t("form")}</Label><Select value={newClassForm} onValueChange={setNewClassForm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["S1","S2","S3","S4","S5","S6"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            {teachers.length > 0 && <div><Label>{t("teacher")}</Label><Select value={newClassTeacherId} onValueChange={setNewClassTeacherId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{teachers.map(tc => <SelectItem key={tc.id} value={tc.id}>{lang === "zh" ? tc.nameCht : tc.name} ({tc.code})</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddClass(false)}>{t("cancel")}</Button><Button onClick={handleAddClass} disabled={!newClassName.trim()}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteClassId} onOpenChange={() => setDeleteClassId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (yearId && subjectId) deleteClass(yearId, subjectId, deleteClassId!); if (classId === deleteClassId) setClassId(""); setDeleteClassId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("addStudent")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t("classNo")}</Label><Input value={newStuClassNo} onChange={e => setNewStuClassNo(e.target.value)} placeholder="01" autoFocus /></div>
            <div><Label>{t("studentName")} (English)</Label><Input value={newStuName} onChange={e => setNewStuName(e.target.value)} placeholder="Chan Tai Man" /></div>
            <div><Label>{t("nameCht")}</Label><Input value={newStuNameCht} onChange={e => setNewStuNameCht(e.target.value)} placeholder="陳大文" onKeyDown={e => e.key === "Enter" && handleAddStudent()} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddStudent(false)}>{t("cancel")}</Button><Button onClick={handleAddStudent} disabled={!newStuClassNo.trim() || !newStuName.trim()}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("import")} {t("students")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-xs text-slate-500">{t("importStudentsHint")}</p>
            <Textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={"01\tChan Tai Man\t陳大文\n02\tLee Siu Ming\t李小明"} rows={8} className="font-mono text-xs" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowImport(false)}>{t("cancel")}</Button><Button onClick={handleImport} disabled={!importText.trim()}>{t("import")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteStuId} onOpenChange={() => setDeleteStuId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (yearId && subjectId && classId) deleteStudent(yearId, subjectId, classId, deleteStuId!); setDeleteStuId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab: Score Entry (Grading) ───────────────────────────────────────────────
function GradingTab({
  yearId, subjectId, classId,
}: { yearId: string; subjectId: string; classId: string }) {
  const { getSchoolYear, getSubject, getClass, getAssessment, addAssessment, deleteAssessment, upsertScore, deleteScore, natures, teachers, getGlobalSubject, updateMarkSheet: updateMarkSheetCtx } = useData();
  const { t, lang } = useI18n();

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const subject = yearId && subjectId ? getSubject(yearId, subjectId) : undefined;
  const cls = yearId && subjectId && classId ? getClass(yearId, subjectId, classId) : undefined;

  const [assessmentId, setAssessmentId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, number | "">>({});
  const [dirty, setDirty] = useState(false);

  // Mark sheet editor state
  const [showMarkSheet, setShowMarkSheet] = useState(false);
  const [msItems, setMsItems] = useState<MarkItem[]>([]);
  const [parseText, setParseText] = useState("");
  const [quickCount, setQuickCount] = useState("10");
  const [msTab, setMsTab] = useState("editor");

  // Add assessment dialog
  const [showAddAssessment, setShowAddAssessment] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTitleCht, setNewTitleCht] = useState("");
  const [newTerm, setNewTerm] = useState<Term>("Term 1");
  const [newNatureId, setNewNatureId] = useState(natures[0]?.id ?? "");
  const [newTeacherId, setNewTeacherId] = useState(teachers[0]?.id ?? "");
  const [newDate, setNewDate] = useState("");
  const [deleteAssessmentId, setDeleteAssessmentId] = useState<string | null>(null);

  const assessment = yearId && subjectId && classId && assessmentId ? getAssessment(yearId, subjectId, classId, assessmentId) : undefined;
  const globalSubject = subjectId ? getGlobalSubject(subjectId) : undefined;
  const topics = globalSubject?.topics ?? [];

  const sortedStudents = cls ? [...cls.students].sort((a, b) => a.classNo.localeCompare(b.classNo, undefined, { numeric: true })) : [];
  const selectedStudent = sortedStudents.find(s => s.id === selectedStudentId) ?? null;
  const selectedIdx = sortedStudents.findIndex(s => s.id === selectedStudentId);

  // Load scores when student or assessment changes
  useState(() => {
    if (!assessment || !selectedStudentId) return;
    const existing = assessment.scores.find(s => s.studentId === selectedStudentId);
    if (existing) {
      const map: Record<string, number | ""> = {};
      if (Array.isArray(existing.scores)) {
        (existing.scores as Array<{ itemId: string; score: number | null }>).forEach(s => { map[s.itemId] = s.score ?? ""; });
      } else {
        Object.entries(existing.scores as Record<string, number | null>).forEach(([k, v]) => { map[k] = v ?? ""; });
      }
      setDraftScores(map);
    } else {
      setDraftScores({});
    }
    setDirty(false);
  });

  // Use useEffect properly
  const [lastStudentAssessment, setLastStudentAssessment] = useState("");
  const currentKey = `${selectedStudentId}|${assessmentId}`;
  if (currentKey !== lastStudentAssessment) {
    setLastStudentAssessment(currentKey);
    if (assessment && selectedStudentId) {
      const existing = assessment.scores.find(s => s.studentId === selectedStudentId);
      if (existing) {
        const map: Record<string, number | ""> = {};
        if (Array.isArray(existing.scores)) {
          (existing.scores as Array<{ itemId: string; score: number | null }>).forEach(s => { map[s.itemId] = s.score ?? ""; });
        } else {
          Object.entries(existing.scores as Record<string, number | null>).forEach(([k, v]) => { map[k] = v ?? ""; });
        }
        setDraftScores(map);
      } else {
        setDraftScores({});
      }
      setDirty(false);
    }
  }

  if (!year || !subject || !cls) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{lang === "zh" ? "請在側欄選擇學年、科目及班別" : "Select School Year, Subject and Class in the sidebar"}</p>
        </div>
      </div>
    );
  }

  const markSheet = assessment?.markSheet ?? [];
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
    if (!selectedStudentId || !yearId || !subjectId || !classId || !assessmentId) return;
    const scoreArr = questions.map(q => ({
      itemId: q.id,
      score: typeof draftScores[q.id] === "number" ? (draftScores[q.id] as number) : 0,
    }));
    upsertScore(yearId, subjectId, classId, assessmentId, { studentId: selectedStudentId, scores: scoreArr as any });
    setDirty(false);
    toast.success(t("saved"));
  };

  const handleAutoSave = () => { if (dirty) handleSave(); };

  const handleClear = () => {
    if (!selectedStudentId || !yearId || !subjectId || !classId || !assessmentId) return;
    deleteScore(yearId, subjectId, classId, assessmentId, selectedStudentId);
    setDraftScores({});
    setDirty(false);
    toast.success(t("deleted"));
  };

  const navigateStudent = (dir: -1 | 1) => {
    if (dirty) handleSave();
    if (!selectedStudentId) { setSelectedStudentId(sortedStudents[0]?.id ?? null); return; }
    const idx = sortedStudents.findIndex(s => s.id === selectedStudentId);
    const next = sortedStudents[idx + dir];
    if (next) setSelectedStudentId(next.id);
  };

  const getStudentTotal = (studentId: string) => {
    if (!assessment) return null;
    return getScoreTotal(assessment, studentId);
  };

  // Group mark sheet by section
  const groups: Array<{ sectionLabel?: string; questions: typeof questions }> = [];
  let curGroup: { sectionLabel?: string; questions: typeof questions } = { questions: [] };
  markSheet.forEach(item => {
    if (item.isSection) {
      if (curGroup.questions.length > 0 || curGroup.sectionLabel) groups.push(curGroup);
      curGroup = { sectionLabel: item.label, questions: [] };
    } else {
      curGroup.questions.push(item);
    }
  });
  if (curGroup.questions.length > 0 || curGroup.sectionLabel) groups.push(curGroup);

  const handleAddAssessment = () => {
    if (!yearId || !subjectId || !classId || !newTitle.trim() || !newNatureId) return;
    const na = addAssessment(yearId, subjectId, classId, {
      code: newCode.trim(), title: newTitle.trim(), titleCht: newTitleCht.trim(),
      term: newTerm, natureId: newNatureId, teacherId: newTeacherId, date: newDate, topicIds: [],
    });
    setAssessmentId(na.id);
    setNewCode(""); setNewTitle(""); setNewTitleCht(""); setNewDate("");
    setShowAddAssessment(false);
    toast.success(t("saved"));
  };

  // Mark sheet editor
  const openMarkSheet = () => {
    if (!assessment) return;
    setMsItems(assessment.markSheet.map(i => ({ ...i })));
    setShowMarkSheet(true);
  };

  const handleSaveMarkSheet = () => {
    if (!yearId || !subjectId || !classId || !assessmentId) return;
    const { updateMarkSheet } = useData();
    const errors = validateMarkSheet(msItems);
    if (errors.length > 0) { toast.error(errors[0]); return; }
    updateMarkSheet(yearId, subjectId, classId, assessmentId, msItems);
    toast.success(t("saved"));
    setShowMarkSheet(false);
  };

  const assessTitle = assessment ? (lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title) : "";

  return (
    <div className="h-full flex flex-col">
      {/* Assessment selector bar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-500 shrink-0">{t("assessment")}:</span>
          <Select value={assessmentId} onValueChange={setAssessmentId}>
            <SelectTrigger className="h-8 text-sm flex-1 max-w-xs">
              <SelectValue placeholder={lang === "zh" ? "選擇評估…" : "Select assessment…"} />
            </SelectTrigger>
            <SelectContent>
              {cls.assessments.map(a => {
                const nat = natures.find(n => n.id === a.natureId);
                const title = lang === "zh" && a.titleCht ? a.titleCht : a.title;
                return <SelectItem key={a.id} value={a.id}>{a.code ? `[${a.code}] ` : ""}{title}{nat ? ` (${lang === "zh" ? nat.nameCht : nat.name})` : ""}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setShowAddAssessment(true)} className="gap-1 h-8 text-xs shrink-0"><Plus className="w-3.5 h-3.5" />{t("addAssessment")}</Button>
          {assessment && (
            <Button size="sm" variant="outline" onClick={openMarkSheet} className="gap-1 h-8 text-xs shrink-0"><FileEdit className="w-3.5 h-3.5" />{t("editMarkSheet")}</Button>
          )}
          {assessment && (
            <button onClick={() => setDeleteAssessmentId(assessment.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
        {assessment && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{t("total")}: {maxTotal}</span>
            <span>·</span>
            <span>{assessment.scores.length}/{cls.students.length} {t("graded")}</span>
          </div>
        )}
      </div>

      {!assessment ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{lang === "zh" ? "請選擇或新增評估" : "Select or add an assessment above"}</p>
          </div>
        </div>
      ) : markSheet.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-amber-600 font-medium mb-3">⚠ {lang === "zh" ? "尚未設定評分表。" : "No mark sheet configured yet."}</p>
            <Button onClick={openMarkSheet} variant="outline" className="gap-1.5"><FileEdit className="w-4 h-4" />{t("editMarkSheet")}</Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden">
          {/* ── Left: Student list ── */}
          <div className="md:w-64 w-full md:shrink-0 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col overflow-hidden bg-white" style={{ maxHeight: 'clamp(200px, 50vh, 400px)' }}>
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 hidden md:block">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("students")} ({sortedStudents.length})</p>
            </div>
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 md:hidden flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("students")} ({sortedStudents.length})</p>
              <p className="text-xs text-slate-400">{lang === "zh" ? "滞動選擇" : "Scroll to select"}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedStudents.map(student => {
                const total = getStudentTotal(student.id);
                const isSelected = selectedStudentId === student.id;
                const isGraded = total !== null;
                const displayName = lang === "zh" && student.nameCht ? student.nameCht : student.name;
                return (
                  <button key={student.id} onClick={() => setSelectedStudentId(student.id)} className={cn("w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors", isSelected ? "bg-blue-600 text-white" : "hover:bg-slate-50")}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn("text-xs font-mono shrink-0", isSelected ? "text-blue-200" : "text-slate-400")}>{student.classNo}</span>
                        <span className={cn("text-sm font-semibold truncate", isSelected ? "text-white" : "text-slate-800")}>{displayName}</span>
                      </div>
                      {isGraded && <span className={cn("text-xs font-mono font-bold shrink-0", isSelected ? "text-blue-100" : "text-blue-600")}>{total}/{maxTotal}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Score entry ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {!selectedStudent ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">{t("selectStudentPrompt")}</div>
            ) : (
              <>
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigateStudent(-1)} disabled={selectedIdx <= 0} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                    <div>
                      <span className="font-mono text-xs text-slate-400">{selectedStudent.classNo}</span>
                      <span className="font-bold text-slate-800 ml-2">{lang === "zh" && selectedStudent.nameCht ? selectedStudent.nameCht : selectedStudent.name}</span>
                    </div>
                    <button onClick={() => navigateStudent(1)} disabled={selectedIdx >= sortedStudents.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                    <span className="text-xs text-slate-400">{selectedIdx + 1}/{sortedStudents.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold font-mono text-blue-600 leading-none">{currentTotal}</p>
                      <p className="text-xs text-slate-400">/ {maxTotal}{maxTotal > 0 ? ` (${Math.round((currentTotal / maxTotal) * 100)}%)` : ""}</p>
                    </div>
                    <button onClick={handleClear} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title={t("clearRecord")}><Trash2 className="w-4 h-4" /></button>
                    <Button size="sm" onClick={handleSave} disabled={!dirty} className="gap-1.5 h-8 text-xs"><Save className="w-3.5 h-3.5" />{t("save")}</Button>
                  </div>
                </div>

                {/* Score cards */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {groups.map((group, gi) => {
                    // Compute section earned / max
                    const sectionMax = group.questions.reduce((s, q) => s + (q.maxMark || 0), 0);
                    const sectionEarned = group.questions.reduce((s, q) => {
                      const v = draftScores[q.id];
                      return s + (typeof v === "number" ? v : 0);
                    }, 0);
                    return (
                    <div key={gi}>
                      {group.sectionLabel && (
                        <div className="mb-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{group.sectionLabel}</p>
                          <span className="text-xs font-mono font-bold text-blue-600">{sectionEarned} / {sectionMax}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {group.questions.map(item => {
                          const val = draftScores[item.id];
                          const numVal = typeof val === "number" ? val : NaN;
                          const isOver = !isNaN(numVal) && numVal > item.maxMark;
                          const isNeg = !isNaN(numVal) && numVal < 0;
                          const hasVal = val !== "" && !isNaN(numVal);
                          const topic = item.topicId ? topics.find(tp => tp.id === item.topicId) : null;
                          return (
                            <div key={item.id} className={cn("rounded-lg border-2 p-2 transition-all flex flex-col gap-1", isOver || isNeg ? "border-red-300 bg-red-50" : hasVal ? "border-green-300 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300")}>
                              <p className="text-xs font-mono font-bold text-slate-600 truncate">{item.label}</p>
                              <div className="flex items-center gap-0.5">
                                <Input
                                  type="number"
                                  min={0}
                                  max={item.maxMark}
                                  step={0.5}
                                  value={val === "" ? "" : (val ?? "")}
                                  onChange={e => handleScoreChange(item.id, e.target.value)}
                                  onBlur={handleAutoSave}
                                  className={cn("h-8 text-center font-mono text-sm font-bold border-0 bg-transparent p-0 focus-visible:ring-0", isOver || isNeg ? "text-red-600" : hasVal ? "text-green-700" : "text-slate-800")}
                                  placeholder="—"
                                />
                                <span className="text-[10px] text-slate-400 shrink-0">/{item.maxMark}</span>
                              </div>
                              {topic && (
                                <span className="text-[9px] leading-tight font-medium px-1 py-0.5 rounded truncate" style={{ backgroundColor: topic.color ? topic.color + "22" : "#e0e7ff", color: topic.color || "#4f46e5" }}>{lang === "zh" && topic.nameCht ? topic.nameCht : topic.name}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Footer nav */}
                <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => navigateStudent(-1)} disabled={selectedIdx <= 0} className="gap-1 text-xs h-7"><ChevronLeft className="w-3.5 h-3.5" />{t("prev")}</Button>
                  <span className="text-xs text-slate-400">{selectedIdx + 1}/{sortedStudents.length}</span>
                  <Button variant="outline" size="sm" onClick={() => navigateStudent(1)} disabled={selectedIdx >= sortedStudents.length - 1} className="gap-1 text-xs h-7">{t("next")}<ChevronRight className="w-3.5 h-3.5" /></Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Assessment Dialog */}
      <Dialog open={showAddAssessment} onOpenChange={setShowAddAssessment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("addAssessment")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t("code")} (e.g. T1Q1)</Label><Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="T1Q1" autoFocus /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
            </div>
            <div><Label>{t("title")} (English)</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Quiz 1 — Differentiation" /></div>
            <div><Label>{t("titleCht")}</Label><Input value={newTitleCht} onChange={e => setNewTitleCht(e.target.value)} placeholder="小測一 — 微分" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t("term")}</Label><Select value={newTerm} onValueChange={v => setNewTerm(v as Term)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Term 1">{t("term1")}</SelectItem><SelectItem value="Term 2">{t("term2")}</SelectItem><SelectItem value="Full Year">{t("fullYear")}</SelectItem></SelectContent></Select></div>
              <div><Label>{t("nature")}</Label><Select value={newNatureId} onValueChange={setNewNatureId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{natures.map(n => <SelectItem key={n.id} value={n.id}>{lang === "zh" ? n.nameCht : n.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>{t("teacher")}</Label><Select value={newTeacherId} onValueChange={setNewTeacherId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{teachers.map(tc => <SelectItem key={tc.id} value={tc.id}>{lang === "zh" ? tc.nameCht : tc.name} ({tc.code})</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddAssessment(false)}>{t("cancel")}</Button><Button onClick={handleAddAssessment} disabled={!newTitle.trim() || !newNatureId}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAssessmentId} onOpenChange={() => setDeleteAssessmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (yearId && subjectId && classId) { deleteAssessment(yearId, subjectId, classId, deleteAssessmentId!); if (assessmentId === deleteAssessmentId) setAssessmentId(""); } setDeleteAssessmentId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Sheet Editor Dialog */}
      <Dialog open={showMarkSheet} onOpenChange={setShowMarkSheet}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{t("editMarkSheet")} — {assessTitle}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <MarkSheetEditor
            items={msItems}
              setItems={setMsItems}
              topics={topics}
              lang={lang}
              parseText={parseText}
              setParseText={setParseText}
              quickCount={quickCount}
              setQuickCount={setQuickCount}
              msTab={msTab}
              setMsTab={setMsTab}
              t={t as (k: string) => string}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkSheet(false)}>{t("cancel")}</Button>
            <Button onClick={() => {
              if (!yearId || !subjectId || !classId || !assessmentId) return;
              const errors = validateMarkSheet(msItems);
              if (errors.length > 0) { toast.error(errors[0]); return; }
              updateMarkSheetCtx(yearId, subjectId, classId, assessmentId, msItems);
              toast.success(t("saved"));
              setShowMarkSheet(false);
            }}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Mark Sheet Editor (inline component) ────────────────────────────────────
function MarkSheetEditorDialog({
  yearId, subjectId, classId, assessmentId,
  onClose,
}: {
  yearId: string; subjectId: string; classId: string; assessmentId: string;
  onClose: () => void;
}) {
  const { getAssessment, updateMarkSheet, getGlobalSubject } = useData();
  const { t, lang } = useI18n();
  const assessment = getAssessment(yearId, subjectId, classId, assessmentId);
  const globalSubject = getGlobalSubject(subjectId);
  const topics = globalSubject?.topics ?? [];

  const [items, setItems] = useState<MarkItem[]>(() => assessment?.markSheet.map(i => ({ ...i })) ?? []);
  const [parseText, setParseText] = useState("");
  const [quickCount, setQuickCount] = useState("10");
  const [activeTab, setActiveTab] = useState("editor");

  const handleSave = () => {
    const errors = validateMarkSheet(items);
    if (errors.length > 0) { toast.error(errors[0]); return; }
    updateMarkSheet(yearId, subjectId, classId, assessmentId, items);
    toast.success(t("saved"));
    onClose();
  };

  const assessTitle = assessment ? (lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title) : "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>{t("editMarkSheet")} — {assessTitle}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <MarkSheetEditor items={items} setItems={setItems} topics={topics} lang={lang} parseText={parseText} setParseText={setParseText} quickCount={quickCount} setQuickCount={setQuickCount} msTab={activeTab} setMsTab={setActiveTab} t={t as (k: string) => string} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={handleSave}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkSheetEditor({
  items, setItems, topics, lang, parseText, setParseText, quickCount, setQuickCount, msTab, setMsTab, t,
}: {
  items: MarkItem[];
  setItems: React.Dispatch<React.SetStateAction<MarkItem[]>>;
  topics: Topic[];
  lang: string;
  parseText: string;
  setParseText: (v: string) => void;
  quickCount: string;
  setQuickCount: (v: string) => void;
  msTab: string;
  setMsTab: (v: string) => void;
  t: (k: string) => string;
}) {
  const maxTotal = totalMaxMarks(items);

  const addRow = (isSection = false) => {
    setItems(prev => [...prev, { id: nanoid(), label: isSection ? "Section A" : "", maxMark: 0, isSection }]);
  };
  const removeRow = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setItems(prev => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; });
  };
  const moveDown = (idx: number) => {
    setItems(prev => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a; });
  };
  const updateItem = (id: string, field: keyof MarkItem, value: string | number | boolean | undefined) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };
  const toggleSection = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isSection: !i.isSection, maxMark: 0, topicId: undefined } : i));
  };
  const handleParse = () => {
    const parsed = parseMarkSheetText(parseText);
    if (parsed.length === 0) { toast.error(t("parseError")); return; }
    setItems(parsed);
    toast.success(t("parseSuccess"));
  };
  const handleQuickGenerate = () => {
    const n = parseInt(quickCount) || 10;
    const generated: MarkItem[] = Array.from({ length: n }, (_, i) => ({ id: nanoid(), label: String(i + 1), maxMark: 0, isSection: false }));
    setItems(generated);
    toast.success(t("parseSuccess"));
  };

  return (
    <Tabs value={msTab} onValueChange={setMsTab}>
      <div className="overflow-x-auto">
        <TabsList className="mb-3 w-max">
          <TabsTrigger value="editor">{t("markScheme")}</TabsTrigger>
          <TabsTrigger value="parse"><FileText className="w-3.5 h-3.5 mr-1" />{t("parseFromText")}</TabsTrigger>
          <TabsTrigger value="quick"><Wand2 className="w-3.5 h-3.5 mr-1" />{t("quickGenerate")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="editor">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <div className={`grid gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500 min-w-[480px] ${topics.length > 0 ? "grid-cols-[2rem_1fr_6rem_7rem_6rem_2rem_2rem]" : "grid-cols-[2rem_1fr_6rem_6rem_2rem_2rem]"}`}>
            <span>#</span><span>{t("label")}</span><span className="text-center">{t("maxMark")}</span>
            {topics.length > 0 && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{t("topicTag")}</span>}
            <span className="text-center">Section?</span><span></span><span></span>
          </div>
          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">{t("noData")}</div>
          ) : (
            items.map((item, idx) => (
              <div key={item.id} className={`grid gap-2 px-3 py-1.5 items-center border-b border-slate-100 last:border-0 min-w-[480px] ${topics.length > 0 ? "grid-cols-[2rem_1fr_6rem_7rem_6rem_2rem_2rem]" : "grid-cols-[2rem_1fr_6rem_6rem_2rem_2rem]"} ${item.isSection ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                <span className="text-xs text-slate-400 font-mono text-center">{idx + 1}</span>
                <Input value={item.label} onChange={e => updateItem(item.id, "label", e.target.value)} className={`h-7 text-sm font-mono ${item.isSection ? "font-bold bg-blue-50 text-blue-700" : ""}`} placeholder={item.isSection ? "Section A" : "2(a)"} />
                <Input type="number" min={0} value={item.isSection ? "" : item.maxMark} onChange={e => updateItem(item.id, "maxMark", parseFloat(e.target.value) || 0)} disabled={item.isSection} className="h-7 text-sm font-mono text-center" placeholder="0" />
                {topics.length > 0 && (() => {
                  // Group topics by Level → Learning Unit for grouped display
                  const hasSyllabus = topics.some(tp => tp.learningObjective);
                  if (!hasSyllabus) {
                    // Flat list for manually-created topics
                    return (
                      <Select value={item.topicId ?? "none"} onValueChange={v => updateItem(item.id, "topicId", v === "none" ? undefined : v)} disabled={item.isSection}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {topics.map(tp => <SelectItem key={tp.id} value={tp.id}>{tp.code ? `${tp.code} ` : ""}{lang === "zh" && tp.nameCht ? tp.nameCht : tp.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  }
                  // Grouped by Level → Learning Unit
                  const levels = Array.from(new Set(topics.map(tp => tp.level || "Other")));
                  return (
                    <Select value={item.topicId ?? "none"} onValueChange={v => updateItem(item.id, "topicId", v === "none" ? undefined : v)} disabled={item.isSection}>
                      <SelectTrigger className="h-7 text-xs min-w-0">
                        <SelectValue placeholder="—">
                          {item.topicId ? (() => {
                            const tp = topics.find(t => t.id === item.topicId);
                            if (!tp) return "—";
                            return <span className="truncate text-xs">{tp.learningObjective ?? tp.name}</span>;
                          })() : "—"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-w-xs">
                        <SelectItem value="none">— {lang === "zh" ? "無" : "None"}</SelectItem>
                        {levels.map(level => {
                          const levelTopics = topics.filter(tp => (tp.level || "Other") === level);
                          const units = Array.from(new Set(levelTopics.map(tp => tp.learningUnit || "")));
                          return units.map(unit => (
                            <SelectGroup key={`${level}-${unit}`}>
                              <SelectLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
                                {level}{unit ? ` › ${unit}` : ""}
                              </SelectLabel>
                              {levelTopics.filter(tp => (tp.learningUnit || "") === unit).map(tp => (
                                <SelectItem key={tp.id} value={tp.id} className="text-xs py-1">
                                  <span className="truncate">{tp.learningObjective ?? tp.name}</span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ));
                        })}
                      </SelectContent>
                    </Select>
                  );
                })()}
                <div className="flex justify-center"><input type="checkbox" checked={!!item.isSection} onChange={() => toggleSection(item.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" /></div>
                <button onClick={() => moveUp(idx)} className="p-0.5 rounded text-slate-300 hover:text-slate-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeRow(item.id)} className="p-0.5 rounded text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))
          )}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addRow(false)} className="gap-1 text-xs h-7"><Plus className="w-3.5 h-3.5" />{t("questionRow")}</Button>
              <Button size="sm" variant="outline" onClick={() => addRow(true)} className="gap-1 text-xs h-7"><Plus className="w-3.5 h-3.5" />{t("sectionRow")}</Button>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">{t("total")}: {maxTotal}</span>
          </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="parse">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs text-slate-500 whitespace-pre-line">{t("markSheetHint")}</p>
          <Textarea value={parseText} onChange={e => setParseText(e.target.value)} rows={10} className="font-mono text-sm" placeholder={"1  5\n2(a)  3\n2(b)  4\nSection B\n6(a)(i)  2\n6(a)(ii)  3\nTotal"} />
          <Button onClick={handleParse} disabled={!parseText.trim()} className="gap-1.5"><Wand2 className="w-4 h-4" />{t("parseFromText")}</Button>
        </div>
      </TabsContent>

      <TabsContent value="quick">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 max-w-xs">
          <p className="text-sm text-slate-600">{t("numQuestions")}</p>
          <Input type="number" min={1} max={50} value={quickCount} onChange={e => setQuickCount(e.target.value)} className="font-mono w-32" />
          <Button onClick={handleQuickGenerate} className="gap-1.5"><Wand2 className="w-4 h-4" />{t("generate")}</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ─── Tab: Weakness Analysis ───────────────────────────────────────────────────
function WeaknessTab({ yearId, subjectId, classId }: { yearId: string; subjectId: string; classId: string }) {
  const { getSchoolYear, getSubject, getClass, getGlobalSubject, getNature } = useData();
  const { t, lang } = useI18n();

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const subject = yearId && subjectId ? getSubject(yearId, subjectId) : undefined;
  const cls = yearId && subjectId && classId ? getClass(yearId, subjectId, classId) : undefined;
  const globalSubject = subjectId ? getGlobalSubject(subjectId) : undefined;

  if (!year || !subject || !cls) {
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">{lang === "zh" ? "請在側欄選擇學年、科目及班別" : "Select School Year, Subject and Class in the sidebar"}</div>;
  }

  const topics = globalSubject?.topics ?? [];
  const assessments = cls.assessments ?? [];
  const students = cls.students ?? [];

  const topicData = topics.map(topic => {
    let totalEarned = 0, totalMax = 0;
    assessments.forEach(assessment => {
      const topicItems = assessment.markSheet.filter(i => !i.isSection && i.topicId === topic.id);
      if (topicItems.length === 0) return;
      assessment.scores.forEach((scoreEntry: ScoreEntry) => {
        const scoreMap = getScoreMap(assessment, scoreEntry.studentId);
        topicItems.forEach(item => {
          totalEarned += scoreMap[item.id] ?? 0;
          totalMax += item.maxMark || 0;
        });
      });
    });
    const pct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : null;
    return {
      id: topic.id,
      name: lang === "zh" && topic.nameCht ? topic.nameCht : topic.name,
      code: topic.code,
      pct,
      status: pct === null ? "none" : pct >= 70 ? "strong" : pct >= 50 ? "average" : "weak",
    };
  });

  const caAssessments = assessments.filter(a => { const n = getNature(a.natureId ?? ""); return n && !n.isExam; });
  const examAssessments = assessments.filter(a => { const n = getNature(a.natureId ?? ""); return n && n.isExam; });

  const studentSummary = students.map(student => {
    let caTotalEarned = 0, caTotalMax = 0;
    caAssessments.forEach(a => { const t = getScoreTotal(a, student.id); if (t !== null) { caTotalEarned += t; caTotalMax += getAssessmentMax(a); } });
    let examTotalEarned = 0, examTotalMax = 0;
    examAssessments.forEach(a => { const t = getScoreTotal(a, student.id); if (t !== null) { examTotalEarned += t; examTotalMax += getAssessmentMax(a); } });
    return {
      student,
      caPct: caTotalMax > 0 ? Math.round((caTotalEarned / caTotalMax) * 100) : null,
      examPct: examTotalMax > 0 ? Math.round((examTotalEarned / examTotalMax) * 100) : null,
      caTotalEarned, caTotalMax, examTotalEarned, examTotalMax,
    };
  }).sort((a, b) => ((b.caPct ?? 0) + (b.examPct ?? 0)) - ((a.caPct ?? 0) + (a.examPct ?? 0)));

  const colorForStatus = (status: string) => status === "strong" ? "#22c55e" : status === "average" ? "#f59e0b" : status === "weak" ? "#ef4444" : "#94a3b8";

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-bold text-slate-800">{lang === "zh" ? "弱點分析" : "Weakness Analysis"} — {cls.name}</h2>

      <Tabs defaultValue="topics">
        <div className="overflow-x-auto mb-4">
          <TabsList className="w-max">
            <TabsTrigger value="topics">{t("topicPerformance")}</TabsTrigger>
            <TabsTrigger value="summary">{t("classSummary")}</TabsTrigger>
            <TabsTrigger value="questions">{t("questionAnalysis")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="topics">
          {topics.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">{t("noTopicsYet")}</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3">{t("topicPerformance")} (%)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicData.filter(d => d.pct !== null)} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, t("classAverage")]} />
                    <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "70%", fontSize: 9, fill: "#22c55e" }} />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "50%", fontSize: 9, fill: "#f59e0b" }} />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                      {topicData.filter(d => d.pct !== null).map((entry, i) => <Cell key={i} fill={colorForStatus(entry.status)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topicData.map(topic => (
                  <div key={topic.id} className={cn("bg-white rounded-xl border-2 p-4", topic.status === "strong" ? "border-green-200" : topic.status === "average" ? "border-amber-200" : topic.status === "weak" ? "border-red-200" : "border-slate-200")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>{topic.code && <p className="text-xs font-mono text-slate-400">{topic.code}</p>}<p className="text-sm font-bold text-slate-800 mt-0.5">{topic.name}</p></div>
                      <div className="text-right shrink-0">
                        {topic.pct !== null ? (
                          <><p className={cn("text-2xl font-bold font-mono", topic.status === "strong" ? "text-green-600" : topic.status === "average" ? "text-amber-600" : "text-red-600")}>{topic.pct}%</p><p className={cn("text-xs font-semibold", topic.status === "strong" ? "text-green-500" : topic.status === "average" ? "text-amber-500" : "text-red-500")}>{topic.status === "strong" ? t("strong") : topic.status === "average" ? t("average") : t("weak")}</p></>
                        ) : <p className="text-xs text-slate-400">{t("notSet")}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">{t("studentName")}</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">{t("caAssessments")}</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">{t("examAssessments")}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSummary.map((row, i) => {
                    const displayName = lang === "zh" && row.student.nameCht ? row.student.nameCht : row.student.name;
                    return (
                      <tr key={row.student.id} className={cn("border-b border-slate-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                        <td className="px-3 py-2 text-xs font-mono text-slate-400">{row.student.classNo}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{displayName}</td>
                        <td className="px-3 py-2 text-center">
                          {row.caPct !== null ? <span className={cn("font-mono font-bold", row.caPct >= 70 ? "text-green-600" : row.caPct >= 50 ? "text-amber-600" : "text-red-600")}>{row.caTotalEarned}/{row.caTotalMax} ({row.caPct}%)</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.examPct !== null ? <span className={cn("font-mono font-bold", row.examPct >= 70 ? "text-green-600" : row.examPct >= 50 ? "text-amber-600" : "text-red-600")}>{row.examTotalEarned}/{row.examTotalMax} ({row.examPct}%)</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="questions">
          <div className="space-y-4">
            {assessments.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">{t("noAssessmentsYet")}</div>
            ) : assessments.map(assessment => {
              const questions = assessment.markSheet.filter(i => !i.isSection);
              if (questions.length === 0) return null;
              const assessTitle = lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title;
              const qData = questions.map(q => {
                const scores: number[] = [];
                assessment.scores.forEach((entry: ScoreEntry) => {
                  const scoreMap = getScoreMap(assessment, entry.studentId);
                  scores.push(scoreMap[q.id] ?? 0);
                });
                const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                const pct = q.maxMark > 0 ? Math.round((avg / q.maxMark) * 100) : 0;
                return { label: q.label, avg: Math.round(avg * 10) / 10, maxMark: q.maxMark, pct };
              });
              return (
                <div key={assessment.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200"><p className="text-sm font-bold text-slate-700">{assessTitle}</p></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100"><th className="text-left px-3 py-2 text-xs font-bold text-slate-500">{t("questionLabel")}</th><th className="text-center px-3 py-2 text-xs font-bold text-slate-500">{t("maxMark")}</th><th className="text-center px-3 py-2 text-xs font-bold text-slate-500">{t("avgMark")}</th><th className="text-center px-3 py-2 text-xs font-bold text-slate-500">%</th></tr></thead>
                      <tbody>
                        {qData.map((q, i) => (
                          <tr key={i} className={cn("border-b border-slate-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                            <td className="px-3 py-1.5 font-mono font-bold text-slate-700">{q.label}</td>
                            <td className="px-3 py-1.5 text-center font-mono text-slate-500">{q.maxMark}</td>
                            <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-800">{q.avg}</td>
                            <td className="px-3 py-1.5 text-center"><span className={cn("font-mono font-bold", q.pct >= 70 ? "text-green-600" : q.pct >= 50 ? "text-amber-600" : "text-red-600")}>{q.pct}%</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab: Summary Table ───────────────────────────────────────────────────────
function SummaryTab({ yearId, subjectId, classId }: { yearId: string; subjectId: string; classId: string }) {
  const { getSchoolYear, getSubject, getClass, getNature } = useData();
  const { t, lang } = useI18n();

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const subject = yearId && subjectId ? getSubject(yearId, subjectId) : undefined;
  const cls = yearId && subjectId && classId ? getClass(yearId, subjectId, classId) : undefined;

  const [copied, setCopied] = useState(false);

  if (!year || !subject || !cls) {
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">{lang === "zh" ? "請在側欄選擇學年、科目及班別" : "Select School Year, Subject and Class in the sidebar"}</div>;
  }

  const assessments = cls.assessments ?? [];
  const sortedStudents = [...cls.students].sort((a, b) => a.classNo.localeCompare(b.classNo, undefined, { numeric: true }));

  // Per assessment, per student totals
  const assessData = assessments.map(a => {
    const max = getAssessmentMax(a);
    const nature = getNature(a.natureId ?? "");
    const title = lang === "zh" && a.titleCht ? a.titleCht : a.title;
    return {
      id: a.id,
      title,
      code: a.code,
      max,
      isExam: nature?.isExam ?? false,
      natureName: nature ? (lang === "zh" ? nature.nameCht : nature.name) : "",
    };
  });

  const getStudentAssessmentTotal = (studentId: string, assessmentId: string) => {
    const a = assessments.find(x => x.id === assessmentId);
    if (!a) return null;
    return getScoreTotal(a, studentId);
  };

  const handleExportCSV = () => {
    const rows: string[][] = [];
    rows.push(["#", "Name", ...assessData.map(a => `${a.code || a.title} (/${a.max})`)]);
    sortedStudents.forEach(s => {
      rows.push([s.classNo, lang === "zh" && s.nameCht ? s.nameCht : s.name, ...assessData.map(a => {
        const t = getStudentAssessmentTotal(s.id, a.id);
        return t !== null ? String(t) : "";
      })]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cls.name}_summary.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("exportCSV"));
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">{lang === "zh" ? "統測/大考總表" : "Summary Table"} — {cls.name}</h2>
        <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5"><Download className="w-4 h-4" />{t("exportCSV")}</Button>
      </div>

      {assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">{t("noAssessmentsYet")}</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 w-10">#</th>
                <th className="px-3 py-2 text-left sticky left-10 bg-slate-50 min-w-[120px]">{t("studentName")}</th>
                {assessData.map(a => (
                  <th key={a.id} className="px-2 py-2 text-center min-w-[70px]">
                    <div className="font-mono font-bold">{a.code || a.title}</div>
                    <div className="text-slate-400 font-normal">/{a.max}</div>
                    {a.isExam && <div className="text-red-500 text-[9px]">Exam</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student, idx) => {
                const displayName = lang === "zh" && student.nameCht ? student.nameCht : student.name;
                return (
                  <tr key={student.id} className={cn("border-b border-slate-100 last:border-0", idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                    <td className="px-3 py-2 font-mono text-slate-400 sticky left-0 bg-inherit">{student.classNo}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 sticky left-10 bg-inherit">{displayName}</td>
                    {assessData.map(a => {
                      const total = getStudentAssessmentTotal(student.id, a.id);
                      const pct = total !== null && a.max > 0 ? Math.round((total / a.max) * 100) : null;
                      return (
                        <td key={a.id} className="px-2 py-2 text-center">
                          {total !== null ? (
                            <div>
                              <span className={cn("font-mono font-bold", pct !== null && pct >= 70 ? "text-green-600" : pct !== null && pct >= 50 ? "text-amber-600" : "text-red-600")}>{total}</span>
                              {pct !== null && <span className="text-slate-400 text-[10px] ml-0.5">({pct}%)</span>}
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Topic Chart Analysis ────────────────────────────────────────────────
function ChartTab({ yearId, subjectId, classId }: { yearId: string; subjectId: string; classId: string }) {
  const { getSchoolYear, getSubject, getClass, getGlobalSubject } = useData();
  const { t, lang } = useI18n();

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const subject = yearId && subjectId ? getSubject(yearId, subjectId) : undefined;
  const cls = yearId && subjectId && classId ? getClass(yearId, subjectId, classId) : undefined;
  const globalSubject = subjectId ? getGlobalSubject(subjectId) : undefined;

  if (!year || !subject || !cls) {
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">{lang === "zh" ? "請在側欄選擇學年、科目及班別" : "Select School Year, Subject and Class in the sidebar"}</div>;
  }

  const topics = globalSubject?.topics ?? [];
  const assessments = cls.assessments ?? [];

  const topicData = topics.map(topic => {
    let totalEarned = 0, totalMax = 0;
    assessments.forEach(assessment => {
      const topicItems = assessment.markSheet.filter(i => !i.isSection && i.topicId === topic.id);
      if (topicItems.length === 0) return;
      assessment.scores.forEach((scoreEntry: ScoreEntry) => {
        const scoreMap = getScoreMap(assessment, scoreEntry.studentId);
        topicItems.forEach(item => {
          totalEarned += scoreMap[item.id] ?? 0;
          totalMax += item.maxMark || 0;
        });
      });
    });
    const pct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : null;
    return {
      id: topic.id,
      name: lang === "zh" && topic.nameCht ? topic.nameCht : topic.name,
      code: topic.code,
      pct,
      status: pct === null ? "none" : pct >= 70 ? "strong" : pct >= 50 ? "average" : "weak",
    };
  });

  const colorForStatus = (status: string) => status === "strong" ? "#22c55e" : status === "average" ? "#f59e0b" : status === "weak" ? "#ef4444" : "#94a3b8";

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-bold text-slate-800">{lang === "zh" ? "課題圖表分析" : "Topic Chart Analysis"} — {cls.name}</h2>

      {topics.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">{t("noTopicsYet")}</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t("topicPerformance")} — {lang === "zh" ? "班級平均 (%)" : "Class Average (%)"}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topicData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: unknown) => [(typeof v === "number" ? `${v}%` : "No data"), t("classAverage")]} />
                <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "70%", fontSize: 9, fill: "#22c55e" }} />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "50%", fontSize: 9, fill: "#f59e0b" }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {topicData.map((entry, i) => <Cell key={i} fill={colorForStatus(entry.status)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {topicData.filter(d => d.pct !== null).length >= 3 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">{lang === "zh" ? "課題雷達圖" : "Topic Radar Chart"}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={topicData.filter(d => d.pct !== null)}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar dataKey="pct" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topicData.map(topic => (
              <div key={topic.id} className={cn("bg-white rounded-xl border-2 p-4", topic.status === "strong" ? "border-green-200" : topic.status === "average" ? "border-amber-200" : topic.status === "weak" ? "border-red-200" : "border-slate-200")}>
                <div className="flex items-start justify-between gap-2">
                  <div>{topic.code && <p className="text-xs font-mono text-slate-400">{topic.code}</p>}<p className="text-sm font-bold text-slate-800 mt-0.5">{topic.name}</p></div>
                  <div className="text-right shrink-0">
                    {topic.pct !== null ? (
                      <><p className={cn("text-2xl font-bold font-mono", topic.status === "strong" ? "text-green-600" : topic.status === "average" ? "text-amber-600" : "text-red-600")}>{topic.pct}%</p><p className={cn("text-xs font-semibold", topic.status === "strong" ? "text-green-500" : topic.status === "average" ? "text-amber-500" : "text-red-500")}>{topic.status === "strong" ? t("strong") : topic.status === "average" ? t("average") : t("weak")}</p></>
                    ) : <p className="text-xs text-slate-400">{t("notSet")}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Student Profile ─────────────────────────────────────────────────────
function ProfileTab({ yearId, subjectId, classId }: { yearId: string; subjectId: string; classId: string }) {
  const { getSchoolYear, getSubject, getClass, getGlobalSubject, getNature } = useData();
  const { t, lang } = useI18n();
  const [studentId, setStudentId] = useState("");

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const subject = yearId && subjectId ? getSubject(yearId, subjectId) : undefined;
  const cls = yearId && subjectId && classId ? getClass(yearId, subjectId, classId) : undefined;
  const globalSubject = subjectId ? getGlobalSubject(subjectId) : undefined;
  const student = cls?.students.find(s => s.id === studentId);

  if (!year || !subject || !cls) {
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">{lang === "zh" ? "請在側欄選擇學年、科目及班別" : "Select School Year, Subject and Class in the sidebar"}</div>;
  }

  const topics = globalSubject?.topics ?? [];
  const assessments = cls.assessments ?? [];
  const sortedStudents = [...cls.students].sort((a, b) => a.classNo.localeCompare(b.classNo, undefined, { numeric: true }));

  const assessmentHistory = student ? assessments.map(a => {
    const total = getScoreTotal(a, student.id);
    const max = getAssessmentMax(a);
    const pct = max > 0 && total !== null ? Math.round((total / max) * 100) : null;
    const nature = getNature(a.natureId ?? "");
    const classTotals = cls.students.map(s => getScoreTotal(a, s.id)).filter(v => v !== null) as number[];
    classTotals.sort((a, b) => b - a);
    const rank = total !== null ? classTotals.indexOf(total) + 1 : null;
    return { id: a.id, title: lang === "zh" && a.titleCht ? a.titleCht : a.title, code: a.code, date: a.date, nature: nature ? (lang === "zh" && nature.nameCht ? nature.nameCht : nature.name) : "", isExam: nature?.isExam ?? false, total, max, pct, rank, classSize: classTotals.length };
  }) : [];

  const topicAnalysis = student ? topics.map(topic => {
    let earned = 0, max = 0;
    assessments.forEach(a => {
      const items = a.markSheet.filter(i => !i.isSection && i.topicId === topic.id);
      if (items.length === 0) return;
      const scoreMap = getScoreMap(a, student.id);
      items.forEach(item => { earned += scoreMap[item.id] ?? 0; max += item.maxMark || 0; });
    });
    const pct = max > 0 ? Math.round((earned / max) * 100) : null;
    return { id: topic.id, name: lang === "zh" && topic.nameCht ? topic.nameCht : topic.name, code: topic.code, pct, earned, max, status: pct === null ? "none" : pct >= 70 ? "strong" : pct >= 50 ? "average" : "weak" };
  }) : [];

  const gradedAssessments = assessmentHistory.filter(a => a.pct !== null);
  const caHistory = gradedAssessments.filter(a => !a.isExam);
  const examHistory = gradedAssessments.filter(a => a.isExam);
  const avgPct = gradedAssessments.length > 0 ? Math.round(gradedAssessments.reduce((s, a) => s + (a.pct ?? 0), 0) / gradedAssessments.length) : null;

  const trendIcon = caHistory.length >= 2
    ? (caHistory[caHistory.length - 1].pct! > caHistory[caHistory.length - 2].pct!
      ? <TrendingUp className="w-4 h-4 text-green-500" />
      : caHistory[caHistory.length - 1].pct! < caHistory[caHistory.length - 2].pct!
      ? <TrendingDown className="w-4 h-4 text-red-500" />
      : <Minus className="w-4 h-4 text-slate-400" />)
    : null;

  const displayName = student ? (lang === "zh" && student.nameCht ? student.nameCht : student.name) : "";

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">{lang === "zh" ? "學生個人檔案" : "Student Profile"}</h2>
        <div className="flex items-center gap-2">
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="h-8 text-sm w-48">
              <SelectValue placeholder={lang === "zh" ? "選擇學生…" : "Select student…"} />
            </SelectTrigger>
            <SelectContent>
              {sortedStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.classNo} {lang === "zh" && s.nameCht ? s.nameCht : s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {student && <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8 text-xs print:hidden"><Printer className="w-3.5 h-3.5" />{t("printProfile")}</Button>}
        </div>
      </div>

      {!student ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">{lang === "zh" ? "請選擇學生" : "Select a student above"}</div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">{displayName}</h3>
                {trendIcon}
              </div>
              <p className="text-sm text-slate-500">{t("classNo")}: {student.classNo} · {lang === "zh" ? subject.nameCht : subject.name} · {cls.name} · {year.label}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{t("overallAvg")}</p>
              <p className={cn("text-3xl font-bold font-mono", avgPct !== null ? (avgPct >= 70 ? "text-green-600" : avgPct >= 50 ? "text-amber-600" : "text-red-600") : "text-slate-300")}>{avgPct !== null ? `${avgPct}%` : "—"}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{t("caAssessments")}</p>
              <p className="text-3xl font-bold font-mono text-blue-600">{caHistory.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{t("examAssessments")}</p>
              <p className="text-3xl font-bold font-mono text-purple-600">{examHistory.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{t("strongTopics")}</p>
              <p className="text-3xl font-bold font-mono text-green-600">{topicAnalysis.filter(tp => tp.status === "strong").length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Assessment history */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200"><p className="text-sm font-bold text-slate-700">{t("assessmentHistory")}</p></div>
              {gradedAssessments.length > 0 && (
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={gradedAssessments} margin={{ top: 5, right: 5, left: -20, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="code" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`]} />
                      <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                        {gradedAssessments.map((entry, i) => <Cell key={i} fill={colorForPct(entry.pct)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/50"><th className="text-left px-3 py-1.5 text-xs font-bold text-slate-500">{t("assessment")}</th><th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("score")}</th><th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">%</th><th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("rank")}</th></tr></thead>
                  <tbody>
                    {assessmentHistory.map(a => (
                      <tr key={a.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1.5"><div><span className="font-semibold text-slate-800 text-xs">{a.title}</span>{a.code && <span className="text-slate-400 text-xs ml-1">({a.code})</span>}</div></td>
                        <td className="px-2 py-1.5 text-center font-mono text-slate-700 text-xs">{a.total !== null ? `${a.total}/${a.max}` : "—"}</td>
                        <td className="px-2 py-1.5 text-center">{a.pct !== null ? <span className={cn("font-mono font-bold text-xs", a.pct >= 70 ? "text-green-600" : a.pct >= 50 ? "text-amber-600" : "text-red-600")}>{a.pct}%</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-slate-500 text-xs">{a.rank !== null ? `${a.rank}/${a.classSize}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Topic analysis */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200"><p className="text-sm font-bold text-slate-700">{t("topicAnalysis")}</p></div>
              {topics.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">{t("noTopicsYet")}</div>
              ) : (
                <>
                  {topicAnalysis.filter(tp => tp.pct !== null).length >= 3 && (
                    <div className="p-3">
                      <ResponsiveContainer width="100%" height={180}>
                        <RadarChart data={topicAnalysis.filter(tp => tp.pct !== null)}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                          <Radar dataKey="pct" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100 bg-slate-50/50"><th className="text-left px-3 py-1.5 text-xs font-bold text-slate-500">{t("topic")}</th><th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("score")}</th><th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">%</th><th className="text-center px-2 py-1.5 text-xs font-bold text-slate-500">{t("status")}</th></tr></thead>
                      <tbody>
                        {topicAnalysis.map(tp => (
                          <tr key={tp.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1.5"><div>{tp.code && <span className="text-xs font-mono text-slate-400 mr-1">{tp.code}</span>}<span className="text-xs font-semibold text-slate-800">{tp.name}</span></div></td>
                            <td className="px-2 py-1.5 text-center font-mono text-slate-700 text-xs">{tp.max > 0 ? `${tp.earned}/${tp.max}` : "—"}</td>
                            <td className="px-2 py-1.5 text-center">{tp.pct !== null ? <span className={cn("font-mono font-bold text-xs", tp.status === "strong" ? "text-green-600" : tp.status === "average" ? "text-amber-600" : "text-red-600")}>{tp.pct}%</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                            <td className="px-2 py-1.5 text-center">{tp.pct !== null ? <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full", tp.status === "strong" ? "bg-green-100 text-green-700" : tp.status === "average" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{tp.status === "strong" ? t("strong") : tp.status === "average" ? t("average") : t("weak")}</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────
function SettingsTab() {
  const { teachers, addTeacher, updateTeacher, deleteTeacher, natures, addNature, updateNature, deleteNature, weightingSchemes, addWeightingScheme, updateWeightingScheme, deleteWeightingScheme, subjects, addTopic, updateTopic, deleteTopic, replaceTopicsFromSyllabus, syllabusItems, setSyllabusItems } = useData();
  const { t, lang, setLang } = useI18n();

  const [activeSection, setActiveSection] = useState<"teachers" | "natures" | "weighting" | "topics">("teachers");

  // Syllabus state
  const syllabusFileRef = useRef<HTMLInputElement>(null);
  const [syllabusPreview, setSyllabusPreview] = useState<import("@/contexts/DataContext").SyllabusItem[]>([]);
  const [syllabusFilter, setSyllabusFilter] = useState<"all" | "Junior" | "Senior">("all");
  const [syllabusSubjectId, setSyllabusSubjectId] = useState<string>("");
  const [syllabusSearch, setSyllabusSearch] = useState("");

  const handleSyllabusFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        const items = rows.filter(r => r["Learning Objective"] || r["LearningObjective"]).map((r, i) => ({
          id: `syl-${Date.now()}-${i}`,
          level: r["Level"] || r["Syllabus Level"] || "",
          strand: r["Strand"] || "",
          learningUnit: r["Learning Unit"] || r["LearningUnit"] || "",
          learningObjective: r["Learning Objective"] || r["LearningObjective"] || "",
          category: r["Category"] || "",
          remarks: r["Remarks"] || "",
        }));
        setSyllabusPreview(items);
        toast.success(lang === "zh" ? `已解析 ${items.length} 個學習目標` : `Parsed ${items.length} learning objectives`);
      } catch {
        toast.error(lang === "zh" ? "無法解析 Excel 檔案" : "Failed to parse Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input so same file can be re-uploaded
    e.target.value = "";
  };

  const handleSaveSyllabus = () => {
    if (syllabusPreview.length === 0) return;
    // Save to global syllabusItems store
    setSyllabusItems(syllabusPreview);
    // Also populate the selected subject's topics from syllabus
    if (syllabusSubjectId) {
      const topicsFromSyllabus = syllabusPreview.map((s, i) => ({
        code: `SYL-${String(i + 1).padStart(3, "0")}`,
        name: s.learningObjective,
        nameCht: "",
        order: i + 1,
        level: s.level,
        learningUnit: s.learningUnit,
        learningObjective: s.learningObjective,
        strand: s.strand,
        category: s.category,
        remarks: s.remarks,
      }));
      replaceTopicsFromSyllabus(syllabusSubjectId, topicsFromSyllabus);
      toast.success(lang === "zh" ? `課程大綱已儲存並更新「${subjects.find(s => s.id === syllabusSubjectId)?.name ?? ""}」的學習目標` : `Syllabus saved and topics updated for "${subjects.find(s => s.id === syllabusSubjectId)?.name ?? ""}"`); 
    } else {
      toast.success(lang === "zh" ? "課程大綱已儲存（未選擇科目，未更新學習目標）" : "Syllabus saved (no subject selected — topics not updated)");
    }
    setSyllabusPreview([]);
  };

  const handleClearSyllabus = () => {
    setSyllabusItems([]);
    setSyllabusPreview([]);
    toast.success(lang === "zh" ? "課程大綱已清除" : "Syllabus cleared");
  };

  const displayedSyllabus = (syllabusPreview.length > 0 ? syllabusPreview : syllabusItems)
    .filter(s => syllabusFilter === "all" || s.level === syllabusFilter)
    .filter(s => !syllabusSearch || s.learningObjective.toLowerCase().includes(syllabusSearch.toLowerCase()) || s.strand.toLowerCase().includes(syllabusSearch.toLowerCase()) || s.learningUnit.toLowerCase().includes(syllabusSearch.toLowerCase()));

  // Teacher state
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState<string | null>(null);
  const [teacherForm, setTeacherForm] = useState({ name: "", nameCht: "", code: "" });
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);

  // Nature state
  const [showAddNature, setShowAddNature] = useState(false);
  const [editNatureId, setEditNatureId] = useState<string | null>(null);
  const [natureForm, setNatureForm] = useState({ name: "", nameCht: "", isExam: false });
  const [deleteNatureId, setDeleteNatureId] = useState<string | null>(null);

  // Weighting state
  const [showAddWeighting, setShowAddWeighting] = useState(false);
  const [editWeightingId, setEditWeightingId] = useState<string | null>(null);
  const [weightingForm, setWeightingForm] = useState({ label: "", form: "S6", subjectId: subjects[0]?.id ?? "", examPercentage: 60 });
  const [deleteWeightingId, setDeleteWeightingId] = useState<string | null>(null);

  // Topic state
  const [selectedSubjectForTopics, setSelectedSubjectForTopics] = useState(subjects[0]?.id ?? "");
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [editTopicId, setEditTopicId] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState({ name: "", nameCht: "", code: "" });
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectForTopics);

  const handleSaveTeacher = () => {
    if (!teacherForm.name.trim()) { toast.error(t("validationError")); return; }
    if (editTeacherId) {
      updateTeacher(editTeacherId, { name: teacherForm.name.trim(), nameCht: teacherForm.nameCht.trim(), code: teacherForm.code.trim() });
    } else {
      addTeacher({ name: teacherForm.name.trim(), nameCht: teacherForm.nameCht.trim(), code: teacherForm.code.trim(), email: "" });
    }
    toast.success(t("saved")); setShowAddTeacher(false); setEditTeacherId(null);
  };

  const handleSaveNature = () => {
    if (!natureForm.name.trim()) { toast.error(t("validationError")); return; }
    if (editNatureId) {
      updateNature(editNatureId, { name: natureForm.name.trim(), nameCht: natureForm.nameCht.trim(), isExam: natureForm.isExam });
    } else {
      addNature({ name: natureForm.name.trim(), nameCht: natureForm.nameCht.trim(), isExam: natureForm.isExam, color: "blue" });
    }
    toast.success(t("saved")); setShowAddNature(false); setEditNatureId(null);
  };

  const handleSaveWeighting = () => {
    if (!weightingForm.label.trim()) { toast.error(t("validationError")); return; }
    if (editWeightingId) {
      updateWeightingScheme(editWeightingId, { label: weightingForm.label.trim(), examPercentage: weightingForm.examPercentage });
    } else {
      addWeightingScheme({ label: weightingForm.label.trim(), form: weightingForm.form, subjectId: weightingForm.subjectId, caEntries: [], examPercentage: weightingForm.examPercentage });
    }
    toast.success(t("saved")); setShowAddWeighting(false); setEditWeightingId(null);
  };

  const handleSaveTopic = () => {
    if (!selectedSubjectForTopics || !topicForm.name.trim()) { toast.error(t("validationError")); return; }
    if (editTopicId) {
      updateTopic(selectedSubjectForTopics, editTopicId, { name: topicForm.name.trim(), nameCht: topicForm.nameCht.trim(), code: topicForm.code.trim() });
    } else {
      addTopic(selectedSubjectForTopics, { name: topicForm.name.trim(), nameCht: topicForm.nameCht.trim(), code: topicForm.code.trim() });
    }
    toast.success(t("saved")); setShowAddTopic(false); setEditTopicId(null);
  };

  const sections = [
    { id: "teachers" as const, label: lang === "zh" ? "教師" : "Teachers" },
    { id: "natures" as const, label: lang === "zh" ? "評估性質" : "Assessment Natures" },
    { id: "weighting" as const, label: lang === "zh" ? "加權方案" : "Weighting Schemes" },
    { id: "topics" as const, label: lang === "zh" ? "課題管理" : "Topic Management" },
  ];

  // Bulk-select state for topics
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [bulkSubjectId, setBulkSubjectId] = useState("");
  const [topicsViewMode, setTopicsViewMode] = useState<"syllabus" | "manual">("syllabus");

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Settings sidebar — horizontal on mobile, vertical on desktop */}
      <div className="md:w-48 md:shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 md:p-3">
        {/* Mobile: horizontal scroll tabs */}
        <div className="md:hidden overflow-x-auto">
          <div className="flex gap-1 p-2 w-max">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors", activeSection === s.id ? "bg-blue-500 text-white" : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-100")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {/* Desktop: vertical sidebar */}
        <div className="hidden md:block space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2 mb-3">{t("settings")}</p>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeSection === s.id ? "bg-blue-500 text-white" : "text-slate-600 hover:bg-slate-200")}>
              {s.label}
            </button>
          ))}
          <div className="pt-4 border-t border-slate-200 mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">{t("language")}</p>
            <div className="flex gap-1">
              <button onClick={() => setLang("en")} className={cn("flex-1 py-1.5 rounded text-xs font-semibold transition-colors", lang === "en" ? "bg-blue-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200")}>EN</button>
              <button onClick={() => setLang("zh")} className={cn("flex-1 py-1.5 rounded text-xs font-semibold transition-colors", lang === "zh" ? "bg-blue-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200")}>中</button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === "teachers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{lang === "zh" ? "教師管理" : "Teacher Management"}</h3>
              <Button size="sm" onClick={() => { setEditTeacherId(null); setTeacherForm({ name: "", nameCht: "", code: "" }); setShowAddTeacher(true); }} className="gap-1.5"><Plus className="w-4 h-4" />{t("addTeacher")}</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {teachers.map(tc => (
                <div key={tc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-blue-700">{tc.code}</span></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{lang === "zh" ? tc.nameCht : tc.name}</p>
                    <p className="text-xs text-slate-400">{tc.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditTeacherId(tc.id); setTeacherForm({ name: tc.name, nameCht: tc.nameCht, code: tc.code }); setShowAddTeacher(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteTeacherId(tc.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {teachers.length === 0 && <p className="px-4 py-4 text-sm text-slate-400 italic">{t("noData")}</p>}
            </div>
          </div>
        )}

        {activeSection === "natures" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{lang === "zh" ? "評估性質" : "Assessment Natures"}</h3>
              <Button size="sm" onClick={() => { setEditNatureId(null); setNatureForm({ name: "", nameCht: "", isExam: false }); setShowAddNature(true); }} className="gap-1.5"><Plus className="w-4 h-4" />{t("addNature")}</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {natures.map(n => (
                <div key={n.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 text-sm">{lang === "zh" ? n.nameCht : n.name}</p>
                      {n.isExam && <Badge variant="destructive" className="text-xs">{lang === "zh" ? "考試" : "Exam"}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditNatureId(n.id); setNatureForm({ name: n.name, nameCht: n.nameCht, isExam: n.isExam }); setShowAddNature(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteNatureId(n.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {natures.length === 0 && <p className="px-4 py-4 text-sm text-slate-400 italic">{t("noData")}</p>}
            </div>
          </div>
        )}

        {activeSection === "weighting" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{lang === "zh" ? "加權方案" : "Weighting Schemes"}</h3>
              <Button size="sm" onClick={() => { setEditWeightingId(null); setWeightingForm({ label: "", form: "S6", subjectId: subjects[0]?.id ?? "", examPercentage: 60 }); setShowAddWeighting(true); }} className="gap-1.5"><Plus className="w-4 h-4" />{t("addWeightingScheme")}</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {weightingSchemes.map(ws => (
                <div key={ws.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">{ws.label}</p>
                    <p className="text-xs text-slate-400">{ws.form} · {t("examPercentage")}: {ws.examPercentage}%</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditWeightingId(ws.id); setWeightingForm({ label: ws.label, form: ws.form, subjectId: ws.subjectId, examPercentage: ws.examPercentage }); setShowAddWeighting(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteWeightingId(ws.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {weightingSchemes.length === 0 && <p className="px-4 py-4 text-sm text-slate-400 italic">{t("noData")}</p>}
            </div>
          </div>
        )}

        {false && (
          <div className="space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-800">{lang === "zh" ? "課程大綱" : "Syllabus"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{lang === "zh" ? `已載入 ${syllabusItems.length} 個學習目標` : `${syllabusItems.length} learning objectives loaded`}</p>
                {/* Subject selector */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 shrink-0">{lang === "zh" ? "連結至科目:" : "Link to Subject:"}</span>
                  <Select value={syllabusSubjectId} onValueChange={setSyllabusSubjectId}>
                    <SelectTrigger className="h-7 text-xs w-52">
                      <SelectValue placeholder={lang === "zh" ? "選擇科目…" : "Select subject…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {lang === "zh" ? s.nameCht || s.name : s.name} ({s.code} · {s.form})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {syllabusSubjectId && (
                    <span className="text-xs text-green-600 font-medium">
                      {lang === "zh" ? `將更新「${subjects.find(s => s.id === syllabusSubjectId)?.name ?? ""}」的學習目標` : `Will update topics for "${subjects.find(s => s.id === syllabusSubjectId)?.name ?? ""}"`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => syllabusFileRef.current?.click()} className="gap-1.5"><Upload className="w-4 h-4" />{lang === "zh" ? "上傳 Excel" : "Upload Excel"}</Button>
                <input ref={syllabusFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleSyllabusFile} />
                {syllabusPreview.length > 0 && (
                  <Button size="sm" onClick={handleSaveSyllabus} className="gap-1.5"><Save className="w-4 h-4" />{lang === "zh" ? `確認儲存 (${syllabusPreview.length})` : `Confirm Save (${syllabusPreview.length})`}</Button>
                )}
                {syllabusItems.length > 0 && syllabusPreview.length === 0 && (
                  <Button size="sm" variant="outline" onClick={handleClearSyllabus} className="gap-1.5 text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" />{lang === "zh" ? "清除大綱" : "Clear Syllabus"}</Button>
                )}
              </div>
            </div>

            {/* Excel format hint */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-semibold mb-1">{lang === "zh" ? "Excel 格式要求" : "Excel Format Requirements"}</p>
              <p>{lang === "zh" ? "必須包含以下欄位標題（第一行）：" : "Required column headers (row 1):"}</p>
              <p className="font-mono mt-1">Level | Strand | Learning Unit | Learning Objective | Category | Remarks</p>
              <p className="mt-1 text-blue-600">{lang === "zh" ? "Level 欄填寫 \"Junior\" 或 \"Senior\"" : 'Level column: fill with "Junior" or "Senior"'}</p>
            </div>

            {/* Filter + search */}
            {(syllabusItems.length > 0 || syllabusPreview.length > 0) && (
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1">
                  {(["all", "Junior", "Senior"] as const).map(f => (
                    <button key={f} onClick={() => setSyllabusFilter(f)} className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors", syllabusFilter === f ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
                      {f === "all" ? (lang === "zh" ? "全部" : "All") : f}
                    </button>
                  ))}
                </div>
                <Input value={syllabusSearch} onChange={e => setSyllabusSearch(e.target.value)} placeholder={lang === "zh" ? "搜尋學習目標…" : "Search objectives…"} className="h-7 text-xs w-48 flex-1 max-w-xs" />
                <span className="text-xs text-slate-400">{displayedSyllabus.length} {lang === "zh" ? "項" : "items"}</span>
              </div>
            )}

            {/* Preview/table */}
            {syllabusPreview.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 font-medium">
                ⚠ {lang === "zh" ? `預覽模式：${syllabusPreview.length} 個項目待確認儲存` : `Preview mode: ${syllabusPreview.length} items pending save`}
              </div>
            )}

            {displayedSyllabus.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-20">{lang === "zh" ? "程度" : "Level"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-36">{lang === "zh" ? "範疇" : "Strand"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-36">{lang === "zh" ? "學習單元" : "Learning Unit"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500">{lang === "zh" ? "學習目標" : "Learning Objective"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-28">{lang === "zh" ? "類別" : "Category"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500">{lang === "zh" ? "備注" : "Remarks"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSyllabus.map((item, i) => (
                        <tr key={item.id} className={cn("border-b border-slate-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                          <td className="px-3 py-2">
                            <span className={cn("px-1.5 py-0.5 rounded text-xs font-semibold", item.level === "Junior" ? "bg-green-100 text-green-700" : item.level === "Senior" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600")}>{item.level || "—"}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-medium">{item.strand}</td>
                          <td className="px-3 py-2 text-slate-600">{item.learningUnit}</td>
                          <td className="px-3 py-2 text-slate-800">{item.learningObjective}</td>
                          <td className="px-3 py-2">
                            <span className={cn("px-1.5 py-0.5 rounded text-xs", item.category === "Foundation" ? "bg-blue-100 text-blue-700" : item.category === "Non-Foundation" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600")}>{item.category || "—"}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-xs">{item.remarks || <span className="text-slate-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">{lang === "zh" ? "尚未載入課程大綱" : "No syllabus loaded yet"}</p>
                <p className="text-xs text-slate-400 mt-1">{lang === "zh" ? "點擊「上傳 Excel」按鈕匯入課程大綱" : 'Click "Upload Excel" to import your syllabus'}</p>
              </div>
            )}
          </div>
        )}

        {activeSection === "topics" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{lang === "zh" ? "課題管理" : "Topic Management"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{lang === "zh" ? `已載入 ${syllabusItems.length} 個學習目標` : `${syllabusItems.length} learning objectives loaded`}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => syllabusFileRef.current?.click()} className="gap-1.5"><Upload className="w-4 h-4" />{lang === "zh" ? "上傳 Excel 課程大綱" : "Upload Syllabus Excel"}</Button>
                <input ref={syllabusFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleSyllabusFile} />
                {syllabusPreview.length > 0 && (
                  <>
                    <Select value={syllabusSubjectId} onValueChange={setSyllabusSubjectId}>
                      <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder={lang === "zh" ? "選擇科目…" : "Select subject…"} /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{lang === "zh" ? s.nameCht || s.name : s.name} ({s.code})</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleSaveSyllabus} className="gap-1.5"><Save className="w-4 h-4" />{lang === "zh" ? `確認儲存 (${syllabusPreview.length})` : `Confirm Save (${syllabusPreview.length})`}</Button>
                  </>
                )}
                {syllabusItems.length > 0 && syllabusPreview.length === 0 && (
                  <Button size="sm" variant="outline" onClick={handleClearSyllabus} className="gap-1.5 text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" />{lang === "zh" ? "清除大綱" : "Clear Syllabus"}</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setEditTopicId(null); setTopicForm({ name: "", nameCht: "", code: "" }); setSelectedSubjectForTopics(subjects[0]?.id ?? ""); setShowAddTopic(true); }} className="gap-1.5"><Plus className="w-4 h-4" />{lang === "zh" ? "手動新增" : "Add Manual"}</Button>
              </div>
            </div>

            {/* Excel format hint */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-semibold mb-1">{lang === "zh" ? "Excel 格式要求" : "Excel Format"}</p>
              <p className="font-mono">Level | Strand | Learning Unit | Learning Objective | Category | Remarks</p>
              <p className="mt-1 text-blue-600">{lang === "zh" ? 'Level 欄填寫 "Junior" 或 "Senior"' : 'Level column: "Junior" or "Senior"'}</p>
            </div>

            {/* Preview banner */}
            {syllabusPreview.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 font-medium">
                ⚠ {lang === "zh" ? `預覽模式：${syllabusPreview.length} 個項目待確認儲存——請選擇科目後點「確認儲存」` : `Preview: ${syllabusPreview.length} items pending — select a subject then click Confirm Save`}
              </div>
            )}

            {/* Bulk-assign bar (shown when items exist and none are in preview) */}
            {syllabusItems.length > 0 && syllabusPreview.length === 0 && selectedTopicIds.size > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-blue-700">{selectedTopicIds.size} {lang === "zh" ? "項已選" : "selected"}</span>
                <Select value={bulkSubjectId} onValueChange={setBulkSubjectId}>
                  <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder={lang === "zh" ? "指定科目…" : "Assign to subject…"} /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{lang === "zh" ? s.nameCht || s.name : s.name} ({s.code})</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={!bulkSubjectId} onClick={() => {
                  if (!bulkSubjectId) return;
                  const selected = syllabusItems.filter(si => selectedTopicIds.has(si.id));
                  const topicsFromSelected = selected.map((s, i) => ({
                    code: `SYL-${String(i + 1).padStart(3, "0")}`,
                    name: s.learningObjective,
                    nameCht: "",
                    order: i + 1,
                    level: s.level,
                    learningUnit: s.learningUnit,
                    learningObjective: s.learningObjective,
                    strand: s.strand,
                    category: s.category,
                    remarks: s.remarks,
                  }));
                  replaceTopicsFromSyllabus(bulkSubjectId, topicsFromSelected);
                  toast.success(lang === "zh" ? `已將 ${selected.length} 個目標指定至「${subjects.find(s => s.id === bulkSubjectId)?.name ?? ""}」` : `Assigned ${selected.length} objectives to "${subjects.find(s => s.id === bulkSubjectId)?.name ?? ""}"`); 
                  setSelectedTopicIds(new Set());
                  setBulkSubjectId("");
                }} className="gap-1">{lang === "zh" ? "指定" : "Assign"}</Button>
                <button onClick={() => setSelectedTopicIds(new Set())} className="text-xs text-blue-500 hover:underline ml-1">{lang === "zh" ? "取消選擇" : "Clear selection"}</button>
              </div>
            )}

            {/* Filter + search */}
            {(syllabusItems.length > 0 || syllabusPreview.length > 0) && (
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1">
                  {(["all", "Junior", "Senior"] as const).map(f => (
                    <button key={f} onClick={() => setSyllabusFilter(f)} className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors", syllabusFilter === f ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
                      {f === "all" ? (lang === "zh" ? "全部" : "All") : f}
                    </button>
                  ))}
                </div>
                <Input value={syllabusSearch} onChange={e => setSyllabusSearch(e.target.value)} placeholder={lang === "zh" ? "搜尋學習目標…" : "Search objectives…"} className="h-7 text-xs w-48 flex-1 max-w-xs" />
                <span className="text-xs text-slate-400">{displayedSyllabus.length} {lang === "zh" ? "項" : "items"}</span>
              </div>
            )}

            {/* Unified syllabus table with Subject column */}
            {displayedSyllabus.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-2 w-8">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded"
                            checked={selectedTopicIds.size === displayedSyllabus.length && displayedSyllabus.length > 0}
                            onChange={e => setSelectedTopicIds(e.target.checked ? new Set(displayedSyllabus.map(s => s.id)) : new Set())}
                          />
                        </th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-20">{lang === "zh" ? "程度" : "Level"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-32">{lang === "zh" ? "範雇" : "Strand"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-36">{lang === "zh" ? "學習單元" : "Learning Unit"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500">{lang === "zh" ? "學習目標" : "Learning Objective"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-28">{lang === "zh" ? "類別" : "Category"}</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-28">{lang === "zh" ? "科目" : "Subject"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSyllabus.map((item, i) => {
                        // Find which subjects have this objective as a topic
                        const linkedSubjects = subjects.filter(s => s.topics.some(tp => tp.learningObjective === item.learningObjective));
                        const isSelected = selectedTopicIds.has(item.id);
                        return (
                          <tr key={item.id} className={cn("border-b border-slate-100 last:border-0 cursor-pointer", isSelected ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50")} onClick={() => setSelectedTopicIds(prev => { const next = new Set(prev); isSelected ? next.delete(item.id) : next.add(item.id); return next; })}>
                            <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={isSelected}
                                onChange={e => setSelectedTopicIds(prev => { const next = new Set(prev); e.target.checked ? next.add(item.id) : next.delete(item.id); return next; })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn("px-1.5 py-0.5 rounded text-xs font-semibold", item.level === "Junior" ? "bg-green-100 text-green-700" : item.level === "Senior" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600")}>{item.level || "—"}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 font-medium">{item.strand}</td>
                            <td className="px-3 py-2 text-slate-600">{item.learningUnit}</td>
                            <td className="px-3 py-2 text-slate-800">{item.learningObjective}</td>
                            <td className="px-3 py-2">
                              <span className={cn("px-1.5 py-0.5 rounded text-xs", item.category === "Foundation" ? "bg-blue-100 text-blue-700" : item.category === "Non-Foundation" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600")}>{item.category || "—"}</span>
                            </td>
                            <td className="px-3 py-2">
                              {linkedSubjects.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {linkedSubjects.map(s => (
                                    <span key={s.id} className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-semibold">{s.code}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">{lang === "zh" ? "尚未載入課程大綱" : "No syllabus loaded yet"}</p>
                <p className="text-xs text-slate-400 mt-1">{lang === "zh" ? '點擊「上傳 Excel 課程大綱」按鈕匯入課程大綱' : 'Click "Upload Syllabus Excel" to import your syllabus'}</p>
              </div>
            )}

            {/* Manual topics section (per-subject flat list) */}
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-bold text-slate-700">{lang === "zh" ? "手動課題" : "Manual Topics"}</h4>
                <Select value={selectedSubjectForTopics} onValueChange={setSelectedSubjectForTopics}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder={lang === "zh" ? "選擇科目…" : "Select subject…"} /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{lang === "zh" ? s.nameCht || s.name : s.name} ({s.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedSubject && selectedSubject.topics.filter(tp => !tp.learningObjective).length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {selectedSubject.topics.filter(tp => !tp.learningObjective).map(tp => (
                    <div key={tp.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {tp.code && <span className="text-xs font-mono text-slate-400">{tp.code}</span>}
                          <p className="font-semibold text-slate-800 text-sm">{lang === "zh" && tp.nameCht ? tp.nameCht : tp.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditTopicId(tp.id); setTopicForm({ name: tp.name, nameCht: tp.nameCht, code: tp.code ?? "" }); setShowAddTopic(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteTopicId(tp.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic px-1">{lang === "zh" ? "未有手動課題，點擊「手動新增」新增" : 'No manual topics. Click "Add Manual" to add one.'}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={showAddTeacher} onOpenChange={setShowAddTeacher}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editTeacherId ? t("edit") : t("addTeacher")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t("name")} (English)</Label><Input value={teacherForm.name} onChange={e => setTeacherForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
            <div><Label>{t("nameCht")}</Label><Input value={teacherForm.nameCht} onChange={e => setTeacherForm(f => ({ ...f, nameCht: e.target.value }))} /></div>
            <div><Label>{t("code")}</Label><Input value={teacherForm.code} onChange={e => setTeacherForm(f => ({ ...f, code: e.target.value }))} placeholder="TCH" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddTeacher(false)}>{t("cancel")}</Button><Button onClick={handleSaveTeacher}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTeacherId} onOpenChange={() => setDeleteTeacherId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { deleteTeacher(deleteTeacherId!); setDeleteTeacherId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddNature} onOpenChange={setShowAddNature}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editNatureId ? t("edit") : t("addNature")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t("name")} (English)</Label><Input value={natureForm.name} onChange={e => setNatureForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
            <div><Label>{t("nameCht")}</Label><Input value={natureForm.nameCht} onChange={e => setNatureForm(f => ({ ...f, nameCht: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={natureForm.isExam} onCheckedChange={v => setNatureForm(f => ({ ...f, isExam: v }))} /><Label>{lang === "zh" ? "計為考試" : "Count as Exam"}</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddNature(false)}>{t("cancel")}</Button><Button onClick={handleSaveNature}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteNatureId} onOpenChange={() => setDeleteNatureId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { deleteNature(deleteNatureId!); setDeleteNatureId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddWeighting} onOpenChange={setShowAddWeighting}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editWeightingId ? t("edit") : t("addWeightingScheme")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t("schemeLabel")}</Label><Input value={weightingForm.label} onChange={e => setWeightingForm(f => ({ ...f, label: e.target.value }))} autoFocus /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t("form")}</Label><Select value={weightingForm.form} onValueChange={v => setWeightingForm(f => ({ ...f, form: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["S1","S2","S3","S4","S5","S6"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{t("examPercentage")} (%)</Label><Input type="number" min={0} max={100} value={weightingForm.examPercentage} onChange={e => setWeightingForm(f => ({ ...f, examPercentage: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddWeighting(false)}>{t("cancel")}</Button><Button onClick={handleSaveWeighting}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteWeightingId} onOpenChange={() => setDeleteWeightingId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { deleteWeightingScheme(deleteWeightingId!); setDeleteWeightingId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddTopic} onOpenChange={setShowAddTopic}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editTopicId ? t("edit") : t("addTopic")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t("name")} (English)</Label><Input value={topicForm.name} onChange={e => setTopicForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
            <div><Label>{t("nameCht")}</Label><Input value={topicForm.nameCht} onChange={e => setTopicForm(f => ({ ...f, nameCht: e.target.value }))} /></div>
            <div><Label>{t("code")}</Label><Input value={topicForm.code} onChange={e => setTopicForm(f => ({ ...f, code: e.target.value }))} placeholder="T1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddTopic(false)}>{t("cancel")}</Button><Button onClick={handleSaveTopic}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTopicId} onOpenChange={() => setDeleteTopicId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("delete")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (selectedSubjectForTopics) deleteTopic(selectedSubjectForTopics, deleteTopicId!); setDeleteTopicId(null); toast.success(t("deleted")); }}>{t("delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab: Data Backup ─────────────────────────────────────────────────────────
function BackupTab() {
  const { teachers, natures, weightingSchemes, subjects, schoolYears } = useData();
  const { t, lang } = useI18n();
  const [importText, setImportText] = useState("");
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  const handleExport = () => {
    const data = { teachers, natures, weightingSchemes, subjects, schoolYears };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maths-grading-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("saved"));
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText);
      // Validate basic structure
      if (!parsed.schoolYears || !parsed.subjects) {
        toast.error(lang === "zh" ? "JSON 格式無效" : "Invalid JSON structure");
        return;
      }
      // Save to localStorage immediately
      localStorage.setItem("sqgs_data_v1", JSON.stringify(parsed));
      // Also save to Supabase cloud
      const { saveAppState } = await import("@/lib/supabase");
      await saveAppState(parsed as Record<string, unknown>);
      setImportText("");
      setShowImportConfirm(false);
      toast.success(t("parseSuccess"));
      // Reload to re-initialise DataContext from the restored data
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error(t("parseError"));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setImportText(ev.target?.result as string ?? ""); };
    reader.readAsText(file);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-bold text-slate-800">{lang === "zh" ? "數據備份" : "Data Backup"}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Download className="w-5 h-5 text-green-600" /></div>
            <div>
              <h3 className="font-bold text-slate-800">{lang === "zh" ? "匯出備份" : "Export Backup"}</h3>
              <p className="text-xs text-slate-500">{lang === "zh" ? "下載所有數據的 JSON 備份" : "Download a JSON backup of all data"}</p>
            </div>
          </div>
          <Button onClick={handleExport} className="w-full gap-2"><Download className="w-4 h-4" />{t("export")}</Button>
        </div>

        {/* Import */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Upload className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h3 className="font-bold text-slate-800">{lang === "zh" ? "匯入備份" : "Import Backup"}</h3>
              <p className="text-xs text-slate-500">{lang === "zh" ? "從 JSON 檔案恢復數據" : "Restore data from a JSON file"}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{lang === "zh" ? "選擇備份檔案" : "Choose backup file"}</Label>
              <input type="file" accept=".json" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 mt-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
            </div>
            {importText && (
              <div>
                <Label className="text-xs">{lang === "zh" ? "或貼上 JSON" : "Or paste JSON"}</Label>
                <Textarea value={importText} onChange={e => setImportText(e.target.value)} rows={4} className="font-mono text-xs mt-1" />
              </div>
            )}
            {!importText && (
              <div>
                <Label className="text-xs">{lang === "zh" ? "或貼上 JSON" : "Or paste JSON"}</Label>
                <Textarea value={importText} onChange={e => setImportText(e.target.value)} rows={4} className="font-mono text-xs mt-1" placeholder='{"schoolYears": [...]}' />
              </div>
            )}
            <Button onClick={() => setShowImportConfirm(true)} disabled={!importText.trim()} variant="outline" className="w-full gap-2"><Upload className="w-4 h-4" />{t("import")}</Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "zh" ? "確認匯入" : "Confirm Import"}</AlertDialogTitle>
            <AlertDialogDescription>{lang === "zh" ? "匯入將覆蓋所有現有數據。此操作不可撤銷。確定繼續嗎？" : "Import will overwrite all existing data. This action cannot be undone. Are you sure?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>{t("import")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Context Selector (sidebar) ───────────────────────────────────────────────
function ContextSelector({
  yearId, subjectId, classId,
  setYearId, setSubjectId, setClassId,
}: {
  yearId: string; subjectId: string; classId: string;
  setYearId: (v: string) => void;
  setSubjectId: (v: string) => void;
  setClassId: (v: string) => void;
}) {
  const { schoolYears, getGlobalSubject, getYearSubject, getSchoolYear } = useData();
  const { t, lang } = useI18n();

  const year = yearId ? getSchoolYear(yearId) : undefined;
  const ys = yearId && subjectId ? getYearSubject(yearId, subjectId) : undefined;

  return (
    <div className="px-3 py-3 border-b border-[#2a3352] space-y-2">
      {/* School Year */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t("schoolYear")}</p>
        <Select value={yearId} onValueChange={v => { setYearId(v); setSubjectId(""); setClassId(""); }}>
          <SelectTrigger className="h-7 text-xs bg-[#2a3352] border-[#3a4462] text-white">
            <SelectValue placeholder={lang === "zh" ? "選擇學年…" : "Select year…"} />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map(y => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      {year && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t("subject")}</p>
          <Select value={subjectId} onValueChange={v => { setSubjectId(v); setClassId(""); }}>
            <SelectTrigger className="h-7 text-xs bg-[#2a3352] border-[#3a4462] text-white">
              <SelectValue placeholder={lang === "zh" ? "選擇科目…" : "Select subject…"} />
            </SelectTrigger>
            <SelectContent>
              {year.subjects.map(ys => {
                const sub = getGlobalSubject(ys.subjectId);
                if (!sub) return null;
                return <SelectItem key={ys.subjectId} value={ys.subjectId}>{lang === "zh" ? sub.nameCht : sub.name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Class */}
      {ys && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t("class")}</p>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="h-7 text-xs bg-[#2a3352] border-[#3a4462] text-white">
              <SelectValue placeholder={lang === "zh" ? "選擇班別…" : "Select class…"} />
            </SelectTrigger>
            <SelectContent>
              {ys.classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ─── Main App Shell ───────────────────────────────────────────────────────────
export default function MainApp() {
  const { lang, setLang } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>("students");
  const [yearId, setYearId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  // Desktop: collapsed icon-only sidebar; Mobile: hidden by default
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mark sheet editor overlay
  const [markSheetTarget, setMarkSheetTarget] = useState<{ yearId: string; subjectId: string; classId: string; assessmentId: string } | null>(null);

  const contextProps = { yearId, subjectId, classId, setYearId, setSubjectId, setClassId };

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    setMobileOpen(false); // close mobile drawer on tab select
  };

  const SidebarInner = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full" style={{ background: "#1a2035" }}>
      {/* Logo row */}
      <div className="flex items-center gap-2.5 px-3 py-3.5 border-b border-[#2a3352] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{lang === "zh" ? "數學成績分析" : "Maths Analytics"}</p>
            <p className="text-slate-400 text-[10px]">{APP_VERSION}</p>
          </div>
        )}
        {/* Desktop collapse toggle — hidden on mobile */}
        <button
          onClick={() => setDesktopCollapsed(v => !v)}
          className="hidden md:flex p-1 rounded text-slate-400 hover:text-white hover:bg-[#2a3352] transition-colors shrink-0"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Context selectors — only when expanded */}
      {!collapsed && <ContextSelector {...contextProps} />}

      {/* Tab nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const label = lang === "zh" ? tab.labelZh : tab.labelEn;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg font-medium transition-all duration-150",
                collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2",
                isActive
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-[#2a3352]"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate text-xs">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Language toggle */}
      <div className="px-2 py-2 border-t border-[#2a3352] shrink-0">
        <button
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className={cn(
            "w-full flex items-center gap-2 text-slate-400 hover:text-white hover:bg-[#2a3352] rounded-lg transition-colors text-xs font-semibold py-2",
            collapsed ? "justify-center px-2" : "px-2.5"
          )}
        >
          <Languages className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{lang === "en" ? "繁體中文" : "English"}</span>}
        </button>
      </div>

      {/* Footer text */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-[#2a3352] shrink-0">
          <p className="text-[10px] text-slate-500 text-center">{lang === "zh" ? "學生數學成績分析系統" : "Student Maths Performance Analytics"}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 w-64 flex flex-col transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "#1a2035" }}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2a3352] transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarInner collapsed={false} />
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 transition-all duration-200 overflow-hidden",
          desktopCollapsed ? "w-14" : "w-52"
        )}
        style={{ background: "#1a2035" }}
      >
        <SidebarInner collapsed={desktopCollapsed} />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
        {/* Top bar */}
        <div className="h-11 shrink-0 border-b border-slate-200 bg-white flex items-center px-3 gap-2">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 shrink-0"
            onClick={() => setMobileOpen(o => !o)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate">
              {lang === "zh" ? TABS.find(t => t.id === activeTab)?.labelZh : TABS.find(t => t.id === activeTab)?.labelEn}
            </p>
          </div>

          {/* Breadcrumb — hide on very small screens */}
          {yearId && subjectId && classId && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
              <span className="font-semibold text-slate-700 truncate max-w-[80px]">{yearId}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="font-semibold text-slate-700 truncate max-w-[80px]">{subjectId}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="font-semibold text-slate-700 truncate max-w-[60px]">{classId}</span>
            </div>
          )}

          {/* Mobile language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="md:hidden flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded border border-slate-200 shrink-0"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === "en" ? "中文" : "EN"}
          </button>
        </div>

        {/* Mobile context bar - shown when sidebar is hidden and no class selected */}
        {(!yearId || !subjectId || !classId) && activeTab !== "students" && activeTab !== "settings" && activeTab !== "backup" && (
          <div className="md:hidden px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <span className="text-xs text-amber-700 font-medium">{lang === "zh" ? "請先點擊左上角選擇學年、科目及班別" : "Tap ☰ to select School Year, Subject & Class"}</span>
            <button
              onClick={() => setMobileOpen(true)}
              className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-1 rounded-md"
            >
              ☰ {lang === "zh" ? "選擇" : "Select"}
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "students" && <StudentMgmtTab {...contextProps} />}
          {activeTab === "grading" && <GradingTab yearId={yearId} subjectId={subjectId} classId={classId} />}
          {activeTab === "weakness" && <WeaknessTab yearId={yearId} subjectId={subjectId} classId={classId} />}
          {activeTab === "summary" && <SummaryTab yearId={yearId} subjectId={subjectId} classId={classId} />}
          {activeTab === "chart" && <ChartTab yearId={yearId} subjectId={subjectId} classId={classId} />}
          {activeTab === "profile" && <ProfileTab yearId={yearId} subjectId={subjectId} classId={classId} />}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "backup" && <BackupTab />}
        </div>
      </main>

      {/* Mark sheet editor overlay */}
      {markSheetTarget && (
        <MarkSheetEditorDialog
          yearId={markSheetTarget.yearId}
          subjectId={markSheetTarget.subjectId}
          classId={markSheetTarget.classId}
          assessmentId={markSheetTarget.assessmentId}
          onClose={() => setMarkSheetTarget(null)}
        />
      )}
    </div>
  );
}

/*
 * MarkSheet Editor
 * Design: Institutional Clarity — clean table editor with topic tagging per question
 * Supports: text parse, quick generate, manual edit, topic tag per row
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Plus, Trash2, ArrowUp, ArrowDown, Wand2, FileText, Save, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import type { MarkItem } from "@/contexts/DataContext";
import HierarchyBreadcrumb from "@/components/HierarchyBreadcrumb";
import { parseMarkSheetText, validateMarkSheet, totalMaxMarks } from "@/lib/markSheetParser";
import { nanoid } from "nanoid";
import { toast } from "sonner";

export default function MarkSheet() {
  const { yearId, subjectId, classId, assessmentId } = useParams<{ yearId: string; subjectId: string; classId: string; assessmentId: string }>();
  const { getSchoolYear, getSubject, getClass, getAssessment, updateMarkSheet, getGlobalSubject } = useData();
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();

  const year = getSchoolYear(yearId);
  const subject = getSubject(yearId, subjectId);
  const globalSubject = getGlobalSubject(subjectId);
  const cls = getClass(yearId, subjectId, classId);
  const assessment = getAssessment(yearId, subjectId, classId, assessmentId);

  const [items, setItems] = useState<MarkItem[]>([]);
  const [parseText, setParseText] = useState("");
  const [quickCount, setQuickCount] = useState("10");

  useEffect(() => {
    if (assessment) setItems(assessment.markSheet.map(i => ({ ...i })));
  }, [assessment?.id]);

  if (!year || !subject || !cls || !assessment) return <div className="text-slate-400 text-sm">{t("noData")}</div>;

  const topics = globalSubject?.topics ?? [];

  const handleSave = () => {
    const errors = validateMarkSheet(items);
    if (errors.length > 0) { toast.error(errors[0]); return; }
    updateMarkSheet(yearId, subjectId, classId, assessmentId, items);
    toast.success(t("saved"));
  };

  const handleParse = () => {
    const parsed = parseMarkSheetText(parseText);
    if (parsed.length === 0) { toast.error(t("parseError")); return; }
    setItems(parsed);
    toast.success(t("parseSuccess"));
  };

  const handleQuickGenerate = () => {
    const n = parseInt(quickCount) || 10;
    const generated: MarkItem[] = Array.from({ length: n }, (_, i) => ({
      id: nanoid(), label: String(i + 1), maxMark: 0, isSection: false,
    }));
    setItems(generated);
    toast.success(t("parseSuccess"));
  };

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

  const maxTotal = totalMaxMarks(items);
  const assessTitle = lang === "zh" && assessment.titleCht ? assessment.titleCht : assessment.title;
  const subjectName = lang === "zh" ? subject.nameCht : subject.name;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HierarchyBreadcrumb items={[
        { label: t("schoolYears"), href: "/school-years" },
        { label: year.label, href: `/school-years/${yearId}/subjects` },
        { label: subjectName, href: `/school-years/${yearId}/subjects/${subjectId}/classes` },
        { label: cls.name, href: `/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments` },
        { label: assessTitle },
        { label: t("markSheet") },
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("editMarkSheet")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{assessTitle} · {cls.name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="w-4 h-4" /> {t("save")}
          </Button>
          <Button variant="outline" onClick={() => navigate(`/school-years/${yearId}/subjects/${subjectId}/classes/${classId}/assessments/${assessmentId}/grading`)} className="gap-1.5">
            {t("enterScores")} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList className="mb-4">
          <TabsTrigger value="editor">{t("markScheme")}</TabsTrigger>
          <TabsTrigger value="parse"><FileText className="w-3.5 h-3.5 mr-1" />{t("parseFromText")}</TabsTrigger>
          <TabsTrigger value="quick"><Wand2 className="w-3.5 h-3.5 mr-1" />{t("quickGenerate")}</TabsTrigger>
        </TabsList>

        {/* ── Editor tab ── */}
        <TabsContent value="editor">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className={`grid gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500 ${topics.length > 0 ? "grid-cols-[2rem_1fr_6rem_7rem_6rem_2rem_2rem]" : "grid-cols-[2rem_1fr_6rem_6rem_2rem_2rem]"}`}>
              <span>#</span>
              <span>{t("label")}</span>
              <span className="text-center">{t("maxMark")}</span>
              {topics.length > 0 && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{t("topicTag")}</span>}
              <span className="text-center">Section?</span>
              <span></span>
              <span></span>
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">{t("noData")}</div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`grid gap-2 px-3 py-1.5 items-center border-b border-slate-100 last:border-0 ${topics.length > 0 ? "grid-cols-[2rem_1fr_6rem_7rem_6rem_2rem_2rem]" : "grid-cols-[2rem_1fr_6rem_6rem_2rem_2rem]"} ${item.isSection ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                >
                  <span className="text-xs text-slate-400 font-mono text-center">{idx + 1}</span>
                  <Input
                    value={item.label}
                    onChange={e => updateItem(item.id, "label", e.target.value)}
                    className={`h-7 text-sm font-mono ${item.isSection ? "font-bold bg-blue-50 text-blue-700" : ""}`}
                    placeholder={item.isSection ? "Section A" : "2(a)"}
                  />
                  <Input
                    type="number"
                    min={0}
                    value={item.isSection ? "" : item.maxMark}
                    onChange={e => updateItem(item.id, "maxMark", parseFloat(e.target.value) || 0)}
                    disabled={item.isSection}
                    className="h-7 text-sm font-mono text-center"
                    placeholder="0"
                  />
                  {topics.length > 0 && (
                    <Select
                      value={item.topicId ?? "none"}
                      onValueChange={v => updateItem(item.id, "topicId", v === "none" ? undefined : v)}
                      disabled={item.isSection}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {topics.map(tp => (
                          <SelectItem key={tp.id} value={tp.id}>
                            {tp.code ? `${tp.code} ` : ""}{lang === "zh" && tp.nameCht ? tp.nameCht : tp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={!!item.isSection}
                      onChange={() => toggleSection(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                    />
                  </div>
                  <button onClick={() => moveUp(idx)} className="p-0.5 rounded text-slate-300 hover:text-slate-600 transition-colors">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeRow(item.id)} className="p-0.5 rounded text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            {/* Footer */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addRow(false)} className="gap-1 text-xs h-7">
                  <Plus className="w-3.5 h-3.5" /> {t("questionRow")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => addRow(true)} className="gap-1 text-xs h-7">
                  <Plus className="w-3.5 h-3.5" /> {t("sectionRow")}
                </Button>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600">
                {t("total")}: {maxTotal}
              </span>
            </div>
          </div>
          {topics.length === 0 && (
            <p className="text-xs text-slate-400 mt-2">
              💡 {lang === "en"
                ? "Add topics to the subject to enable per-question topic tagging."
                : "為科目新增課題以啟用每題課題標籤功能。"}
            </p>
          )}
        </TabsContent>

        {/* ── Parse from text tab ── */}
        <TabsContent value="parse">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs text-slate-500 whitespace-pre-line">{t("markSheetHint")}</p>
            <Textarea
              value={parseText}
              onChange={e => setParseText(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder={"1  5\n2(a)  3\n2(b)  4\nSection B\n6(a)(i)  2\n6(a)(ii)  3\nTotal"}
            />
            <Button onClick={handleParse} disabled={!parseText.trim()} className="gap-1.5">
              <Wand2 className="w-4 h-4" /> {t("parseFromText")}
            </Button>
          </div>
        </TabsContent>

        {/* ── Quick generate tab ── */}
        <TabsContent value="quick">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 max-w-xs">
            <p className="text-sm text-slate-600">{t("numQuestions")}</p>
            <Input
              type="number"
              min={1}
              max={50}
              value={quickCount}
              onChange={e => setQuickCount(e.target.value)}
              className="font-mono w-32"
            />
            <Button onClick={handleQuickGenerate} className="gap-1.5">
              <Wand2 className="w-4 h-4" /> {t("generate")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

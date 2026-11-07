import { describe, expect, it } from "vitest";
import { buildSectionAnalysis, groupMarkSheetSections, type SectionMarkItem, type SectionScoreEntry } from "../shared/sectionAnalysis";
import { sectionAnalysisHtml } from "../client/src/components/SectionAnalysis";

// Explicit fixtures test business rules; no production/student data is modified.
const sheet: SectionMarkItem[] = [
  { id: "sA", label: "Section A", maxMark: 999, isSection: true },
  { id: "q1", label: "1", maxMark: 10, isSection: false },
  { id: "q2a", label: "2(a)", maxMark: 5, isSection: false },
  { id: "sB", label: "Section B", maxMark: 999, isSection: true },
  { id: "q2b", label: "2(b)", maxMark: 5, isSection: false },
];
const entry = (studentId: string, scores: SectionScoreEntry["scores"], other: Partial<SectionScoreEntry> = {}): SectionScoreEntry => ({ studentId, scores, ...other });
const entries = [entry("me", { q1: 0, q2a: 5, q2b: 5 }), entry("p1", { q1: 10, q2a: 5, q2b: 5 }), entry("p2", { q1: 5, q2a: 0, q2b: 0 }), entry("p3", { q1: 6, q2a: 3, q2b: 4 })];

describe("read-only section analytics", () => {
  it("groups by sequential headings, preserves hierarchy, and never counts heading marks", () => {
    const result = buildSectionAnalysis(sheet, entries, "me");
    expect(result.map(row => [row.label, row.questionLabels, row.max, row.score])).toEqual([
      ["Section A", ["1", "2(a)"], 15, 5], ["Section B", ["2(b)"], 5, 5],
    ]);
    expect(result[0].pct).toBe(33.3);
    expect(result[1].pct).toBe(100);
  });
  it("uses actual section totals for class mean, extrema and participant count", () => {
    const result = buildSectionAnalysis(sheet, entries);
    expect(result[0].average).toBe(8.5);
    expect(result[0].highest).toBe(15);
    expect(result[0].lowest).toBe(5);
    expect(result[0].participantCount).toBe(4);
  });
  it("excludes ABS, late, missing and partial papers even when one section is complete", () => {
    const rejected = [
      entry("abs", { q1: 10, q2a: 5, q2b: 5 }, { isAbsent: true }),
      entry("late", { q1: 10, q2a: 5, q2b: 5 }, { assignmentStatus: "late" }),
      entry("missing", { q1: 10, q2a: 5, q2b: 5 }, { assignmentStatus: "missing" }),
      entry("partial", { q1: 10, q2a: 5, q2b: null }),
      entry("empty", {}),
      entry("nan", { q1: NaN, q2a: 5, q2b: 5 }),
    ];
    expect(buildSectionAnalysis(sheet, [...entries, ...rejected])[0].participantCount).toBe(4);
    rejected.forEach(item => {
      const rows = buildSectionAnalysis(sheet, [...entries, item], item.studentId);
      expect(rows.every(row => !row.eligible && row.score === null && row.pct === null)).toBe(true);
    });
  });
  it("treats an explicit all-zero paper as valid rather than missing", () => {
    const result = buildSectionAnalysis(sheet, [entry("zero", { q1: 0, q2a: 0, q2b: 0 })], "zero");
    expect(result[0]).toMatchObject({ score: 0, pct: 0, eligible: true });
    expect(result[1]).toMatchObject({ score: 0, pct: 0 });
  });
  it("hides sparse student peer benchmarks and never returns peer extrema", () => {
    const sparse = buildSectionAnalysis(sheet, entries.slice(0, 3), "me", 3);
    expect(sparse[0]).toMatchObject({ average: null, averagePct: null, peerCount: 0, participantCount: 0, highest: null, lowest: null });
    const enough = buildSectionAnalysis(sheet, entries, "me", 3);
    expect(enough[0]).toMatchObject({ average: 29 / 3, peerCount: 3, highest: null, lowest: null });
  });
  it("retains whole-paper/unassigned questions and skips empty heading groups", () => {
    const noHeaders = sheet.filter(item => !item.isSection);
    expect(groupMarkSheetSections(noHeaders)[0]).toMatchObject({ label: "Whole paper", isDefault: true });
    const groups = groupMarkSheetSections([sheet[1], sheet[0], sheet[3], sheet[4]]);
    expect(groups.map(group => group.label)).toEqual(["Ungrouped questions", "Section B"]);
    expect(groupMarkSheetSections([])).toEqual([]);
  });
  it("keeps repeated section names distinct and supports legacy array scores", () => {
    const repeated = sheet.map(item => item.isSection ? { ...item, label: "Repeated" } : item);
    const groups = groupMarkSheetSections(repeated);
    expect(groups[0].id).not.toBe(groups[1].id);
    const legacy = entry("me", [{ itemId: "q1", score: 0 }, { itemId: "q2a", score: 5 }, { itemId: "q2b", score: 5 }]);
    expect(buildSectionAnalysis(sheet, [legacy], "me")[0].score).toBe(5);
  });
  it("has null rates for zero-max sections and doesn't mutate marks or entries", () => {
    const before = JSON.stringify({ sheet, entries });
    buildSectionAnalysis(sheet, entries);
    expect(JSON.stringify({ sheet, entries })).toBe(before);
    const zero = buildSectionAnalysis([{ id: "q", label: "q", maxMark: 0, isSection: false }], [entry("me", { q: 0 })], "me");
    expect(zero[0].pct).toBeNull();
  });
  it("renders bilingual PDF data with achieved / total and HTML escaping", () => {
    const rows = buildSectionAnalysis(sheet, entries, "me", 3);
    const en = sectionAnalysisHtml(rows, "en", true);
    const zh = sectionAnalysisHtml(rows, "zh", true);
    expect(en).toContain("Section Performance Analysis");
    expect(en).toContain("5 / 15");
    expect(zh).toContain("分 Section 表現分析");
    expect(zh).toContain("百分點");
    expect(sectionAnalysisHtml([{ ...rows[0], label: '<img onerror="bad">' }], "en")).not.toContain('<img onerror="bad">');
  });
});

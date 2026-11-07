/** Read-only section analytics. Section headings never contribute marks. */
export type SectionMarkItem = { id: string; label: string; maxMark: number; isSection: boolean };
export type SectionScoreEntry = {
  studentId: string;
  scores: Record<string, number | null> | Array<{ itemId: string; score: number | null }>;
  isAbsent?: boolean;
  assignmentStatus?: string;
};
export type SectionAnalysis = {
  id: string;
  label: string;
  isDefault: boolean;
  questionLabels: string[];
  questionCount: number;
  max: number;
  score: number | null;
  pct: number | null;
  enteredCount: number;
  average: number | null;
  averagePct: number | null;
  highest: number | null;
  lowest: number | null;
  participantCount: number;
  peerCount: number;
  eligible: boolean;
};

export function groupMarkSheetSections(markSheet: SectionMarkItem[]) {
  const hasHeadings = markSheet.some(item => item.isSection);
  const groups: Array<{ id: string; label: string; isDefault: boolean; questions: SectionMarkItem[] }> = [];
  let group = { id: "__unsectioned__", label: hasHeadings ? "Ungrouped questions" : "Whole paper", isDefault: true, questions: [] as SectionMarkItem[] };
  groups.push(group);
  markSheet.forEach((item, index) => {
    if (item.isSection) {
      group = { id: `${item.id || "section"}-${index}`, label: item.label.trim() || `Section ${groups.length}`, isDefault: false, questions: [] };
      groups.push(group);
    } else {
      group.questions.push(item);
    }
  });
  return groups.filter(section => section.questions.length > 0);
}

function scoreMap(entry?: SectionScoreEntry): Record<string, number> {
  if (!entry) return {};
  const values = Array.isArray(entry.scores)
    ? entry.scores.map(item => [item.itemId, item.score] as const)
    : Object.entries(entry.scores ?? {});
  const result: Record<string, number> = {};
  values.forEach(([id, value]) => {
    if (typeof value === "number" && Number.isFinite(value)) result[id] = value;
  });
  return result;
}
const maxFor = (question: SectionMarkItem) => Number.isFinite(question.maxMark) ? Math.max(0, question.maxMark) : 0;
const percent = (score: number | null, max: number) => score !== null && max > 0 ? Math.round(score / max * 1000) / 10 : null;

/**
 * Class evidence requires an entirely completed, on-time paper, not merely a
 * completed section. Explicit zero is valid; null/blank, ABS, late and missing
 * are excluded. Personal adjusted totals remain the responsibility of existing
 * score/weighting code and are never changed here.
 *
 * Personal comparisons exclude the selected student; minimumPeers protects the
 * student portal. With a positive threshold no individual peer extrema or
 * below-threshold counts are returned.
 */
export function buildSectionAnalysis(
  markSheet: SectionMarkItem[], entries: SectionScoreEntry[], studentId?: string, minimumPeers = 0,
): SectionAnalysis[] {
  const questions = markSheet.filter(item => !item.isSection);
  const unique = new Map<string, SectionScoreEntry>();
  entries.forEach(entry => { if (!unique.has(entry.studentId)) unique.set(entry.studentId, entry); });
  const all = Array.from(unique.values()).map(entry => ({ entry, marks: scoreMap(entry) }));
  const complete = all.filter(({ entry, marks }) => !entry.isAbsent && !entry.assignmentStatus && questions.length > 0 && questions.every(question => typeof marks[question.id] === "number"));
  const own = studentId === undefined ? undefined : all.find(item => item.entry.studentId === studentId);
  const eligible = studentId !== undefined && complete.some(item => item.entry.studentId === studentId);
  const participants = complete.filter(item => studentId === undefined || item.entry.studentId !== studentId);
  const available = participants.length > 0 && participants.length >= minimumPeers;
  return groupMarkSheetSections(markSheet).map(section => {
    const max = section.questions.reduce((sum, question) => sum + maxFor(question), 0);
    const totals = participants.map(({ marks }) => section.questions.reduce((sum, question) => sum + marks[question.id], 0));
    const score = eligible && own ? section.questions.reduce((sum, question) => sum + own.marks[question.id], 0) : null;
    const average = available ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null;
    return {
      id: section.id, label: section.label, isDefault: section.isDefault,
      questionLabels: section.questions.map(question => question.label), questionCount: section.questions.length,
      max, score, pct: percent(score, max),
      enteredCount: own ? section.questions.filter(question => typeof own.marks[question.id] === "number").length : participants.length,
      average, averagePct: percent(average, max),
      highest: available && minimumPeers === 0 ? Math.max(...totals) : null,
      lowest: available && minimumPeers === 0 ? Math.min(...totals) : null,
      participantCount: minimumPeers > 0 && !available ? 0 : participants.length,
      peerCount: minimumPeers > 0 && !available ? 0 : participants.length,
      eligible,
    };
  });
}

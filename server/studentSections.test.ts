import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  state: {} as Record<string, unknown>,
  requestedTables: [] as string[],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      mock.requestedTables.push(table);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { data: mock.state }, error: null }) }),
          range: async (start: number, end: number) => ({ data: (mock.tables[table] ?? []).slice(start, end + 1), error: null }),
        }),
      };
    },
  }),
}));

import { getOwnStudentProfile } from "./studentProfile";

const assessmentId = "paper";
const key = (studentId: string) => `${assessmentId}::${studentId}`;
const account = { studentNumber: "OWN001", name: "Own Student" };

beforeEach(() => {
  mock.requestedTables = [];
  mock.state = {
    studentNumbers: { own: "OWN001" },
    assignmentSubmissionStatuses: { [key("late")]: "late", [key("missing")]: "missing" },
  };
  const classStudents = ["own", "peer1", "peer2", "peer3", "partial", "null-score", "late", "missing", "absent"];
  mock.tables = {
    sqgs_school_years: [{ id: "year", label: "2026-2027" }],
    sqgs_year_subjects: [{ id: "year-subject", year_id: "year", subject_id: "subject" }],
    sqgs_classes: [{ id: "class", name: "1A", year_subject_id: "year-subject" }],
    sqgs_students: [
      ...classStudents.map(id => ({ id, class_id: "class", name: id })),
      { id: "other-class", class_id: "other", name: "Other Class" },
    ],
    sqgs_assessments: [{ id: assessmentId, class_id: "class", nature_id: "exam", title: "Test", date: "2026-11-01" }],
    sqgs_assessment_natures: [{ id: "exam", name: "Exam", is_exam: true }],
    sqgs_subjects: [{ id: "subject", code: "MATH", name: "Math" }],
    sqgs_topics: [],
    // Deliberately unsorted: headings must be retained and sorted before grouping.
    sqgs_mark_sheet_items: [
      { id: "q2", label: "Q2", max_mark: 10, sort_order: 4 },
      { id: "section-a", label: "Section A", max_mark: 999, is_section: true, sort_order: 1 },
      { id: "q0", label: "Q0", max_mark: 2, sort_order: 0 },
      { id: "section-b", label: "Section B", max_mark: 999, is_section: true, sort_order: 3 },
      { id: "q1", label: "Q1", max_mark: 8, sort_order: 2 },
    ].map(item => ({ ...item, assessment_id: assessmentId })),
    sqgs_scores: [
      ...marks("own", ["0", 4, 6]),
      ...marks("peer1", [2, 4, 5]),
      ...marks("peer2", [0, 8, 10]),
      ...marks("peer3", [1, 0, 0]),
      ...marks("partial", [2, 8]),
      ...marks("null-score", [2, 8, null]),
      ...["late", "missing", "absent", "other-class"].flatMap(id => marks(id, [2, 8, 10])),
    ],
    sqgs_absent_flags: [{ assessment_id: assessmentId, student_id: "absent" }],
  };
});

function marks(studentId: string, values: Array<number | string | null>) {
  return values.map((value, index) => ({ assessment_id: assessmentId, student_id: studentId, mark_item_id: `q${index}`, value }));
}

async function ownAssessment() {
  const report = await getOwnStudentProfile(account);
  expect(report).not.toBeNull();
  expect(report!.assessments).toHaveLength(1);
  return report!.assessments[0];
}

describe("student assessment section analysis", () => {
  it("retains ordered headings, treats zero as entered, and benchmarks whole completed papers from the same class only", async () => {
    const assessment = await ownAssessment();
    expect(assessment.total).toBe(10);
    expect(assessment.max).toBe(20);
    expect(assessment.questions.map(question => question.label)).toEqual(["Q0", "Q1", "Q2"]);
    expect(assessment.sections.map(section => ({
      label: section.label, questionLabels: section.questionLabels, max: section.max,
      score: section.score, average: section.average, peerCount: section.peerCount,
    }))).toEqual([
      { label: "Ungrouped questions", questionLabels: ["Q0"], max: 2, score: 0, average: 1, peerCount: 3 },
      { label: "Section A", questionLabels: ["Q1"], max: 8, score: 4, average: 4, peerCount: 3 },
      { label: "Section B", questionLabels: ["Q2"], max: 10, score: 6, average: 5, peerCount: 3 },
    ]);
    for (const section of assessment.sections) {
      expect(section.highest).toBeNull();
      expect(section.lowest).toBeNull();
      expect(section.participantCount).toBe(0);
      expect(section.eligible).toBe(true);
    }
    expect(mock.requestedTables).toEqual([
      "sqgs_app_state", "sqgs_school_years", "sqgs_year_subjects", "sqgs_classes", "sqgs_students",
      "sqgs_assessments", "sqgs_assessment_natures", "sqgs_subjects", "sqgs_topics", "sqgs_mark_sheet_items",
      "sqgs_scores", "sqgs_absent_flags",
    ]);
  });

  it("hides averages, extremes and participant counts with fewer than three other completed peers", async () => {
    mock.tables.sqgs_scores = mock.tables.sqgs_scores.filter(score => !(score.student_id === "peer3" && score.mark_item_id === "q2"));
    const assessment = await ownAssessment();
    expect(assessment.classBenchmark).toBeNull();
    for (const section of assessment.sections) {
      expect(section.average).toBeNull();
      expect(section.averagePct).toBeNull();
      expect(section.highest).toBeNull();
      expect(section.lowest).toBeNull();
      expect(section.participantCount).toBe(0);
      expect(section.peerCount).toBe(0);
      expect(section.eligible).toBe(true);
    }
    expect(assessment.sections[0].score).toBe(0);
  });

  it.each(["late", "missing", "absent", "incomplete"] as const)("does not diagnose personal sections for %s while preserving the existing total rule", async status => {
    if (status === "late" || status === "missing") {
      (mock.state.assignmentSubmissionStatuses as Record<string, string>)[key("own")] = status;
    } else if (status === "absent") {
      mock.tables.sqgs_absent_flags.push({ assessment_id: assessmentId, student_id: "own" });
    } else {
      mock.tables.sqgs_scores = mock.tables.sqgs_scores.filter(score => !(score.student_id === "own" && score.mark_item_id === "q2"));
    }
    const assessment = await ownAssessment();
    expect(assessment.status).toBe(status);
    expect(assessment.total).toBe(status === "late" ? 7 : status === "incomplete" ? null : 0);
    for (const section of assessment.sections) {
      expect(section.score).toBeNull();
      expect(section.pct).toBeNull();
      expect(section.eligible).toBe(false);
      expect(section.average).not.toBeNull();
    }
  });

  it("provides a whole-paper default when no section heading is configured", async () => {
    mock.tables.sqgs_mark_sheet_items = mock.tables.sqgs_mark_sheet_items.filter(item => !item.is_section);
    const assessment = await ownAssessment();
    expect(assessment.sections).toHaveLength(1);
    expect(assessment.sections[0]).toMatchObject({ label: "Whole paper", isDefault: true, questionCount: 3, max: 20, score: 10, average: 10 });
  });
});

import { createClient } from "@supabase/supabase-js";
import { buildSectionAnalysis, type SectionAnalysis } from "../shared/sectionAnalysis";

const SUPABASE_URL = "https://mwhppdxrfekyazcliqcc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13aHBwZHhyZmVreWF6Y2xpcWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODg2MzEsImV4cCI6MjA5NjY2NDYzMX0.zIhEw3ItdEqnq_PWeGA-Qwho27PsjKNP96vQuWVj_J8";
const APP_STATE_ID = "default";
const PAGE_SIZE = 1000;
const MINIMUM_PEER_COUNT = 3;

type LocalStudentAccount = { studentNumber: string | null; name: string | null };
type AssessmentStatus = "complete" | "late" | "missing" | "absent" | "incomplete" | "not-entered";
/** Public leaderboard fields approved for the student portal: name and result only. */
type NamedLeaderboardEntry = { rank: number; name: string; total: number; max: number; pct: number; isCurrentStudent: boolean };
type TopicLeaderboard = { id: string; level: string; learningUnit: string; entries: NamedLeaderboardEntry[] };
type ClassBenchmark = { averagePct: number; peerCount: number; rank: number | null; rankedCount: number; leaderboard: NamedLeaderboardEntry[]; topicLeaderboards: TopicLeaderboard[] };

type StudentQuestion = {
  label: string;
  score: number | null;
  max: number;
  pct: number | null;
  /** Aggregate-only comparison; no classmate identity or score is exposed. */
  classBenchmark: { average: number; pct: number; peerCount: number } | null;
  topic: { level: string; learningUnit: string; objective: string } | null;
};

type StudentAssessment = {
  id: string;
  yearLabel: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  code: string;
  title: string;
  date: string;
  term: string;
  nature: string;
  isExam: boolean;
  status: AssessmentStatus;
  total: number | null;
  max: number;
  pct: number | null;
  /** Named public leaderboard approved by the teacher; excludes account data. */
  classBenchmark: ClassBenchmark | null;
  questions: StudentQuestion[];
  sections: SectionAnalysis[];
};

type TopicSummary = {
  id: string;
  learningUnit: string;
  objective: string;
  level: string;
  earned: number;
  max: number;
  pct: number;
  itemCount: number;
  assessmentCount: number;
};

type CalculatedAssessment = {
  status: AssessmentStatus;
  total: number | null;
  max: number;
  pct: number | null;
  scoreMap: Map<string, number | null>;
};

async function fetchAllRows<T>(client: any, table: string, select = "*"): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.from(table).select(select).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load student report data from ${table}`);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
    offset += PAGE_SIZE;
  }
}

const asNumber = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0);
const numericScore = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const displayText = (zh: unknown, fallback: unknown) => String(zh || fallback || "未命名");

function calculateAssessment(
  assessmentId: string,
  studentId: string,
  questions: Record<string, unknown>[],
  scoresByAssessmentStudent: Map<string, Record<string, unknown>[]>,
  absentFlags: Set<string>,
  assignmentStatuses: Record<string, "late" | "missing">,
): CalculatedAssessment {
  const scoreMap = new Map(
    (scoresByAssessmentStudent.get(`${assessmentId}::${studentId}`) ?? [])
      .map(score => [String(score.mark_item_id), numericScore(score.value)] as const),
  );
  const absent = absentFlags.has(`${assessmentId}::${studentId}`);
  const assignmentStatus = assignmentStatuses[`${assessmentId}::${studentId}`];
  const isComplete = questions.length > 0 && questions.every(question => scoreMap.get(String(question.id)) !== null && scoreMap.get(String(question.id)) !== undefined);
  const max = questions.reduce((sum, question) => sum + asNumber(question.max_mark), 0);

  if (absent) return { status: "absent", total: 0, max, pct: max > 0 ? 0 : null, scoreMap };
  if (assignmentStatus === "missing") return { status: "missing", total: 0, max, pct: max > 0 ? 0 : null, scoreMap };
  if (isComplete) {
    const rawTotal = questions.reduce((sum, question) => sum + (scoreMap.get(String(question.id)) ?? 0), 0);
    const total = assignmentStatus === "late" ? Math.round(rawTotal * 70) / 100 : rawTotal;
    return { status: assignmentStatus === "late" ? "late" : "complete", total, max, pct: max > 0 ? Math.round((total / max) * 100) : null, scoreMap };
  }
  if (scoreMap.size > 0) return { status: "incomplete", total: null, max, pct: null, scoreMap };
  return { status: "not-entered", total: null, max, pct: null, scoreMap };
}

/**
 * Builds a report for the authenticated student. Personal question-level marks
 * are emitted only for that student. The teacher-approved public leaderboards
 * expose only names and score results—never student numbers or account data—
 * and require three or more other on-time completed peers.
 */
export async function getOwnStudentProfile(account: LocalStudentAccount) {
  const studentNumber = account.studentNumber?.trim().toLocaleUpperCase();
  if (!studentNumber) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const [appStateRes, years, yearSubjects, classes, students, assessments, natures, subjects, topics, markItems] = await Promise.all([
    supabase.from("sqgs_app_state").select("data").eq("id", APP_STATE_ID).maybeSingle(),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_school_years"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_year_subjects"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_classes"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_students"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_assessments"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_assessment_natures"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_subjects"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_topics"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_mark_sheet_items"),
  ]);

  const state = (appStateRes.data?.data ?? {}) as Record<string, unknown>;
  const studentNumberMap = (state.studentNumbers ?? {}) as Record<string, string>;
  const assignmentStatuses = (state.assignmentSubmissionStatuses ?? {}) as Record<string, "late" | "missing">;
  const ownStudents = students.filter(row => String(studentNumberMap[String(row.id)] ?? "").trim().toLocaleUpperCase() === studentNumber);
  if (ownStudents.length === 0) return null;

  const ownStudentIds = new Set(ownStudents.map(row => String(row.id)));
  const [scores, absentFlags] = await Promise.all([
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_scores"),
    fetchAllRows<Record<string, unknown>>(supabase, "sqgs_absent_flags"),
  ]);

  const yearById = new Map(years.map(row => [String(row.id), String(row.label)]));
  const yearSubjectById = new Map(yearSubjects.map(row => [String(row.id), row]));
  const classById = new Map(classes.map(row => [String(row.id), row]));
  const subjectById = new Map(subjects.map(row => [String(row.id), row]));
  const natureById = new Map(natures.map(row => [String(row.id), row]));
  const topicById = new Map(topics.map(row => [String(row.id), row]));
  const studentsByClassId = new Map<string, Record<string, unknown>[]>();
  students.forEach(student => {
    const classId = String(student.class_id);
    studentsByClassId.set(classId, [...(studentsByClassId.get(classId) ?? []), student]);
  });
  const marksByAssessment = new Map<string, Record<string, unknown>[]>();
  markItems.forEach(item => {
    const key = String(item.assessment_id);
    marksByAssessment.set(key, [...(marksByAssessment.get(key) ?? []), item]);
  });
  const scoresByAssessmentStudent = new Map<string, Record<string, unknown>[]>();
  scores.forEach(score => {
    const key = `${score.assessment_id}::${score.student_id}`;
    scoresByAssessmentStudent.set(key, [...(scoresByAssessmentStudent.get(key) ?? []), score]);
  });
  const absentFlagSet = new Set(absentFlags.map(row => `${row.assessment_id}::${row.student_id}`));

  const reportAssessments: StudentAssessment[] = [];
  for (const assessment of assessments) {
    const classRow = classById.get(String(assessment.class_id));
    if (!classRow) continue;
    const ownStudent = (studentsByClassId.get(String(classRow.id)) ?? []).find(student => ownStudentIds.has(String(student.id)));
    if (!ownStudent) continue;

    const yearSubject = yearSubjectById.get(String(classRow.year_subject_id));
    if (!yearSubject) continue;
    const subject = subjectById.get(String(yearSubject.subject_id));
    const nature = natureById.get(String(assessment.nature_id));
    const assessmentId = String(assessment.id);
    const studentId = String(ownStudent.id);
    const markSheet = [...(marksByAssessment.get(assessmentId) ?? [])]
      .sort((a, b) => asNumber(a.sort_order) - asNumber(b.sort_order));
    const questions = markSheet.filter(item => !Boolean(item.is_section));
    const ownCalculated = calculateAssessment(assessmentId, studentId, questions, scoresByAssessmentStudent, absentFlagSet, assignmentStatuses);

    const sections = buildSectionAnalysis(
      markSheet.map(item => ({ id: String(item.id), label: String(item.label), maxMark: asNumber(item.max_mark), isSection: Boolean(item.is_section) })),
      (studentsByClassId.get(String(classRow.id)) ?? []).map(student => {
        const entryStudentId = String(student.id);
        const entryKey = `${assessmentId}::${entryStudentId}`;
        return {
          studentId: entryStudentId,
          scores: (scoresByAssessmentStudent.get(entryKey) ?? []).map(score => ({ itemId: String(score.mark_item_id), score: numericScore(score.value) })),
          isAbsent: absentFlagSet.has(entryKey),
          assignmentStatus: assignmentStatuses[entryKey],
        };
      }),
      studentId,
      MINIMUM_PEER_COUNT,
    ).map(section => ({
      ...section,
      // Student section analysis exposes aggregate averages only, never peer
      // extremes or participant counts (including below the privacy threshold).
      highest: null,
      lowest: null,
      participantCount: 0,
      peerCount: section.average !== null ? section.peerCount : 0,
    }));

    // Rankings include normal, fully completed work only; ABS, late, missing and
    // incomplete entries remain excluded from class comparison.
    const completedPeers = (studentsByClassId.get(String(classRow.id)) ?? [])
      .filter(peer => String(peer.id) !== studentId)
      .map(peer => ({
        id: String(peer.id),
        name: displayText(peer.name_cht, peer.name),
        result: calculateAssessment(assessmentId, String(peer.id), questions, scoresByAssessmentStudent, absentFlagSet, assignmentStatuses),
      }))
      .filter(peer => peer.result.status === "complete" && peer.result.pct !== null);
    const peerPcts = completedPeers.map(peer => peer.result.pct as number);
    const eligibleForRank = ownCalculated.status === "complete" && ownCalculated.total !== null && ownCalculated.pct !== null;
    const leaderboardCandidates = [
      ...completedPeers.map(peer => ({ name: peer.name, total: peer.result.total ?? 0, max: peer.result.max, pct: peer.result.pct as number, isCurrentStudent: false })),
      ...(eligibleForRank ? [{ name: displayText(ownStudent.name_cht, ownStudent.name), total: ownCalculated.total as number, max: ownCalculated.max, pct: ownCalculated.pct as number, isCurrentStudent: true }] : []),
    ].sort((a, b) => b.pct - a.pct || b.total - a.total);
    let previousPct: number | null = null;
    let previousRank = 0;
    const namedLeaderboard = leaderboardCandidates.map((entry, index) => {
      const rank = previousPct === entry.pct ? previousRank : index + 1;
      previousPct = entry.pct;
      previousRank = rank;
      return { ...entry, rank };
    });
    const topicGroups = new Map<string, { id: string; level: string; learningUnit: string; questions: Record<string, unknown>[] }>();
    questions.forEach(question => {
      if (!question.topic_id || asNumber(question.max_mark) <= 0) return;
      const topic = topicById.get(String(question.topic_id));
      if (!topic) return;
      const level = String(topic.level || "未設定程度");
      const learningUnit = String(topic.learning_unit || "未分類單元");
      const id = `${level}::${learningUnit}`;
      const group = topicGroups.get(id) ?? { id, level, learningUnit, questions: [] };
      group.questions.push(question);
      topicGroups.set(id, group);
    });
    const rankEntries = (entries: Array<{ name: string; total: number; max: number; pct: number; isCurrentStudent: boolean }>): NamedLeaderboardEntry[] => {
      const sorted = [...entries].sort((a, b) => b.pct - a.pct || b.total - a.total);
      let lastPct: number | null = null;
      let lastRank = 0;
      return sorted.map((entry, index) => {
        const rank = lastPct === entry.pct ? lastRank : index + 1;
        lastPct = entry.pct;
        lastRank = rank;
        return { ...entry, rank };
      });
    };
    const topicLeaderboards: TopicLeaderboard[] = eligibleForRank && peerPcts.length >= MINIMUM_PEER_COUNT
      ? Array.from(topicGroups.values()).map(group => {
          const scoreFor = (result: CalculatedAssessment) => {
            const max = group.questions.reduce((sum, question) => sum + asNumber(question.max_mark), 0);
            const total = group.questions.reduce((sum, question) => sum + (result.scoreMap.get(String(question.id)) ?? 0), 0);
            return { total, max, pct: max > 0 ? Math.round((total / max) * 100) : 0 };
          };
          return {
            id: group.id,
            level: group.level,
            learningUnit: group.learningUnit,
            entries: rankEntries([
              ...completedPeers.map(peer => ({ name: peer.name, ...scoreFor(peer.result), isCurrentStudent: false })),
              { name: displayText(ownStudent.name_cht, ownStudent.name), ...scoreFor(ownCalculated), isCurrentStudent: true },
            ]),
          };
        }).filter(group => group.entries.length >= MINIMUM_PEER_COUNT + 1)
      : [];
    const classBenchmark: ClassBenchmark | null = peerPcts.length >= MINIMUM_PEER_COUNT
      ? {
          averagePct: Math.round(peerPcts.reduce((sum, pct) => sum + pct, 0) / peerPcts.length),
          peerCount: peerPcts.length,
          // Teacher-approved student-facing standings show names/results only.
          rank: eligibleForRank ? 1 + peerPcts.filter(pct => pct > ownCalculated.pct!).length : null,
          rankedCount: eligibleForRank ? peerPcts.length + 1 : peerPcts.length,
          leaderboard: namedLeaderboard,
          topicLeaderboards,
        }
      : null;

    const questionDetails: StudentQuestion[] = questions.map(question => {
      const score = ownCalculated.status === "complete" || ownCalculated.status === "late" ? ownCalculated.scoreMap.get(String(question.id)) ?? null : null;
      const maxMark = asNumber(question.max_mark);
      const peerQuestionScores = completedPeers
        .map(peer => peer.result.scoreMap.get(String(question.id)))
        .filter((value): value is number => value !== null && value !== undefined);
      const classBenchmark = peerQuestionScores.length >= MINIMUM_PEER_COUNT && maxMark > 0
        ? {
            average: Math.round((peerQuestionScores.reduce((sum, value) => sum + value, 0) / peerQuestionScores.length) * 100) / 100,
            pct: Math.round((peerQuestionScores.reduce((sum, value) => sum + value, 0) / peerQuestionScores.length / maxMark) * 100),
            peerCount: peerQuestionScores.length,
          }
        : null;
      const topic = question.topic_id ? topicById.get(String(question.topic_id)) : undefined;
      return {
        label: String(question.label),
        score,
        max: maxMark,
        pct: score !== null && maxMark > 0 ? Math.round((score / maxMark) * 100) : null,
        classBenchmark,
        topic: topic ? {
          level: String(topic.level || "未設定程度"),
          learningUnit: String(topic.learning_unit || "未分類單元"),
          objective: displayText(topic.name_cht, topic.learning_objective || topic.name),
        } : null,
      };
    });
    reportAssessments.push({
      id: `${String(yearSubject.year_id)}-${String(yearSubject.subject_id)}-${String(classRow.id)}-${assessmentId}`,
      yearLabel: yearById.get(String(yearSubject.year_id)) ?? "未分類學年",
      subjectId: String(yearSubject.subject_id),
      subjectCode: String(subject?.code || "Subject"),
      subjectName: displayText(subject?.name_cht, subject?.name),
      className: String(classRow.name),
      code: String(assessment.code || ""),
      title: displayText(assessment.title_cht, assessment.title),
      date: String(assessment.date || ""),
      term: String(assessment.term || ""),
      nature: displayText(nature?.name_cht, nature?.name),
      isExam: Boolean(nature?.is_exam),
      status: ownCalculated.status,
      total: ownCalculated.total,
      max: ownCalculated.max,
      pct: ownCalculated.pct,
      classBenchmark,
      questions: questionDetails,
      sections,
    });
  }

  reportAssessments.sort((a, b) => `${a.yearLabel}-${a.date}-${a.id}`.localeCompare(`${b.yearLabel}-${b.date}-${b.id}`));
  const topicGroups = new Map<string, TopicSummary & { assessmentIds: Set<string> }>();
  reportAssessments.filter(assessment => assessment.status === "complete").forEach(assessment => {
    assessment.questions.forEach(question => {
      if (!question.topic || question.score === null) return;
      const key = `${assessment.subjectId}::${question.topic.learningUnit}::${question.topic.objective}`;
      const current = topicGroups.get(key) ?? { id: key, learningUnit: question.topic.learningUnit, objective: question.topic.objective, level: question.topic.level, earned: 0, max: 0, pct: 0, itemCount: 0, assessmentCount: 0, assessmentIds: new Set<string>() };
      current.earned += question.score;
      current.max += question.max;
      current.itemCount += 1;
      current.assessmentIds.add(assessment.id);
      topicGroups.set(key, current);
    });
  });
  const topicsSummary = Array.from(topicGroups.values()).map(topic => ({
    id: topic.id,
    learningUnit: topic.learningUnit,
    objective: topic.objective,
    level: topic.level,
    earned: topic.earned,
    max: topic.max,
    pct: topic.max > 0 ? Math.round((topic.earned / topic.max) * 100) : 0,
    itemCount: topic.itemCount,
    assessmentCount: topic.assessmentIds.size,
  })).sort((a, b) => a.pct - b.pct);

  const subjectGroups = new Map<string, { subjectId: string; subjectCode: string; subjectName: string; records: StudentAssessment[] }>();
  reportAssessments.forEach(record => {
    const group = subjectGroups.get(record.subjectId) ?? { subjectId: record.subjectId, subjectCode: record.subjectCode, subjectName: record.subjectName, records: [] };
    group.records.push(record);
    subjectGroups.set(record.subjectId, group);
  });
  const personalScored = reportAssessments.filter(record => record.pct !== null);
  const ownNames = ownStudents.map(student => displayText(student.name_cht, student.name));

  return {
    student: { studentNumber, name: account.name?.trim() || ownNames[0] || studentNumber, observedNames: Array.from(new Set(ownNames)), recordCount: ownStudents.length },
    summary: {
      assessmentCount: reportAssessments.length,
      scoredCount: personalScored.length,
      averagePct: personalScored.length ? Math.round(personalScored.reduce((sum, record) => sum + (record.pct ?? 0), 0) / personalScored.length) : null,
      absentCount: reportAssessments.filter(record => record.status === "absent").length,
      lateCount: reportAssessments.filter(record => record.status === "late").length,
      missingCount: reportAssessments.filter(record => record.status === "missing").length,
    },
    subjects: Array.from(subjectGroups.values()).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode, undefined, { numeric: true })),
    assessments: reportAssessments,
    topics: topicsSummary,
  };
}

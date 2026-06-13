/**
 * Supabase client + relational CRUD helpers
 * Tables: sqgs_teachers, sqgs_assessment_natures, sqgs_subjects, sqgs_topics,
 *         sqgs_weighting_schemes, sqgs_weighting_entries, sqgs_syllabus_items,
 *         sqgs_school_years, sqgs_year_subjects, sqgs_classes, sqgs_students,
 *         sqgs_assessments, sqgs_assessment_topics, sqgs_mark_sheet_items, sqgs_scores
 */
import { createClient } from '@supabase/supabase-js';
import type {
  Teacher, AssessmentNature, Subject, Topic, WeightingScheme,
  SyllabusItem, SchoolYear, YearSubject, Class, Student,
  Assessment, MarkItem, ScoreEntry
} from '@/contexts/DataContext';

const SUPABASE_URL = 'https://mwhppdxrfekyazcliqcc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13aHBwZHhyZmVreWF6Y2xpcWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODg2MzEsImV4cCI6MjA5NjY2NDYzMX0.zIhEw3ItdEqnq_PWeGA-Qwho27PsjKNP96vQuWVj_J8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Type helpers for DB rows ─────────────────────────────────────────────────

interface DbTeacher {
  id: string; name: string; name_cht: string; code: string; email: string;
}
interface DbNature {
  id: string; name: string; name_cht: string; color: string; is_exam: boolean;
}
interface DbSubject {
  id: string; name: string; name_cht: string; code: string; form: string;
}
interface DbTopic {
  id: string; subject_id: string; code: string; name: string; name_cht: string;
  sort_order: number; color?: string; level?: string; strand?: string;
  learning_unit?: string; learning_objective?: string; category?: string;
  remarks?: string; from_syllabus: boolean;
}
interface DbWeightingScheme {
  id: string; form: string; subject_id: string; label: string; exam_percentage: number;
}
interface DbWeightingEntry {
  id?: number; scheme_id: string; nature_id: string; percentage: number;
}
interface DbSyllabusItem {
  id: string; level: string; strand: string; learning_unit: string;
  learning_objective: string; category: string; remarks: string;
}
interface DbSchoolYear { id: string; label: string; }
interface DbYearSubject { id: number; year_id: string; subject_id: string; }
interface DbClass {
  id: string; year_subject_id: number; name: string; form: string; teacher_id?: string;
}
interface DbStudent {
  id: string; class_id: string; class_no: string; name: string; name_cht: string;
}
interface DbAssessment {
  id: string; class_id: string; code: string; title: string; title_cht: string;
  term: string; nature_id?: string; teacher_id?: string; date: string;
}
interface DbAssessmentTopic { assessment_id: string; topic_id: string; }
interface DbMarkSheetItem {
  id: string; assessment_id: string; label: string; max_mark: number;
  is_section: boolean; topic_id?: string; sort_order: number;
}
interface DbScore {
  id?: number; assessment_id: string; student_id: string; mark_item_id: string; value?: number | null;
}

// ─── Converters: DB row → App type ───────────────────────────────────────────

function dbToTeacher(r: DbTeacher): Teacher {
  return { id: r.id, name: r.name, nameCht: r.name_cht, code: r.code, email: r.email };
}
function dbToNature(r: DbNature): AssessmentNature {
  return { id: r.id, name: r.name, nameCht: r.name_cht, color: r.color, isExam: r.is_exam };
}
function dbToTopic(r: DbTopic): Topic {
  return {
    id: r.id, code: r.code, name: r.name, nameCht: r.name_cht, order: r.sort_order,
    color: r.color, level: r.level, strand: r.strand, learningUnit: r.learning_unit,
    learningObjective: r.learning_objective, category: r.category, remarks: r.remarks,
  };
}
function dbToSubject(r: DbSubject, topics: Topic[]): Subject {
  return { id: r.id, name: r.name, nameCht: r.name_cht, code: r.code, form: r.form, topics };
}
function dbToSyllabusItem(r: DbSyllabusItem): SyllabusItem {
  return {
    id: r.id, level: r.level, strand: r.strand, learningUnit: r.learning_unit,
    learningObjective: r.learning_objective, category: r.category, remarks: r.remarks,
  };
}

// ─── Converters: App type → DB row ───────────────────────────────────────────

function teacherToDb(t: Teacher): DbTeacher {
  return { id: t.id, name: t.name, name_cht: t.nameCht, code: t.code, email: t.email };
}
function natureToDb(n: AssessmentNature): DbNature {
  return { id: n.id, name: n.name, name_cht: n.nameCht, color: n.color, is_exam: n.isExam };
}
function subjectToDb(s: Subject): DbSubject {
  return { id: s.id, name: s.name, name_cht: s.nameCht, code: s.code, form: s.form };
}
function topicToDb(t: Topic, subjectId: string): DbTopic {
  return {
    id: t.id, subject_id: subjectId, code: t.code, name: t.name, name_cht: t.nameCht,
    sort_order: t.order, color: t.color, level: t.level, strand: t.strand,
    learning_unit: t.learningUnit, learning_objective: t.learningObjective,
    category: t.category, remarks: t.remarks,
    from_syllabus: !!t.learningObjective,
  };
}
function syllabusItemToDb(s: SyllabusItem): DbSyllabusItem {
  return {
    id: s.id, level: s.level, strand: s.strand, learning_unit: s.learningUnit,
    learning_objective: s.learningObjective, category: s.category, remarks: s.remarks,
  };
}

// ─── Full state load ──────────────────────────────────────────────────────────

export interface FullAppState {
  teachers: Teacher[];
  natures: AssessmentNature[];
  weightingSchemes: WeightingScheme[];
  subjects: Subject[];
  schoolYears: SchoolYear[];
  syllabusItems: SyllabusItem[];
}

export async function loadFullState(): Promise<FullAppState | null> {
  try {
    // Fetch all tables in parallel
    const [
      teachersRes, naturesRes, subjectsRes, topicsRes,
      wsRes, weRes, syllabusRes,
      yearsRes, ysRes, classesRes, studentsRes,
      asmtsRes, atRes, msRes, scoresRes, absentRes,
    ] = await Promise.all([
      supabase.from('sqgs_teachers').select('*').order('name'),
      supabase.from('sqgs_assessment_natures').select('*').order('name'),
      supabase.from('sqgs_subjects').select('*').order('name'),
      supabase.from('sqgs_topics').select('*').order('sort_order'),
      supabase.from('sqgs_weighting_schemes').select('*'),
      supabase.from('sqgs_weighting_entries').select('*'),
      supabase.from('sqgs_syllabus_items').select('*').order('learning_unit'),
      supabase.from('sqgs_school_years').select('*').order('label', { ascending: false }),
      supabase.from('sqgs_year_subjects').select('*'),
      supabase.from('sqgs_classes').select('*').order('name'),
      supabase.from('sqgs_students').select('*').order('class_no'),
      supabase.from('sqgs_assessments').select('*').order('date'),
      supabase.from('sqgs_assessment_topics').select('*'),
      supabase.from('sqgs_mark_sheet_items').select('*').order('sort_order'),
      supabase.from('sqgs_scores').select('*'),
      supabase.from('sqgs_absent_flags').select('*'),
    ]);

    // Check for errors
    const errors = [teachersRes, naturesRes, subjectsRes, topicsRes, wsRes, weRes,
      syllabusRes, yearsRes, ysRes, classesRes, studentsRes, asmtsRes, atRes, msRes, scoresRes, absentRes]
      .filter(r => r.error);
    if (errors.length > 0) {
      console.error('Supabase load errors:', errors.map(r => r.error));
      return null;
    }

    const dbTeachers = (teachersRes.data ?? []) as DbTeacher[];
    const dbNatures = (naturesRes.data ?? []) as DbNature[];
    const dbSubjects = (subjectsRes.data ?? []) as DbSubject[];
    const dbTopics = (topicsRes.data ?? []) as DbTopic[];
    const dbWS = (wsRes.data ?? []) as DbWeightingScheme[];
    const dbWE = (weRes.data ?? []) as DbWeightingEntry[];
    const dbSyllabus = (syllabusRes.data ?? []) as DbSyllabusItem[];
    const dbYears = (yearsRes.data ?? []) as DbSchoolYear[];
    const dbYS = (ysRes.data ?? []) as DbYearSubject[];
    const dbClasses = (classesRes.data ?? []) as DbClass[];
    const dbStudents = (studentsRes.data ?? []) as DbStudent[];
    const dbAsmts = (asmtsRes.data ?? []) as DbAssessment[];
    const dbAT = (atRes.data ?? []) as DbAssessmentTopic[];
    const dbMS = (msRes.data ?? []) as DbMarkSheetItem[];
    const dbScores = (scoresRes.data ?? []) as DbScore[];
    const dbAbsent = (absentRes.data ?? []) as { assessment_id: string; student_id: string }[];

    // Build teachers
    const teachers: Teacher[] = dbTeachers.map(dbToTeacher);

    // Build natures
    const natures: AssessmentNature[] = dbNatures.map(dbToNature);

    // Build subjects with topics
    const subjects: Subject[] = dbSubjects.map(s => {
      const topics = dbTopics
        .filter(t => t.subject_id === s.id)
        .map(dbToTopic)
        .sort((a, b) => a.order - b.order);
      return dbToSubject(s, topics);
    });

    // Build weighting schemes with entries
    const weightingSchemes: WeightingScheme[] = dbWS.map(ws => ({
      id: ws.id,
      form: ws.form,
      subjectId: ws.subject_id,
      label: ws.label,
      examPercentage: Number(ws.exam_percentage),
      caEntries: dbWE
        .filter(e => e.scheme_id === ws.id)
        .map(e => ({ natureId: e.nature_id, percentage: Number(e.percentage) })),
    }));

    // Build syllabus items
    const syllabusItems: SyllabusItem[] = dbSyllabus.map(dbToSyllabusItem);

    // Build mark sheet items map: assessmentId → MarkItem[]
    const markSheetMap = new Map<string, MarkItem[]>();
    for (const ms of dbMS) {
      if (!markSheetMap.has(ms.assessment_id)) markSheetMap.set(ms.assessment_id, []);
      markSheetMap.get(ms.assessment_id)!.push({
        id: ms.id, label: ms.label, maxMark: Number(ms.max_mark),
        isSection: ms.is_section, topicId: ms.topic_id,
      });
    }

    // Build scores map: assessmentId → ScoreEntry[]
    const scoresMap = new Map<string, Map<string, ScoreEntry>>();
    for (const sc of dbScores) {
      if (!scoresMap.has(sc.assessment_id)) scoresMap.set(sc.assessment_id, new Map());
      const byStudent = scoresMap.get(sc.assessment_id)!;
      if (!byStudent.has(sc.student_id)) {
        byStudent.set(sc.student_id, { studentId: sc.student_id, scores: {} });
      }
      byStudent.get(sc.student_id)!.scores[sc.mark_item_id] = sc.value ?? null;
    }
    // Mark absent students
    for (const ab of dbAbsent) {
      if (!scoresMap.has(ab.assessment_id)) scoresMap.set(ab.assessment_id, new Map());
      const byStudent = scoresMap.get(ab.assessment_id)!;
      if (!byStudent.has(ab.student_id)) {
        byStudent.set(ab.student_id, { studentId: ab.student_id, scores: {} });
      }
      byStudent.get(ab.student_id)!.isAbsent = true;
    }

    // Build assessment topics map: assessmentId → topicIds[]
    const atMap = new Map<string, string[]>();
    for (const at of dbAT) {
      if (!atMap.has(at.assessment_id)) atMap.set(at.assessment_id, []);
      atMap.get(at.assessment_id)!.push(at.topic_id);
    }

    // Build assessments
    const assessmentMap = new Map<string, Assessment>();
    for (const a of dbAsmts) {
      const markSheet = (markSheetMap.get(a.id) ?? []).sort((x, y) => {
        const xi = dbMS.find(m => m.id === x.id)?.sort_order ?? 0;
        const yi = dbMS.find(m => m.id === y.id)?.sort_order ?? 0;
        return xi - yi;
      });
      const scoresForAsmt = scoresMap.get(a.id);
      const scores: ScoreEntry[] = scoresForAsmt ? Array.from(scoresForAsmt.values()) : [];
      assessmentMap.set(a.id, {
        id: a.id, code: a.code, title: a.title, titleCht: a.title_cht,
        term: a.term as Assessment['term'], natureId: a.nature_id ?? '',
        teacherId: a.teacher_id ?? '', date: a.date,
        topicIds: atMap.get(a.id) ?? [],
        markSheet, scores,
      });
    }

    // Build classes map: classId → Class
    const classMap = new Map<string, Class>();
    for (const cls of dbClasses) {
      const students: Student[] = dbStudents
        .filter(s => s.class_id === cls.id)
        .map(s => ({ id: s.id, classNo: s.class_no, name: s.name, nameCht: s.name_cht }));
      const assessments: Assessment[] = dbAsmts
        .filter(a => a.class_id === cls.id)
        .map(a => assessmentMap.get(a.id)!)
        .filter(Boolean);
      classMap.set(cls.id, {
        id: cls.id, name: cls.name, form: cls.form,
        teacherId: cls.teacher_id ?? '',
        students, assessments,
      });
    }

    // Build school years
    const schoolYears: SchoolYear[] = dbYears.map(y => {
      const yearSubjects: YearSubject[] = dbYS
        .filter(ys => ys.year_id === y.id)
        .map(ys => ({
          subjectId: ys.subject_id,
          classes: dbClasses
            .filter(c => c.year_subject_id === ys.id)
            .map(c => classMap.get(c.id)!)
            .filter(Boolean),
        }));
      return { id: y.id, label: y.label, subjects: yearSubjects };
    });

    return { teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems };
  } catch (err) {
    console.error('loadFullState error:', err);
    return null;
  }
}

// ─── Incremental save helpers ─────────────────────────────────────────────────

/** Save all teachers (upsert) */
export async function saveTeachers(teachers: Teacher[]) {
  if (teachers.length === 0) return;
  const { error } = await supabase
    .from('sqgs_teachers')
    .upsert(teachers.map(teacherToDb), { onConflict: 'id' });
  if (error) console.error('saveTeachers error:', error);
}

/** Delete a teacher */
export async function deleteTeacherDb(id: string) {
  const { error } = await supabase.from('sqgs_teachers').delete().eq('id', id);
  if (error) console.error('deleteTeacher error:', error);
}

/** Save all natures (upsert) */
export async function saveNatures(natures: AssessmentNature[]) {
  if (natures.length === 0) return;
  const { error } = await supabase
    .from('sqgs_assessment_natures')
    .upsert(natures.map(natureToDb), { onConflict: 'id' });
  if (error) console.error('saveNatures error:', error);
}

/** Delete a nature */
export async function deleteNatureDb(id: string) {
  const { error } = await supabase.from('sqgs_assessment_natures').delete().eq('id', id);
  if (error) console.error('deleteNature error:', error);
}

/** Save a subject (upsert) */
export async function saveSubject(subject: Subject) {
  const { error } = await supabase
    .from('sqgs_subjects')
    .upsert(subjectToDb(subject), { onConflict: 'id' });
  if (error) console.error('saveSubject error:', error);
}

/** Delete a subject */
export async function deleteSubjectDb(id: string) {
  const { error } = await supabase.from('sqgs_subjects').delete().eq('id', id);
  if (error) console.error('deleteSubject error:', error);
}

/** Save topics for a subject (upsert all) */
export async function saveTopics(subjectId: string, topics: Topic[]) {
  if (topics.length === 0) return;
  const { error } = await supabase
    .from('sqgs_topics')
    .upsert(topics.map(t => topicToDb(t, subjectId)), { onConflict: 'id' });
  if (error) console.error('saveTopics error:', error);
}

/** Delete a topic */
export async function deleteTopicDb(id: string) {
  const { error } = await supabase.from('sqgs_topics').delete().eq('id', id);
  if (error) console.error('deleteTopic error:', error);
}

/** Replace all syllabus-sourced topics for a subject */
export async function replaceSubjectTopicsDb(subjectId: string, topics: Topic[]) {
  // Delete all existing topics for this subject that are from_syllabus
  await supabase.from('sqgs_topics').delete().eq('subject_id', subjectId).eq('from_syllabus', true);
  if (topics.length > 0) {
    const { error } = await supabase
      .from('sqgs_topics')
      .upsert(topics.map(t => topicToDb(t, subjectId)), { onConflict: 'id' });
    if (error) console.error('replaceSubjectTopics error:', error);
  }
}

/** Save weighting scheme with entries */
export async function saveWeightingScheme(ws: WeightingScheme) {
  const { error: wsErr } = await supabase
    .from('sqgs_weighting_schemes')
    .upsert({
      id: ws.id, form: ws.form, subject_id: ws.subjectId,
      label: ws.label, exam_percentage: ws.examPercentage,
    }, { onConflict: 'id' });
  if (wsErr) { console.error('saveWeightingScheme error:', wsErr); return; }

  // Replace entries: delete old, insert new
  await supabase.from('sqgs_weighting_entries').delete().eq('scheme_id', ws.id);
  if (ws.caEntries.length > 0) {
    const { error: weErr } = await supabase
      .from('sqgs_weighting_entries')
      .insert(ws.caEntries.map(e => ({
        scheme_id: ws.id, nature_id: e.natureId, percentage: e.percentage,
      })));
    if (weErr) console.error('saveWeightingEntries error:', weErr);
  }
}

/** Delete a weighting scheme */
export async function deleteWeightingSchemeDb(id: string) {
  const { error } = await supabase.from('sqgs_weighting_schemes').delete().eq('id', id);
  if (error) console.error('deleteWeightingScheme error:', error);
}

/** Save syllabus items (replace all) */
export async function saveSyllabusItems(items: SyllabusItem[]) {
  // Delete all existing, then insert new
  await supabase.from('sqgs_syllabus_items').delete().neq('id', '');
  if (items.length > 0) {
    const { error } = await supabase
      .from('sqgs_syllabus_items')
      .insert(items.map(syllabusItemToDb));
    if (error) console.error('saveSyllabusItems error:', error);
  }
}

/** Save a school year */
export async function saveSchoolYear(year: SchoolYear) {
  const { error } = await supabase
    .from('sqgs_school_years')
    .upsert({ id: year.id, label: year.label }, { onConflict: 'id' });
  if (error) console.error('saveSchoolYear error:', error);
}

/** Delete a school year */
export async function deleteSchoolYearDb(id: string) {
  const { error } = await supabase.from('sqgs_school_years').delete().eq('id', id);
  if (error) console.error('deleteSchoolYear error:', error);
}

/** Ensure year-subject link exists, returns the year_subject id */
export async function ensureYearSubject(yearId: string, subjectId: string): Promise<number | null> {
  // Try to get existing
  const { data: existing } = await supabase
    .from('sqgs_year_subjects')
    .select('id')
    .eq('year_id', yearId)
    .eq('subject_id', subjectId)
    .single();
  if (existing) return existing.id;

  // Insert new
  const { data, error } = await supabase
    .from('sqgs_year_subjects')
    .insert({ year_id: yearId, subject_id: subjectId })
    .select('id')
    .single();
  if (error) { console.error('ensureYearSubject error:', error); return null; }
  return data?.id ?? null;
}

/** Remove year-subject link */
export async function removeYearSubjectDb(yearId: string, subjectId: string) {
  const { error } = await supabase
    .from('sqgs_year_subjects')
    .delete()
    .eq('year_id', yearId)
    .eq('subject_id', subjectId);
  if (error) console.error('removeYearSubject error:', error);
}

/** Get year_subject id */
export async function getYearSubjectId(yearId: string, subjectId: string): Promise<number | null> {
  const { data } = await supabase
    .from('sqgs_year_subjects')
    .select('id')
    .eq('year_id', yearId)
    .eq('subject_id', subjectId)
    .single();
  return data?.id ?? null;
}

/** Save a class */
export async function saveClass(cls: Class, yearSubjectId: number) {
  const { error } = await supabase
    .from('sqgs_classes')
    .upsert({
      id: cls.id, year_subject_id: yearSubjectId,
      name: cls.name, form: cls.form,
      teacher_id: cls.teacherId || null,
    }, { onConflict: 'id' });
  if (error) console.error('saveClass error:', error);
}

/** Delete a class */
export async function deleteClassDb(id: string) {
  const { error } = await supabase.from('sqgs_classes').delete().eq('id', id);
  if (error) console.error('deleteClass error:', error);
}

/** Save a student */
export async function saveStudent(student: Student, classId: string) {
  const { error } = await supabase
    .from('sqgs_students')
    .upsert({
      id: student.id, class_id: classId,
      class_no: student.classNo, name: student.name, name_cht: student.nameCht,
    }, { onConflict: 'id' });
  if (error) console.error('saveStudent error:', error);
}

/** Save multiple students (bulk) */
export async function saveStudents(students: Student[], classId: string) {
  if (students.length === 0) return;
  const { error } = await supabase
    .from('sqgs_students')
    .upsert(
      students.map(s => ({ id: s.id, class_id: classId, class_no: s.classNo, name: s.name, name_cht: s.nameCht })),
      { onConflict: 'id' }
    );
  if (error) console.error('saveStudents error:', error);
}

/** Delete a student */
export async function deleteStudentDb(id: string) {
  const { error } = await supabase.from('sqgs_students').delete().eq('id', id);
  if (error) console.error('deleteStudent error:', error);
}

/** Replace all students for a class */
export async function replaceClassStudents(classId: string, students: Student[]) {
  await supabase.from('sqgs_students').delete().eq('class_id', classId);
  if (students.length > 0) {
    const { error } = await supabase
      .from('sqgs_students')
      .insert(students.map(s => ({
        id: s.id, class_id: classId, class_no: s.classNo, name: s.name, name_cht: s.nameCht,
      })));
    if (error) console.error('replaceClassStudents error:', error);
  }
}

/** Save an assessment (upsert) */
export async function saveAssessment(assessment: Assessment, classId: string) {
  const { error } = await supabase
    .from('sqgs_assessments')
    .upsert({
      id: assessment.id, class_id: classId,
      code: assessment.code, title: assessment.title, title_cht: assessment.titleCht,
      term: assessment.term, nature_id: assessment.natureId || null,
      teacher_id: assessment.teacherId || null, date: assessment.date,
    }, { onConflict: 'id' });
  if (error) { console.error('saveAssessment error:', error); return; }

  // Save topic links
  await supabase.from('sqgs_assessment_topics').delete().eq('assessment_id', assessment.id);
  if (assessment.topicIds.length > 0) {
    await supabase.from('sqgs_assessment_topics').insert(
      assessment.topicIds.map(tid => ({ assessment_id: assessment.id, topic_id: tid }))
    );
  }
}

/** Delete an assessment */
export async function deleteAssessmentDb(id: string) {
  const { error } = await supabase.from('sqgs_assessments').delete().eq('id', id);
  if (error) console.error('deleteAssessment error:', error);
}

/** Save mark sheet items for an assessment (replace all) */
export async function saveMarkSheet(assessmentId: string, items: MarkItem[]) {
  await supabase.from('sqgs_mark_sheet_items').delete().eq('assessment_id', assessmentId);
  if (items.length > 0) {
    const { error } = await supabase
      .from('sqgs_mark_sheet_items')
      .insert(items.map((item, idx) => ({
        id: item.id, assessment_id: assessmentId,
        label: item.label, max_mark: item.maxMark,
        is_section: item.isSection, topic_id: item.topicId || null,
        sort_order: idx,
      })));
    if (error) console.error('saveMarkSheet error:', error);
  }
}

// ─── Score Save Queue (prevents race conditions) ────────────────────────────
const scoreQueue = new Map<string, Promise<void>>();

function getQueueKey(assessmentId: string, studentId: string) {
  return `${assessmentId}::${studentId}`;
}

/** Listeners for save status changes */
type SaveStatusListener = (status: 'saving' | 'saved' | 'error', detail?: string) => void;
let saveStatusListener: SaveStatusListener | null = null;
export function onSaveStatus(listener: SaveStatusListener | null) { saveStatusListener = listener; }

/** Save a student's scores for an assessment (queued, with retry) */
export async function upsertScoreDb(assessmentId: string, entry: ScoreEntry) {
  const key = getQueueKey(assessmentId, entry.studentId);
  // Chain onto existing queue for this student+assessment to prevent overlap
  const prev = scoreQueue.get(key) ?? Promise.resolve();
  const task = prev.then(() => doUpsertScore(assessmentId, entry));
  scoreQueue.set(key, task.catch(() => {})); // keep queue alive even on error
  return task;
}

async function doUpsertScore(assessmentId: string, entry: ScoreEntry, retries = 2): Promise<void> {
  saveStatusListener?.('saving');
  const rows = Object.entries(entry.scores)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([markItemId, value]) => ({
      assessment_id: assessmentId,
      student_id: entry.studentId,
      mark_item_id: markItemId,
      value: value,
    }));

  // Step 1: Delete existing scores
  const { error: delError } = await supabase
    .from('sqgs_scores')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('student_id', entry.studentId);
  if (delError) {
    console.error('[upsertScoreDb] delete error:', delError);
    if (retries > 0) {
      await delay(500);
      return doUpsertScore(assessmentId, entry, retries - 1);
    }
    saveStatusListener?.('error', `Delete failed: ${delError.message}`);
    return;
  }

  // Step 2: Insert new scores
  if (rows.length === 0) {
    console.log('[upsertScoreDb] no rows to insert (cleared)');
    saveStatusListener?.('saved');
    return;
  }
  const { error, data } = await supabase
    .from('sqgs_scores')
    .insert(rows)
    .select();
  if (error) {
    console.error('[upsertScoreDb] insert error:', error);
    if (retries > 0) {
      // Re-try the full operation (delete + insert)
      await delay(500);
      return doUpsertScore(assessmentId, entry, retries - 1);
    }
    saveStatusListener?.('error', `Insert failed: ${error.message}`);
    return;
  }
  console.log('[upsertScoreDb] OK:', data?.length, 'rows');
  saveStatusListener?.('saved');
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Delete all scores for a student in an assessment */
export async function deleteScoreDb(assessmentId: string, studentId: string) {
  const { error } = await supabase
    .from('sqgs_scores')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('student_id', studentId);
  if (error) console.error('deleteScore error:', error);
}

/** Mark a student as absent for an assessment */
export async function upsertAbsentFlagDb(assessmentId: string, studentId: string) {
  const { error } = await supabase
    .from('sqgs_absent_flags')
    .upsert({ assessment_id: assessmentId, student_id: studentId }, { onConflict: 'assessment_id,student_id' });
  if (error) console.error('upsertAbsentFlag error:', error);
}

/** Remove absent flag for a student in an assessment */
export async function deleteAbsentFlagDb(assessmentId: string, studentId: string) {
  const { error } = await supabase
    .from('sqgs_absent_flags')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('student_id', studentId);
  if (error) console.error('deleteAbsentFlag error:', error);
}

// ─── Full state save (used for initial seed / backup restore) ─────────────────

export async function saveFullState(state: {
  teachers: Teacher[];
  natures: AssessmentNature[];
  weightingSchemes: WeightingScheme[];
  subjects: Subject[];
  schoolYears: SchoolYear[];
  syllabusItems: SyllabusItem[];
}) {
  // Save teachers
  if (state.teachers.length > 0) {
    await supabase.from('sqgs_teachers').upsert(state.teachers.map(teacherToDb), { onConflict: 'id' });
  }
  // Save natures
  if (state.natures.length > 0) {
    await supabase.from('sqgs_assessment_natures').upsert(state.natures.map(natureToDb), { onConflict: 'id' });
  }
  // Save subjects
  if (state.subjects.length > 0) {
    await supabase.from('sqgs_subjects').upsert(state.subjects.map(subjectToDb), { onConflict: 'id' });
    // Save topics for each subject
    for (const subj of state.subjects) {
      if (subj.topics.length > 0) {
        await supabase.from('sqgs_topics').upsert(
          subj.topics.map(t => topicToDb(t, subj.id)), { onConflict: 'id' }
        );
      }
    }
  }
  // Save weighting schemes
  for (const ws of state.weightingSchemes) {
    await saveWeightingScheme(ws);
  }
  // Save syllabus items
  if (state.syllabusItems.length > 0) {
    await supabase.from('sqgs_syllabus_items').upsert(
      state.syllabusItems.map(syllabusItemToDb), { onConflict: 'id' }
    );
  }
  // Save school years + year-subjects + classes + students + assessments
  for (const year of state.schoolYears) {
    await supabase.from('sqgs_school_years').upsert({ id: year.id, label: year.label }, { onConflict: 'id' });
    for (const ys of year.subjects) {
      const ysId = await ensureYearSubject(year.id, ys.subjectId);
      if (ysId === null) continue;
      for (const cls of ys.classes) {
        await saveClass(cls, ysId);
        if (cls.students.length > 0) {
          await supabase.from('sqgs_students').upsert(
            cls.students.map(s => ({ id: s.id, class_id: cls.id, class_no: s.classNo, name: s.name, name_cht: s.nameCht })),
            { onConflict: 'id' }
          );
        }
        for (const asmt of cls.assessments) {
          await saveAssessment(asmt, cls.id);
          await saveMarkSheet(asmt.id, asmt.markSheet);
          for (const entry of asmt.scores) {
            await upsertScoreDb(asmt.id, entry);
          }
        }
      }
    }
  }
}

// ─── Legacy blob functions (kept for backward compat during transition) ────────
export const APP_STATE_ID = 'default';

export async function loadAppState(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('sqgs_app_state')
    .select('data')
    .eq('id', APP_STATE_ID)
    .single();
  if (error) return null;
  return data?.data ?? null;
}

export async function saveAppState(state: Record<string, unknown>): Promise<void> {
  await supabase
    .from('sqgs_app_state')
    .upsert({ id: APP_STATE_ID, data: state }, { onConflict: 'id' });
}

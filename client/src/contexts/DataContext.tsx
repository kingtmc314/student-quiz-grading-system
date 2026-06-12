/**
 * DataContext — Student Quiz Grading System
 * Full data model supporting:
 *  - Multi-teacher management
 *  - Custom assessment natures (Quiz/Test/Exam/Assignment) with isExam flag
 *  - Per-form+subject weighting schemes (CA % + Exam %)
 *  - Global subject registry with bilingual topics (EN + ZH-HK)
 *  - School Years > Year-Subject links > Classes > Students
 *  - Assessments with code, date, term, nature, teacher, topics covered
 *  - Mark sheets with per-item topic tagging
 *  - Score entries per student
 *
 * Persistence: Supabase relational tables (sqgs_*) with localStorage fallback
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import {
  loadFullState, saveFullState,
  saveTeachers, deleteTeacherDb,
  saveNatures, deleteNatureDb,
  saveSubject, deleteSubjectDb,
  saveTopics, deleteTopicDb, replaceSubjectTopicsDb,
  saveWeightingScheme, deleteWeightingSchemeDb,
  saveSyllabusItems,
  saveSchoolYear, deleteSchoolYearDb,
  ensureYearSubject, removeYearSubjectDb,
  saveClass, deleteClassDb,
  saveStudent, deleteStudentDb, replaceClassStudents,
  saveAssessment, deleteAssessmentDb,
  saveMarkSheet,
  upsertScoreDb, deleteScoreDb,
  upsertAbsentFlagDb, deleteAbsentFlagDb,
} from "@/lib/supabase";

// ─── Persistence helpers (localStorage fallback) ──────────────────────────────

const STORAGE_KEY = "sqgs_data_v1";

interface PersistedData {
  teachers: Teacher[];
  natures: AssessmentNature[];
  weightingSchemes: WeightingScheme[];
  subjects: Subject[];
  schoolYears: SchoolYear[];
  syllabusItems?: SyllabusItem[];
}

function loadFromLocalStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedData;
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: PersistedData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

// ─── Core types ───────────────────────────────────────────────────────────────

export interface SyllabusItem {
  id: string;
  level: "Junior" | "Senior" | string;
  strand: string;
  learningUnit: string;
  learningObjective: string;
  category: string;
  remarks: string;
}

export interface Teacher {
  id: string;
  name: string;
  nameCht: string;
  code: string;
  email: string;
}

export interface AssessmentNature {
  id: string;
  name: string;
  nameCht: string;
  color: string;
  isExam: boolean;
}

export interface WeightEntry {
  natureId: string;
  percentage: number;
}

export interface WeightingScheme {
  id: string;
  form: string;
  subjectId: string;
  label: string;
  caEntries: WeightEntry[];
  examPercentage: number;
}

export interface Topic {
  id: string;
  code: string;
  name: string;
  nameCht: string;
  order: number;
  color?: string;
  level?: string;
  learningUnit?: string;
  learningObjective?: string;
  strand?: string;
  category?: string;
  remarks?: string;
}

export interface Subject {
  id: string;
  name: string;
  nameCht: string;
  code: string;
  form: string;
  topics: Topic[];
}

export interface Student {
  id: string;
  classNo: string;
  name: string;
  nameCht: string;
}

export interface MarkItem {
  id: string;
  label: string;
  maxMark: number;
  isSection: boolean;
  topicId?: string;
}

export interface ScoreEntry {
  studentId: string;
  scores: Record<string, number | null>;
  isAbsent?: boolean;
  submittedAt?: string;
}

export type Term = "Term 1" | "Term 2" | "Full Year";

export interface Assessment {
  id: string;
  code: string;
  title: string;
  titleCht: string;
  term: Term;
  natureId: string;
  teacherId: string;
  date: string;
  topicIds: string[];
  markSheet: MarkItem[];
  scores: ScoreEntry[];
}

export interface Class {
  id: string;
  name: string;
  form: string;
  teacherId: string;
  weightingSchemeId?: string;
  students: Student[];
  assessments: Assessment[];
}

export interface YearSubject {
  subjectId: string;
  classes: Class[];
}

export interface SchoolYear {
  id: string;
  label: string;
  subjects: YearSubject[];
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface DataContextType {
  teachers: Teacher[];
  natures: AssessmentNature[];
  weightingSchemes: WeightingScheme[];
  subjects: Subject[];
  schoolYears: SchoolYear[];

  addTeacher: (t: Omit<Teacher, "id">) => void;
  updateTeacher: (id: string, t: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;

  addNature: (n: Omit<AssessmentNature, "id">) => void;
  updateNature: (id: string, n: Partial<AssessmentNature>) => void;
  deleteNature: (id: string) => void;

  addWeightingScheme: (w: Omit<WeightingScheme, "id">) => void;
  updateWeightingScheme: (id: string, w: Partial<WeightingScheme>) => void;
  deleteWeightingScheme: (id: string) => void;

  addSubject: (s: Omit<Subject, "id" | "topics">) => Subject;
  updateSubject: (id: string, s: Partial<Omit<Subject, "topics">>) => void;
  deleteSubject: (id: string) => void;

  addTopic: (subjectId: string, t: Omit<Topic, "id" | "order">) => void;
  updateTopic: (subjectId: string, topicId: string, t: Partial<Topic>) => void;
  deleteTopic: (subjectId: string, topicId: string) => void;
  reorderTopics: (subjectId: string, orderedIds: string[]) => void;
  replaceTopicsFromSyllabus: (subjectId: string, topics: Omit<Topic, "id" | "order">[]) => void;

  addSchoolYear: (label: string) => void;
  deleteSchoolYear: (yearId: string) => void;

  addSubjectToYear: (yearId: string, subjectId: string) => void;
  removeSubjectFromYear: (yearId: string, subjectId: string) => void;

  addClass: (yearId: string, subjectId: string, cls: Omit<Class, "id" | "students" | "assessments">) => void;
  updateClass: (yearId: string, subjectId: string, classId: string, cls: Partial<Omit<Class, "students" | "assessments">>) => void;
  deleteClass: (yearId: string, subjectId: string, classId: string) => void;

  addStudent: (yearId: string, subjectId: string, classId: string, s: Omit<Student, "id">) => void;
  updateStudent: (yearId: string, subjectId: string, classId: string, studentId: string, s: Partial<Student>) => void;
  deleteStudent: (yearId: string, subjectId: string, classId: string, studentId: string) => void;
  importStudents: (yearId: string, subjectId: string, classId: string, students: Omit<Student, "id">[]) => void;

  addAssessment: (yearId: string, subjectId: string, classId: string, a: Omit<Assessment, "id" | "markSheet" | "scores">) => Assessment;
  updateAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string, a: Partial<Omit<Assessment, "markSheet" | "scores">>) => void;
  deleteAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string) => void;

  updateMarkSheet: (yearId: string, subjectId: string, classId: string, assessmentId: string, items: MarkItem[]) => void;

  upsertScore: (yearId: string, subjectId: string, classId: string, assessmentId: string, entry: ScoreEntry) => void;
  deleteScore: (yearId: string, subjectId: string, classId: string, assessmentId: string, studentId: string) => void;

  getSchoolYear: (yearId: string) => SchoolYear | undefined;
  getYearSubject: (yearId: string, subjectId: string) => YearSubject | undefined;
  getClass: (yearId: string, subjectId: string, classId: string) => Class | undefined;
  getAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string) => Assessment | undefined;
  getGlobalSubject: (subjectId: string) => Subject | undefined;
  getTeacher: (teacherId: string) => Teacher | undefined;
  getNature: (natureId: string) => AssessmentNature | undefined;
  getWeightingScheme: (form: string, subjectId: string, weightingSchemeId?: string) => WeightingScheme | undefined;

  syllabusItems: SyllabusItem[];
  setSyllabusItems: (items: SyllabusItem[]) => void;

  getSubject: (yearId: string, subjectId: string) => Subject | undefined;

  // Backup/restore
  exportData: () => PersistedData;
  importData: (data: PersistedData) => Promise<void>;

  // Sync status
  syncStatus: 'idle' | 'loading' | 'saving' | 'error';
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_TEACHERS: Teacher[] = [
  { id: "tch-1", name: "Mr. Chan", nameCht: "陳老師", code: "CHN", email: "chan@school.edu.hk" },
  { id: "tch-2", name: "Ms. Lee",  nameCht: "李老師", code: "LEE", email: "lee@school.edu.hk" },
];

const SEED_NATURES: AssessmentNature[] = [
  { id: "nat-quiz",   name: "Quiz",       nameCht: "小測",   color: "blue",   isExam: false },
  { id: "nat-test",   name: "Test",       nameCht: "測驗",   color: "amber",  isExam: false },
  { id: "nat-assign", name: "Assignment", nameCht: "功課",   color: "green",  isExam: false },
  { id: "nat-exam",   name: "Exam",       nameCht: "考試",   color: "red",    isExam: true  },
];

const SEED_SUBJECTS: Subject[] = [
  {
    id: "sub-m2",
    name: "Mathematics Extended Module 2",
    nameCht: "數學延伸單元二",
    code: "M2",
    form: "S6",
    topics: [
      { id: "t-m2-01", code: "M2-01", name: "Mathematical Induction",           nameCht: "數學歸納法",     order: 1  },
      { id: "t-m2-02", code: "M2-02", name: "Binomial Theorem",                 nameCht: "二項式定理",     order: 2  },
      { id: "t-m2-03", code: "M2-03", name: "Trigonometry",                     nameCht: "三角學",         order: 3  },
      { id: "t-m2-04", code: "M2-04", name: "Limits and Derivatives",           nameCht: "極限與導數",     order: 4  },
      { id: "t-m2-05", code: "M2-05", name: "Differentiation",                  nameCht: "微分",           order: 5  },
      { id: "t-m2-06", code: "M2-06", name: "Applications of Differentiation",  nameCht: "微分的應用",     order: 6  },
      { id: "t-m2-07", code: "M2-07", name: "Indefinite Integration",           nameCht: "不定積分",       order: 7  },
      { id: "t-m2-08", code: "M2-08", name: "Definite Integration",             nameCht: "定積分",         order: 8  },
      { id: "t-m2-09", code: "M2-09", name: "Applications of Integration",      nameCht: "積分的應用",     order: 9  },
      { id: "t-m2-10", code: "M2-10", name: "Matrices and Systems",             nameCht: "矩陣與方程組",   order: 10 },
      { id: "t-m2-11", code: "M2-11", name: "Vectors",                          nameCht: "向量",           order: 11 },
    ],
  },
  {
    id: "sub-m1",
    name: "Mathematics Extended Module 1",
    nameCht: "數學延伸單元一",
    code: "M1",
    form: "S6",
    topics: [
      { id: "t-m1-01", code: "M1-01", name: "Binomial Expansion",               nameCht: "二項展開式",     order: 1 },
      { id: "t-m1-02", code: "M1-02", name: "Exponential & Logarithmic",        nameCht: "指數與對數",     order: 2 },
      { id: "t-m1-03", code: "M1-03", name: "Differentiation",                  nameCht: "微分",           order: 3 },
      { id: "t-m1-04", code: "M1-04", name: "Integration",                      nameCht: "積分",           order: 4 },
      { id: "t-m1-05", code: "M1-05", name: "Probability & Statistics",         nameCht: "概率與統計",     order: 5 },
    ],
  },
];

const SEED_WEIGHTING: WeightingScheme[] = [
  {
    id: "ws-s6-m2",
    form: "S6",
    subjectId: "sub-m2",
    label: "S6 M2 Weighting",
    caEntries: [
      { natureId: "nat-quiz",   percentage: 10 },
      { natureId: "nat-test",   percentage: 20 },
      { natureId: "nat-assign", percentage: 10 },
    ],
    examPercentage: 60,
  },
];

const SEED_YEARS: SchoolYear[] = [
  {
    id: "sy-2526",
    label: "2025-26",
    subjects: [
      {
        subjectId: "sub-m2",
        classes: [
          {
            id: "cls-6a",
            name: "6A",
            form: "S6",
            teacherId: "tch-1",
            students: [
              { id: "stu-1", classNo: "01", name: "Chan Tai Man",  nameCht: "陳大文" },
              { id: "stu-2", classNo: "02", name: "Lee Siu Ming",  nameCht: "李小明" },
              { id: "stu-3", classNo: "03", name: "Wong Mei Ling", nameCht: "王美玲" },
              { id: "stu-4", classNo: "04", name: "Lam Ka Wai",    nameCht: "林家偉" },
              { id: "stu-5", classNo: "05", name: "Ng Hoi Yin",    nameCht: "吳海燕" },
            ],
            assessments: [
              {
                id: "asmt-1",
                code: "T1Q1",
                title: "Quiz 1 — Differentiation",
                titleCht: "小測一 — 微分",
                term: "Term 1",
                natureId: "nat-quiz",
                teacherId: "tch-1",
                date: "2025-10-15",
                topicIds: ["t-m2-04", "t-m2-05"],
                markSheet: [
                  { id: "ms-s0", label: "Section A",  maxMark: 0,  isSection: true  },
                  { id: "ms-1",  label: "1",           maxMark: 5,  isSection: false, topicId: "t-m2-04" },
                  { id: "ms-2",  label: "2(a)",        maxMark: 3,  isSection: false, topicId: "t-m2-05" },
                  { id: "ms-3",  label: "2(b)",        maxMark: 4,  isSection: false, topicId: "t-m2-05" },
                  { id: "ms-s1", label: "Section B",   maxMark: 0,  isSection: true  },
                  { id: "ms-4",  label: "3(a)",        maxMark: 4,  isSection: false, topicId: "t-m2-05" },
                  { id: "ms-5",  label: "3(b)(i)",     maxMark: 3,  isSection: false, topicId: "t-m2-05" },
                  { id: "ms-6",  label: "3(b)(ii)",    maxMark: 6,  isSection: false, topicId: "t-m2-06" },
                ],
                scores: [],
              },
            ],
          },
          {
            id: "cls-6b",
            name: "6B",
            form: "S6",
            teacherId: "tch-2",
            students: [
              { id: "stu-6",  classNo: "01", name: "Yip Wai Kin",   nameCht: "葉偉健" },
              { id: "stu-7",  classNo: "02", name: "Ho Ching Yee",  nameCht: "何靜儀" },
              { id: "stu-8",  classNo: "03", name: "Cheung Pak Hei",nameCht: "張柏熙" },
            ],
            assessments: [],
          },
        ],
      },
    ],
  },
];

// ─── Provider ─────────────────────────────────────────────────────────────────

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const localData = loadFromLocalStorage();

  const [teachers, setTeachers] = useState<Teacher[]>(localData?.teachers ?? SEED_TEACHERS);
  const [natures, setNatures] = useState<AssessmentNature[]>(localData?.natures ?? SEED_NATURES);
  const [weightingSchemes, setWeightingSchemes] = useState<WeightingScheme[]>(localData?.weightingSchemes ?? SEED_WEIGHTING);
  const [subjects, setSubjects] = useState<Subject[]>(localData?.subjects ?? SEED_SUBJECTS);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(localData?.schoolYears ?? SEED_YEARS);
  const [syllabusItems, setSyllabusItemsState] = useState<SyllabusItem[]>(localData?.syllabusItems ?? []);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('loading');

  // Track whether we've loaded from Supabase yet
  const hydrated = useRef(false);

  // On mount: load from Supabase and override local state
  useEffect(() => {
    setSyncStatus('loading');
    loadFullState().then(remote => {
      // Detect empty remote DB: loadFullState returns a valid object even when all tables are empty.
      // We treat it as "needs seeding" if there are no school years AND no subjects AND no teachers.
      const remoteIsEmpty = !remote ||
        (remote.teachers.length === 0 && remote.subjects.length === 0 && remote.schoolYears.length === 0);

      if (remoteIsEmpty) {
        // Push local/seed data up to Supabase
        setSyncStatus('saving');
        const seedData = {
          teachers: localData?.teachers ?? SEED_TEACHERS,
          natures: localData?.natures ?? SEED_NATURES,
          weightingSchemes: localData?.weightingSchemes ?? SEED_WEIGHTING,
          subjects: localData?.subjects ?? SEED_SUBJECTS,
          schoolYears: localData?.schoolYears ?? SEED_YEARS,
          syllabusItems: localData?.syllabusItems ?? [],
        };
        // Apply locally first so UI is immediately responsive
        setTeachers(seedData.teachers);
        setNatures(seedData.natures);
        setWeightingSchemes(seedData.weightingSchemes);
        setSubjects(seedData.subjects);
        setSchoolYears(seedData.schoolYears);
        setSyllabusItemsState(seedData.syllabusItems);
        saveFullState(seedData).then(() => {
          setSyncStatus('idle');
        }).catch(() => setSyncStatus('error'));
        hydrated.current = true;
        return;
      }
      // Apply remote data
      if (remote.teachers.length > 0)        setTeachers(remote.teachers);
      if (remote.natures.length > 0)         setNatures(remote.natures);
      if (remote.weightingSchemes.length > 0) setWeightingSchemes(remote.weightingSchemes);
      if (remote.subjects.length > 0)        setSubjects(remote.subjects);
      if (remote.schoolYears.length > 0)     setSchoolYears(remote.schoolYears);
      setSyllabusItemsState(remote.syllabusItems);
      hydrated.current = true;
      setSyncStatus('idle');
    }).catch(() => {
      hydrated.current = true;
      setSyncStatus('error');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep localStorage in sync with all state changes
  useEffect(() => {
    const data: PersistedData = { teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems };
    saveToLocalStorage(data);
  }, [teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems]);

  const setSyllabusItems = useCallback((items: SyllabusItem[]) => {
    setSyllabusItemsState(items);
    saveSyllabusItems(items).catch(console.error);
  }, []);

  // ── Mutation helpers ──────────────────────────────────────────────────────

  const mutateYear = useCallback((yearId: string, fn: (y: SchoolYear) => SchoolYear) => {
    setSchoolYears(prev => prev.map(y => y.id === yearId ? fn(y) : y));
  }, []);

  const mutateYS = useCallback((yearId: string, subjectId: string, fn: (ys: YearSubject) => YearSubject) => {
    mutateYear(yearId, y => ({
      ...y,
      subjects: y.subjects.map(ys => ys.subjectId === subjectId ? fn(ys) : ys),
    }));
  }, [mutateYear]);

  const mutateClass = useCallback((yearId: string, subjectId: string, classId: string, fn: (c: Class) => Class) => {
    mutateYS(yearId, subjectId, ys => ({
      ...ys,
      classes: ys.classes.map(c => c.id === classId ? fn(c) : c),
    }));
  }, [mutateYS]);

  const mutateAssessment = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    fn: (a: Assessment) => Assessment
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.map(a => a.id === assessmentId ? fn(a) : a),
    }));
  }, [mutateClass]);

  // ── Teacher CRUD ──────────────────────────────────────────────────────────

  const addTeacher = useCallback((t: Omit<Teacher, "id">) => {
    const nt: Teacher = { ...t, id: nanoid() };
    setTeachers(prev => {
      const next = [...prev, nt];
      saveTeachers(next).catch(console.error);
      return next;
    });
  }, []);

  const updateTeacher = useCallback((id: string, t: Partial<Teacher>) => {
    setTeachers(prev => {
      const next = prev.map(x => x.id === id ? { ...x, ...t } : x);
      saveTeachers(next).catch(console.error);
      return next;
    });
  }, []);

  const deleteTeacher = useCallback((id: string) => {
    setTeachers(prev => prev.filter(x => x.id !== id));
    deleteTeacherDb(id).catch(console.error);
  }, []);

  // ── Nature CRUD ───────────────────────────────────────────────────────────

  const addNature = useCallback((n: Omit<AssessmentNature, "id">) => {
    const nn: AssessmentNature = { ...n, id: nanoid() };
    setNatures(prev => {
      const next = [...prev, nn];
      saveNatures(next).catch(console.error);
      return next;
    });
  }, []);

  const updateNature = useCallback((id: string, n: Partial<AssessmentNature>) => {
    setNatures(prev => {
      const next = prev.map(x => x.id === id ? { ...x, ...n } : x);
      saveNatures(next).catch(console.error);
      return next;
    });
  }, []);

  const deleteNature = useCallback((id: string) => {
    setNatures(prev => prev.filter(x => x.id !== id));
    deleteNatureDb(id).catch(console.error);
  }, []);

  // ── Weighting CRUD ────────────────────────────────────────────────────────

  const addWeightingScheme = useCallback((w: Omit<WeightingScheme, "id">) => {
    const nw: WeightingScheme = { ...w, id: nanoid() };
    setWeightingSchemes(prev => [...prev, nw]);
    saveWeightingScheme(nw).catch(console.error);
  }, []);

  const updateWeightingScheme = useCallback((id: string, w: Partial<WeightingScheme>) => {
    setWeightingSchemes(prev => {
      const next = prev.map(x => x.id === id ? { ...x, ...w } : x);
      const updated = next.find(x => x.id === id);
      if (updated) saveWeightingScheme(updated).catch(console.error);
      return next;
    });
  }, []);

  const deleteWeightingScheme = useCallback((id: string) => {
    setWeightingSchemes(prev => prev.filter(x => x.id !== id));
    deleteWeightingSchemeDb(id).catch(console.error);
  }, []);

  // ── Subject CRUD ──────────────────────────────────────────────────────────

  const addSubject = useCallback((s: Omit<Subject, "id" | "topics">): Subject => {
    const ns: Subject = { ...s, id: nanoid(), topics: [] };
    setSubjects(prev => [...prev, ns]);
    saveSubject(ns).catch(console.error);
    return ns;
  }, []);

  const updateSubject = useCallback((id: string, s: Partial<Omit<Subject, "topics">>) => {
    setSubjects(prev => {
      const next = prev.map(x => x.id === id ? { ...x, ...s } : x);
      const updated = next.find(x => x.id === id);
      if (updated) saveSubject(updated).catch(console.error);
      return next;
    });
  }, []);

  const deleteSubject = useCallback((id: string) => {
    setSubjects(prev => prev.filter(x => x.id !== id));
    deleteSubjectDb(id).catch(console.error);
  }, []);

  // ── Topic CRUD ────────────────────────────────────────────────────────────

  const addTopic = useCallback((subjectId: string, t: Omit<Topic, "id" | "order">) => {
    setSubjects(prev => {
      const next = prev.map(s => {
        if (s.id !== subjectId) return s;
        const nt: Topic = { ...t, id: nanoid(), order: s.topics.length + 1 };
        const updated = { ...s, topics: [...s.topics, nt] };
        saveTopics(subjectId, updated.topics).catch(console.error);
        return updated;
      });
      return next;
    });
  }, []);

  const updateTopic = useCallback((subjectId: string, topicId: string, t: Partial<Topic>) => {
    setSubjects(prev => {
      const next = prev.map(s => {
        if (s.id !== subjectId) return s;
        const updated = { ...s, topics: s.topics.map(tp => tp.id === topicId ? { ...tp, ...t } : tp) };
        saveTopics(subjectId, updated.topics).catch(console.error);
        return updated;
      });
      return next;
    });
  }, []);

  const deleteTopic = useCallback((subjectId: string, topicId: string) => {
    setSubjects(prev => {
      const next = prev.map(s => {
        if (s.id !== subjectId) return s;
        return { ...s, topics: s.topics.filter(tp => tp.id !== topicId) };
      });
      return next;
    });
    deleteTopicDb(topicId).catch(console.error);
  }, []);

  const replaceTopicsFromSyllabus = useCallback((subjectId: string, newTopics: Omit<Topic, "id" | "order">[]) => {
    setSubjects(prev => {
      const next = prev.map(s => {
        if (s.id !== subjectId) return s;
        const manualTopics = s.topics.filter(tp => !tp.learningObjective);
        const syllabusTopics: Topic[] = newTopics.map((t, i) => ({
          ...t, id: nanoid(), order: manualTopics.length + i + 1,
        }));
        const allTopics = [...manualTopics, ...syllabusTopics];
        replaceSubjectTopicsDb(subjectId, syllabusTopics).catch(console.error);
        return { ...s, topics: allTopics };
      });
      return next;
    });
  }, []);

  const reorderTopics = useCallback((subjectId: string, orderedIds: string[]) => {
    setSubjects(prev => {
      const next = prev.map(s => {
        if (s.id !== subjectId) return s;
        const reordered = orderedIds.map((id, idx) => {
          const tp = s.topics.find(t => t.id === id)!;
          return { ...tp, order: idx + 1 };
        });
        saveTopics(subjectId, reordered).catch(console.error);
        return { ...s, topics: reordered };
      });
      return next;
    });
  }, []);

  // ── School year CRUD ──────────────────────────────────────────────────────

  const addSchoolYear = useCallback((label: string) => {
    const ny: SchoolYear = { id: nanoid(), label, subjects: [] };
    setSchoolYears(prev => [...prev, ny]);
    saveSchoolYear(ny).catch(console.error);
  }, []);

  const deleteSchoolYear = useCallback((yearId: string) => {
    setSchoolYears(prev => prev.filter(y => y.id !== yearId));
    deleteSchoolYearDb(yearId).catch(console.error);
  }, []);

  // ── Year-subject linking ──────────────────────────────────────────────────

  const addSubjectToYear = useCallback((yearId: string, subjectId: string) => {
    mutateYear(yearId, y => {
      if (y.subjects.some(ys => ys.subjectId === subjectId)) return y;
      ensureYearSubject(yearId, subjectId).catch(console.error);
      return { ...y, subjects: [...y.subjects, { subjectId, classes: [] }] };
    });
  }, [mutateYear]);

  const removeSubjectFromYear = useCallback((yearId: string, subjectId: string) => {
    mutateYear(yearId, y => ({
      ...y,
      subjects: y.subjects.filter(ys => ys.subjectId !== subjectId),
    }));
    removeYearSubjectDb(yearId, subjectId).catch(console.error);
  }, [mutateYear]);

  // ── Class CRUD ────────────────────────────────────────────────────────────

  const addClass = useCallback((
    yearId: string, subjectId: string,
    cls: Omit<Class, "id" | "students" | "assessments">
  ) => {
    const nc: Class = { ...cls, id: nanoid(), students: [], assessments: [] };
    mutateYS(yearId, subjectId, ys => ({
      ...ys,
      classes: [...ys.classes, nc],
    }));
    // Get year_subject id and save class
    ensureYearSubject(yearId, subjectId).then(ysId => {
      if (ysId !== null) saveClass(nc, ysId).catch(console.error);
    }).catch(console.error);
  }, [mutateYS]);

  const updateClass = useCallback((
    yearId: string, subjectId: string, classId: string,
    cls: Partial<Omit<Class, "students" | "assessments">>
  ) => {
    mutateClass(yearId, subjectId, classId, c => {
      const updated = { ...c, ...cls };
      ensureYearSubject(yearId, subjectId).then(ysId => {
        if (ysId !== null) saveClass(updated, ysId).catch(console.error);
      }).catch(console.error);
      return updated;
    });
  }, [mutateClass]);

  const deleteClass = useCallback((yearId: string, subjectId: string, classId: string) => {
    mutateYS(yearId, subjectId, ys => ({
      ...ys,
      classes: ys.classes.filter(c => c.id !== classId),
    }));
    deleteClassDb(classId).catch(console.error);
  }, [mutateYS]);

  // ── Student CRUD ──────────────────────────────────────────────────────────

  const addStudent = useCallback((
    yearId: string, subjectId: string, classId: string,
    s: Omit<Student, "id">
  ) => {
    const ns: Student = { ...s, id: nanoid() };
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: [...c.students, ns],
    }));
    saveStudent(ns, classId).catch(console.error);
  }, [mutateClass]);

  const updateStudent = useCallback((
    yearId: string, subjectId: string, classId: string,
    studentId: string, s: Partial<Student>
  ) => {
    mutateClass(yearId, subjectId, classId, c => {
      const updated = c.students.map(st => st.id === studentId ? { ...st, ...s } : st);
      const updatedStudent = updated.find(st => st.id === studentId);
      if (updatedStudent) saveStudent(updatedStudent, classId).catch(console.error);
      return { ...c, students: updated };
    });
  }, [mutateClass]);

  const deleteStudent = useCallback((
    yearId: string, subjectId: string, classId: string, studentId: string
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: c.students.filter(st => st.id !== studentId),
    }));
    deleteStudentDb(studentId).catch(console.error);
  }, [mutateClass]);

  const importStudents = useCallback((
    yearId: string, subjectId: string, classId: string,
    students: Omit<Student, "id">[]
  ) => {
    const newStudents: Student[] = students.map(s => ({ ...s, id: nanoid() }));
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: newStudents,
    }));
    replaceClassStudents(classId, newStudents).catch(console.error);
  }, [mutateClass]);

  // ── Assessment CRUD ───────────────────────────────────────────────────────

  const addAssessment = useCallback((
    yearId: string, subjectId: string, classId: string,
    a: Omit<Assessment, "id" | "markSheet" | "scores">
  ): Assessment => {
    const na: Assessment = { ...a, id: nanoid(), markSheet: [], scores: [] };
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: [...c.assessments, na],
    }));
    saveAssessment(na, classId).catch(console.error);
    return na;
  }, [mutateClass]);

  const updateAssessment = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    a: Partial<Omit<Assessment, "markSheet" | "scores">>
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, x => {
      const updated = { ...x, ...a };
      saveAssessment(updated, classId).catch(console.error);
      return updated;
    });
  }, [mutateAssessment]);

  const deleteAssessment = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.filter(a => a.id !== assessmentId),
    }));
    deleteAssessmentDb(assessmentId).catch(console.error);
  }, [mutateClass]);

  // ── Mark sheet ────────────────────────────────────────────────────────────

  const updateMarkSheet = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    items: MarkItem[]
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, a => ({ ...a, markSheet: items }));
    saveMarkSheet(assessmentId, items).catch(console.error);
  }, [mutateAssessment]);

  // ── Scores ────────────────────────────────────────────────────────────────

  const upsertScore = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    entry: ScoreEntry
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, a => ({
      ...a,
      scores: [
        ...a.scores.filter(s => s.studentId !== entry.studentId),
        { ...entry, submittedAt: new Date().toISOString() },
      ],
    }));
    // Handle absent flag separately
    if (entry.isAbsent) {
      upsertAbsentFlagDb(assessmentId, entry.studentId).catch(console.error);
      // Also delete any existing scores for this student
      deleteScoreDb(assessmentId, entry.studentId).catch(console.error);
    } else {
      deleteAbsentFlagDb(assessmentId, entry.studentId).catch(console.error);
      upsertScoreDb(assessmentId, entry).catch(console.error);
    }
  }, [mutateAssessment]);

  const deleteScore = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    studentId: string
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, a => ({
      ...a,
      scores: a.scores.filter(s => s.studentId !== studentId),
    }));
    deleteScoreDb(assessmentId, studentId).catch(console.error);
  }, [mutateAssessment]);

  // ── Getters ───────────────────────────────────────────────────────────────

  const getSchoolYear = useCallback((yearId: string) =>
    schoolYears.find(y => y.id === yearId), [schoolYears]);

  const getYearSubject = useCallback((yearId: string, subjectId: string) =>
    schoolYears.find(y => y.id === yearId)?.subjects.find(ys => ys.subjectId === subjectId),
  [schoolYears]);

  const getClass = useCallback((yearId: string, subjectId: string, classId: string) =>
    getYearSubject(yearId, subjectId)?.classes.find(c => c.id === classId),
  [getYearSubject]);

  const getAssessment = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string
  ) => getClass(yearId, subjectId, classId)?.assessments.find(a => a.id === assessmentId),
  [getClass]);

  const getGlobalSubject = useCallback((subjectId: string) =>
    subjects.find(s => s.id === subjectId), [subjects]);

  const getSubject = useCallback((yearId: string, subjectId: string) => {
    const ys = getYearSubject(yearId, subjectId);
    if (!ys) return undefined;
    return subjects.find(s => s.id === subjectId);
  }, [getYearSubject, subjects]);

  const getTeacher = useCallback((teacherId: string) =>
    teachers.find(t => t.id === teacherId), [teachers]);

  const getNature = useCallback((natureId: string) =>
    natures.find(n => n.id === natureId), [natures]);

  const getWeightingScheme = useCallback((form: string, subjectId: string, weightingSchemeId?: string) => {
    if (weightingSchemeId) return weightingSchemes.find(w => w.id === weightingSchemeId);
    return weightingSchemes.find(w => w.form === form && w.subjectId === subjectId);
  }, [weightingSchemes]);

  // ── Backup / Restore ──────────────────────────────────────────────────────

  const exportData = useCallback((): PersistedData => ({
    teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems,
  }), [teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems]);

  const importData = useCallback(async (data: PersistedData) => {
    if (data.teachers?.length)        setTeachers(data.teachers);
    if (data.natures?.length)         setNatures(data.natures);
    if (data.weightingSchemes?.length) setWeightingSchemes(data.weightingSchemes);
    if (data.subjects?.length)        setSubjects(data.subjects);
    if (data.schoolYears?.length)     setSchoolYears(data.schoolYears);
    if (data.syllabusItems?.length)   setSyllabusItemsState(data.syllabusItems);
    // Push to Supabase
    setSyncStatus('saving');
    try {
      await saveFullState({
        teachers: data.teachers ?? teachers,
        natures: data.natures ?? natures,
        weightingSchemes: data.weightingSchemes ?? weightingSchemes,
        subjects: data.subjects ?? subjects,
        schoolYears: data.schoolYears ?? schoolYears,
        syllabusItems: data.syllabusItems ?? syllabusItems,
      });
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    }
  }, [teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DataContext.Provider value={{
      teachers, natures, weightingSchemes, subjects, schoolYears,
      addTeacher, updateTeacher, deleteTeacher,
      addNature, updateNature, deleteNature,
      addWeightingScheme, updateWeightingScheme, deleteWeightingScheme,
      addSubject, updateSubject, deleteSubject,
      addTopic, updateTopic, deleteTopic, reorderTopics, replaceTopicsFromSyllabus,
      addSchoolYear, deleteSchoolYear,
      addSubjectToYear, removeSubjectFromYear,
      addClass, updateClass, deleteClass,
      addStudent, updateStudent, deleteStudent, importStudents,
      addAssessment, updateAssessment, deleteAssessment,
      updateMarkSheet,
      upsertScore, deleteScore,
      getSchoolYear, getYearSubject, getClass, getAssessment,
      getGlobalSubject, getTeacher, getNature, getWeightingScheme,
      getSubject,
      syllabusItems, setSyllabusItems,
      exportData, importData,
      syncStatus,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

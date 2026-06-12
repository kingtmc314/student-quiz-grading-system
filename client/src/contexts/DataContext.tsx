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
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { loadAppState, saveAppState } from "@/lib/supabase";

// ─── Persistence helpers (Supabase cloud + localStorage fallback) ─────────────

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
  level: "Junior" | "Senior" | string;  // Junior (S1-S3) or Senior (S4-S6)
  strand: string;          // e.g. "Number and Algebra"
  learningUnit: string;    // e.g. "1. Basic computation"
  learningObjective: string; // e.g. "1.1 recognise the tests of divisibility..."
  category: string;        // e.g. "Foundation" | "Non-Foundation"
  remarks: string;         // optional notes
}

export interface Teacher {
  id: string;
  name: string;       // English
  nameCht: string;    // Traditional Chinese
  code: string;       // e.g. "MTC"
  email: string;
}

export interface AssessmentNature {
  id: string;
  name: string;       // English
  nameCht: string;    // Traditional Chinese
  color: string;      // e.g. "blue" | "amber" | "red" | "green" | "purple"
  isExam: boolean;    // true = excluded from CA, tracked separately
}

export interface WeightEntry {
  natureId: string;
  percentage: number; // 0–100, CA natures only
}

export interface WeightingScheme {
  id: string;
  form: string;         // e.g. "S6"
  subjectId: string;    // global Subject.id
  label: string;        // display name
  caEntries: WeightEntry[];
  examPercentage: number;
}

export interface Topic {
  id: string;
  code: string;         // e.g. "M2-01" or auto-generated from syllabus
  name: string;         // English (= learningObjective when from syllabus)
  nameCht: string;      // Traditional Chinese
  order: number;
  color?: string;       // optional hex colour for topic badge
  // Syllabus fields — populated when imported from Excel (hierarchy: Level → Learning Unit → Objective)
  level?: string;             // "Junior" | "Senior"
  learningUnit?: string;      // e.g. "1. Basic computation"
  learningObjective?: string; // e.g. "1.1 recognise the tests of divisibility..."
  strand?: string;            // e.g. "Number and Algebra"
  category?: string;          // "Foundation" | "Non-Foundation"
  remarks?: string;
}

export interface Subject {
  id: string;           // stable global ID
  name: string;         // English
  nameCht: string;      // Traditional Chinese
  code: string;         // e.g. "M2"
  form: string;         // e.g. "S6"
  topics: Topic[];
}

export interface Student {
  id: string;
  classNo: string;      // e.g. "01"
  name: string;         // English
  nameCht: string;      // Traditional Chinese
}

export interface MarkItem {
  id: string;
  label: string;        // e.g. "1", "2(a)", "6(a)(i)"
  maxMark: number;
  isSection: boolean;   // section header row (no score)
  topicId?: string;     // optional link to Topic.id
}

export interface ScoreEntry {
  studentId: string;
  scores: Record<string, number | null>; // MarkItem.id -> score
  submittedAt?: string;
}

export type Term = "Term 1" | "Term 2" | "Full Year";

export interface Assessment {
  id: string;
  code: string;         // teacher-typed, e.g. "T1Q1"
  title: string;        // English
  titleCht: string;     // Traditional Chinese
  term: Term;
  natureId: string;
  teacherId: string;
  date: string;         // ISO date
  topicIds: string[];   // topics covered
  markSheet: MarkItem[];
  scores: ScoreEntry[];
}

export interface Class {
  id: string;
  name: string;         // e.g. "6A"
  form: string;         // e.g. "S6"
  teacherId: string;
  students: Student[];
  assessments: Assessment[];
}

/** Link between a school year and a global subject, containing classes */
export interface YearSubject {
  subjectId: string;
  classes: Class[];
}

export interface SchoolYear {
  id: string;
  label: string;        // e.g. "2025-26"
  subjects: YearSubject[];
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface DataContextType {
  // Global registries
  teachers: Teacher[];
  natures: AssessmentNature[];
  weightingSchemes: WeightingScheme[];
  subjects: Subject[];
  schoolYears: SchoolYear[];

  // Teacher CRUD
  addTeacher: (t: Omit<Teacher, "id">) => void;
  updateTeacher: (id: string, t: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;

  // Nature CRUD
  addNature: (n: Omit<AssessmentNature, "id">) => void;
  updateNature: (id: string, n: Partial<AssessmentNature>) => void;
  deleteNature: (id: string) => void;

  // Weighting scheme CRUD
  addWeightingScheme: (w: Omit<WeightingScheme, "id">) => void;
  updateWeightingScheme: (id: string, w: Partial<WeightingScheme>) => void;
  deleteWeightingScheme: (id: string) => void;

  // Subject CRUD (global)
  addSubject: (s: Omit<Subject, "id" | "topics">) => Subject;
  updateSubject: (id: string, s: Partial<Omit<Subject, "topics">>) => void;
  deleteSubject: (id: string) => void;

  // Topic CRUD
  addTopic: (subjectId: string, t: Omit<Topic, "id" | "order">) => void;
  updateTopic: (subjectId: string, topicId: string, t: Partial<Topic>) => void;
  deleteTopic: (subjectId: string, topicId: string) => void;
  reorderTopics: (subjectId: string, orderedIds: string[]) => void;
  // Replace all syllabus-sourced topics for a subject atomically
  replaceTopicsFromSyllabus: (subjectId: string, topics: Omit<Topic, "id" | "order">[]) => void;

  // School year CRUD
  addSchoolYear: (label: string) => void;
  deleteSchoolYear: (yearId: string) => void;

  // Year-subject linking
  addSubjectToYear: (yearId: string, subjectId: string) => void;
  removeSubjectFromYear: (yearId: string, subjectId: string) => void;

  // Class CRUD
  addClass: (yearId: string, subjectId: string, cls: Omit<Class, "id" | "students" | "assessments">) => void;
  updateClass: (yearId: string, subjectId: string, classId: string, cls: Partial<Omit<Class, "students" | "assessments">>) => void;
  deleteClass: (yearId: string, subjectId: string, classId: string) => void;

  // Student CRUD
  addStudent: (yearId: string, subjectId: string, classId: string, s: Omit<Student, "id">) => void;
  updateStudent: (yearId: string, subjectId: string, classId: string, studentId: string, s: Partial<Student>) => void;
  deleteStudent: (yearId: string, subjectId: string, classId: string, studentId: string) => void;
  importStudents: (yearId: string, subjectId: string, classId: string, students: Omit<Student, "id">[]) => void;

  // Assessment CRUD
  addAssessment: (yearId: string, subjectId: string, classId: string, a: Omit<Assessment, "id" | "markSheet" | "scores">) => Assessment;
  updateAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string, a: Partial<Omit<Assessment, "markSheet" | "scores">>) => void;
  deleteAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string) => void;

  // Mark sheet
  updateMarkSheet: (yearId: string, subjectId: string, classId: string, assessmentId: string, items: MarkItem[]) => void;

  // Scores
  upsertScore: (yearId: string, subjectId: string, classId: string, assessmentId: string, entry: ScoreEntry) => void;
  deleteScore: (yearId: string, subjectId: string, classId: string, assessmentId: string, studentId: string) => void;

  // Getters
  getSchoolYear: (yearId: string) => SchoolYear | undefined;
  getYearSubject: (yearId: string, subjectId: string) => YearSubject | undefined;
  getClass: (yearId: string, subjectId: string, classId: string) => Class | undefined;
  getAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string) => Assessment | undefined;
  getGlobalSubject: (subjectId: string) => Subject | undefined;
  getTeacher: (teacherId: string) => Teacher | undefined;
  getNature: (natureId: string) => AssessmentNature | undefined;
  getWeightingScheme: (form: string, subjectId: string) => WeightingScheme | undefined;
  // Syllabus
  syllabusItems: SyllabusItem[];
  setSyllabusItems: (items: SyllabusItem[]) => void;

  // Legacy compat
  getSubject: (yearId: string, subjectId: string) => Subject | undefined;
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
  // Start with localStorage data (instant load) then hydrate from Supabase
  const localData = loadFromLocalStorage();

  const [teachers, setTeachers] = useState<Teacher[]>(localData?.teachers ?? SEED_TEACHERS);
  const [natures, setNatures] = useState<AssessmentNature[]>(localData?.natures ?? SEED_NATURES);
  const [weightingSchemes, setWeightingSchemes] = useState<WeightingScheme[]>(localData?.weightingSchemes ?? SEED_WEIGHTING);
  const [subjects, setSubjects] = useState<Subject[]>(localData?.subjects ?? SEED_SUBJECTS);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(localData?.schoolYears ?? SEED_YEARS);
  const [syllabusItems, setSyllabusItemsState] = useState<SyllabusItem[]>(localData?.syllabusItems ?? []);

  // Track whether we've loaded from Supabase yet
  const hydrated = useRef(false);

  // On mount: load from Supabase and override local state
  useEffect(() => {
    loadAppState().then(remote => {
      if (!remote) return; // no remote data yet — keep local/seed
      const d = remote as unknown as PersistedData;
      // Only apply remote data if it has meaningful content (non-empty arrays)
      // This prevents an empty Supabase blob from wiping out local data
      if (Array.isArray(d.teachers) && d.teachers.length > 0)        setTeachers(d.teachers);
      if (Array.isArray(d.natures) && d.natures.length > 0)          setNatures(d.natures);
      if (Array.isArray(d.weightingSchemes))                          setWeightingSchemes(d.weightingSchemes);
      if (Array.isArray(d.subjects) && d.subjects.length > 0)        setSubjects(d.subjects);
      if (Array.isArray(d.schoolYears) && d.schoolYears.length > 0)  setSchoolYears(d.schoolYears);
      if (Array.isArray(d.syllabusItems))                              setSyllabusItemsState(d.syllabusItems);
      hydrated.current = true;
    });
  }, []);

  // Debounce ref for Supabase saves
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist to both localStorage and Supabase whenever any state changes
  useEffect(() => {
    const data: PersistedData = { teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems };
    // Always save to localStorage immediately (offline fallback)
    saveToLocalStorage(data);
    // Debounce Supabase saves to avoid hammering on rapid changes
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAppState(data as unknown as Record<string, unknown>);
    }, 800);
  }, [teachers, natures, weightingSchemes, subjects, schoolYears, syllabusItems]);

  const setSyllabusItems = useCallback((items: SyllabusItem[]) => {
    setSyllabusItemsState(items);
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
    setTeachers(prev => [...prev, { ...t, id: nanoid() }]);
  }, []);
  const updateTeacher = useCallback((id: string, t: Partial<Teacher>) => {
    setTeachers(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
  }, []);
  const deleteTeacher = useCallback((id: string) => {
    setTeachers(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── Nature CRUD ───────────────────────────────────────────────────────────

  const addNature = useCallback((n: Omit<AssessmentNature, "id">) => {
    setNatures(prev => [...prev, { ...n, id: nanoid() }]);
  }, []);
  const updateNature = useCallback((id: string, n: Partial<AssessmentNature>) => {
    setNatures(prev => prev.map(x => x.id === id ? { ...x, ...n } : x));
  }, []);
  const deleteNature = useCallback((id: string) => {
    setNatures(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── Weighting CRUD ────────────────────────────────────────────────────────

  const addWeightingScheme = useCallback((w: Omit<WeightingScheme, "id">) => {
    setWeightingSchemes(prev => [...prev, { ...w, id: nanoid() }]);
  }, []);
  const updateWeightingScheme = useCallback((id: string, w: Partial<WeightingScheme>) => {
    setWeightingSchemes(prev => prev.map(x => x.id === id ? { ...x, ...w } : x));
  }, []);
  const deleteWeightingScheme = useCallback((id: string) => {
    setWeightingSchemes(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── Subject CRUD ──────────────────────────────────────────────────────────

  const addSubject = useCallback((s: Omit<Subject, "id" | "topics">): Subject => {
    const ns: Subject = { ...s, id: nanoid(), topics: [] };
    setSubjects(prev => [...prev, ns]);
    return ns;
  }, []);
  const updateSubject = useCallback((id: string, s: Partial<Omit<Subject, "topics">>) => {
    setSubjects(prev => prev.map(x => x.id === id ? { ...x, ...s } : x));
  }, []);
  const deleteSubject = useCallback((id: string) => {
    setSubjects(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── Topic CRUD ────────────────────────────────────────────────────────────

  const addTopic = useCallback((subjectId: string, t: Omit<Topic, "id" | "order">) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: [...s.topics, { ...t, id: nanoid(), order: s.topics.length + 1 }] };
    }));
  }, []);
  const updateTopic = useCallback((subjectId: string, topicId: string, t: Partial<Topic>) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.map(tp => tp.id === topicId ? { ...tp, ...t } : tp) };
    }));
  }, []);
  const deleteTopic = useCallback((subjectId: string, topicId: string) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.filter(tp => tp.id !== topicId) };
    }));
  }, []);
  const replaceTopicsFromSyllabus = useCallback((subjectId: string, newTopics: Omit<Topic, "id" | "order">[]) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      // Keep manually-created topics (no learningObjective field), replace syllabus ones
      const manualTopics = s.topics.filter(tp => !tp.learningObjective);
      const syllabusTopics: Topic[] = newTopics.map((t, i) => ({
        ...t,
        id: nanoid(),
        order: manualTopics.length + i + 1,
      }));
      return { ...s, topics: [...manualTopics, ...syllabusTopics] };
    }));
  }, []);

  const reorderTopics = useCallback((subjectId: string, orderedIds: string[]) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      const reordered = orderedIds.map((id, idx) => {
        const tp = s.topics.find(t => t.id === id)!;
        return { ...tp, order: idx + 1 };
      });
      return { ...s, topics: reordered };
    }));
  }, []);

  // ── School year CRUD ──────────────────────────────────────────────────────

  const addSchoolYear = useCallback((label: string) => {
    setSchoolYears(prev => [...prev, { id: nanoid(), label, subjects: [] }]);
  }, []);
  const deleteSchoolYear = useCallback((yearId: string) => {
    setSchoolYears(prev => prev.filter(y => y.id !== yearId));
  }, []);

  // ── Year-subject linking ──────────────────────────────────────────────────

  const addSubjectToYear = useCallback((yearId: string, subjectId: string) => {
    mutateYear(yearId, y => {
      if (y.subjects.some(ys => ys.subjectId === subjectId)) return y;
      return { ...y, subjects: [...y.subjects, { subjectId, classes: [] }] };
    });
  }, [mutateYear]);

  const removeSubjectFromYear = useCallback((yearId: string, subjectId: string) => {
    mutateYear(yearId, y => ({
      ...y,
      subjects: y.subjects.filter(ys => ys.subjectId !== subjectId),
    }));
  }, [mutateYear]);

  // ── Class CRUD ────────────────────────────────────────────────────────────

  const addClass = useCallback((
    yearId: string, subjectId: string,
    cls: Omit<Class, "id" | "students" | "assessments">
  ) => {
    mutateYS(yearId, subjectId, ys => ({
      ...ys,
      classes: [...ys.classes, { ...cls, id: nanoid(), students: [], assessments: [] }],
    }));
  }, [mutateYS]);

  const updateClass = useCallback((
    yearId: string, subjectId: string, classId: string,
    cls: Partial<Omit<Class, "students" | "assessments">>
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({ ...c, ...cls }));
  }, [mutateClass]);

  const deleteClass = useCallback((yearId: string, subjectId: string, classId: string) => {
    mutateYS(yearId, subjectId, ys => ({
      ...ys,
      classes: ys.classes.filter(c => c.id !== classId),
    }));
  }, [mutateYS]);

  // ── Student CRUD ──────────────────────────────────────────────────────────

  const addStudent = useCallback((
    yearId: string, subjectId: string, classId: string,
    s: Omit<Student, "id">
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: [...c.students, { ...s, id: nanoid() }],
    }));
  }, [mutateClass]);

  const updateStudent = useCallback((
    yearId: string, subjectId: string, classId: string,
    studentId: string, s: Partial<Student>
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: c.students.map(st => st.id === studentId ? { ...st, ...s } : st),
    }));
  }, [mutateClass]);

  const deleteStudent = useCallback((
    yearId: string, subjectId: string, classId: string, studentId: string
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: c.students.filter(st => st.id !== studentId),
    }));
  }, [mutateClass]);

  const importStudents = useCallback((
    yearId: string, subjectId: string, classId: string,
    students: Omit<Student, "id">[]
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: students.map(s => ({ ...s, id: nanoid() })),
    }));
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
    return na;
  }, [mutateClass]);

  const updateAssessment = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    a: Partial<Omit<Assessment, "markSheet" | "scores">>
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, x => ({ ...x, ...a }));
  }, [mutateAssessment]);

  const deleteAssessment = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string
  ) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.filter(a => a.id !== assessmentId),
    }));
  }, [mutateClass]);

  // ── Mark sheet ────────────────────────────────────────────────────────────

  const updateMarkSheet = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    items: MarkItem[]
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, a => ({ ...a, markSheet: items }));
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
  }, [mutateAssessment]);

  const deleteScore = useCallback((
    yearId: string, subjectId: string, classId: string, assessmentId: string,
    studentId: string
  ) => {
    mutateAssessment(yearId, subjectId, classId, assessmentId, a => ({
      ...a,
      scores: a.scores.filter(s => s.studentId !== studentId),
    }));
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

  // Legacy compat: getSubject returns global subject if it exists in that year
  const getSubject = useCallback((yearId: string, subjectId: string) => {
    const ys = getYearSubject(yearId, subjectId);
    if (!ys) return undefined;
    return subjects.find(s => s.id === subjectId);
  }, [getYearSubject, subjects]);

  const getTeacher = useCallback((teacherId: string) =>
    teachers.find(t => t.id === teacherId), [teachers]);

  const getNature = useCallback((natureId: string) =>
    natures.find(n => n.id === natureId), [natures]);

  const getWeightingScheme = useCallback((form: string, subjectId: string) =>
    weightingSchemes.find(w => w.form === form && w.subjectId === subjectId),
  [weightingSchemes]);

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

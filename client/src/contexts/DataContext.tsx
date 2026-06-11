import React, { createContext, useContext, useState, useCallback } from "react";
import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssessmentNature = "Quiz" | "Test" | "Exam";
export type Term = "Term 1" | "Term 2";

export interface MarkItem {
  id: string;
  label: string;       // e.g. "2(a)", "6(a)(i)"
  maxMark: number;
  isSection?: boolean; // true for Section A / Section B / Total rows
}

export interface Student {
  id: string;
  classNo: string;     // e.g. "01", "02"
  name: string;
}

export interface ScoreEntry {
  studentId: string;
  scores: Record<string, number | null>; // keyed by MarkItem.id
}

export interface StudentScore {
  studentId: string;
  itemScores: { itemId: string; score: number }[];
}

export interface Assessment {
  id: string;
  term: Term;
  nature: AssessmentNature;
  title: string;
  markSheet: MarkItem[];
  scores: ScoreEntry[];
  uploadedFileName?: string;
}

export interface Class {
  id: string;
  name: string;        // e.g. "6A"
  students: Student[];
  assessments: Assessment[];
}

export interface Subject {
  id: string;
  name: string;        // e.g. "Mathematics M2"
  classes: Class[];
}

export interface SchoolYear {
  id: string;
  label: string;       // e.g. "2526"
  subjects: Subject[];
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface DataContextType {
  schoolYears: SchoolYear[];
  addSchoolYear: (label: string) => void;
  deleteSchoolYear: (id: string) => void;

  addSubject: (yearId: string, name: string) => void;
  deleteSubject: (yearId: string, subjectId: string) => void;

  addClass: (yearId: string, subjectId: string, name: string) => void;
  deleteClass: (yearId: string, subjectId: string, classId: string) => void;

  addStudent: (yearId: string, subjectId: string, classId: string, classNo: string, name: string) => void;
  updateStudent: (yearId: string, subjectId: string, classId: string, studentId: string, classNo: string, name: string) => void;
  deleteStudent: (yearId: string, subjectId: string, classId: string, studentId: string) => void;
  importStudents: (yearId: string, subjectId: string, classId: string, students: { classNo: string; name: string }[]) => void;

  addAssessment: (yearId: string, subjectId: string, classId: string, term: Term, nature: AssessmentNature, title: string) => Assessment;
  updateMarkSheet: (yearId: string, subjectId: string, classId: string, assessmentId: string, markSheet: MarkItem[]) => void;
  updateScores: (yearId: string, subjectId: string, classId: string, assessmentId: string, scores: ScoreEntry[]) => void;
  upsertScore: (yearId: string, subjectId: string, classId: string, assessmentId: string, studentId: string, itemScores: { itemId: string; score: number }[]) => void;
  deleteScore: (yearId: string, subjectId: string, classId: string, assessmentId: string, studentId: string) => void;
  deleteAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string) => void;

  getSchoolYear: (yearId: string) => SchoolYear | undefined;
  getSubject: (yearId: string, subjectId: string) => Subject | undefined;
  getClass: (yearId: string, subjectId: string, classId: string) => Class | undefined;
  getAssessment: (yearId: string, subjectId: string, classId: string, assessmentId: string) => Assessment | undefined;
}

const DataContext = createContext<DataContextType | null>(null);

// ─── Demo seed data ───────────────────────────────────────────────────────────

const SEED: SchoolYear[] = [
  {
    id: "sy-2526",
    label: "2526",
    subjects: [
      {
        id: "sub-m2",
        name: "Mathematics M2",
        classes: [
          {
            id: "cls-6a",
            name: "6A",
            students: [
              { id: "s1", classNo: "01", name: "Chan Tai Man" },
              { id: "s2", classNo: "02", name: "Lee Siu Ming" },
              { id: "s3", classNo: "03", name: "Wong Ka Wai" },
            ],
            assessments: [],
          },
        ],
      },
    ],
  },
];

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(SEED);

  // ── helpers ──────────────────────────────────────────────────────────────
  const mutateYear = useCallback((yearId: string, fn: (y: SchoolYear) => SchoolYear) => {
    setSchoolYears(prev => prev.map(y => y.id === yearId ? fn(y) : y));
  }, []);

  const mutateSubject = useCallback((yearId: string, subjectId: string, fn: (s: Subject) => Subject) => {
    mutateYear(yearId, y => ({
      ...y,
      subjects: y.subjects.map(s => s.id === subjectId ? fn(s) : s),
    }));
  }, [mutateYear]);

  const mutateClass = useCallback((yearId: string, subjectId: string, classId: string, fn: (c: Class) => Class) => {
    mutateSubject(yearId, subjectId, s => ({
      ...s,
      classes: s.classes.map(c => c.id === classId ? fn(c) : c),
    }));
  }, [mutateSubject]);

  // ── school years ─────────────────────────────────────────────────────────
  const addSchoolYear = useCallback((label: string) => {
    setSchoolYears(prev => [...prev, { id: nanoid(), label, subjects: [] }]);
  }, []);

  const deleteSchoolYear = useCallback((id: string) => {
    setSchoolYears(prev => prev.filter(y => y.id !== id));
  }, []);

  // ── subjects ──────────────────────────────────────────────────────────────
  const addSubject = useCallback((yearId: string, name: string) => {
    mutateYear(yearId, y => ({ ...y, subjects: [...y.subjects, { id: nanoid(), name, classes: [] }] }));
  }, [mutateYear]);

  const deleteSubject = useCallback((yearId: string, subjectId: string) => {
    mutateYear(yearId, y => ({ ...y, subjects: y.subjects.filter(s => s.id !== subjectId) }));
  }, [mutateYear]);

  // ── classes ───────────────────────────────────────────────────────────────
  const addClass = useCallback((yearId: string, subjectId: string, name: string) => {
    mutateSubject(yearId, subjectId, s => ({
      ...s,
      classes: [...s.classes, { id: nanoid(), name, students: [], assessments: [] }],
    }));
  }, [mutateSubject]);

  const deleteClass = useCallback((yearId: string, subjectId: string, classId: string) => {
    mutateSubject(yearId, subjectId, s => ({ ...s, classes: s.classes.filter(c => c.id !== classId) }));
  }, [mutateSubject]);

  // ── students ──────────────────────────────────────────────────────────────
  const addStudent = useCallback((yearId: string, subjectId: string, classId: string, classNo: string, name: string) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: [...c.students, { id: nanoid(), classNo, name }],
    }));
  }, [mutateClass]);

  const updateStudent = useCallback((yearId: string, subjectId: string, classId: string, studentId: string, classNo: string, name: string) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: c.students.map(s => s.id === studentId ? { ...s, classNo, name } : s),
    }));
  }, [mutateClass]);

  const deleteStudent = useCallback((yearId: string, subjectId: string, classId: string, studentId: string) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: c.students.filter(s => s.id !== studentId),
    }));
  }, [mutateClass]);

  const importStudents = useCallback((yearId: string, subjectId: string, classId: string, students: { classNo: string; name: string }[]) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      students: students.map(s => ({ id: nanoid(), classNo: s.classNo, name: s.name })),
    }));
  }, [mutateClass]);

  // ── assessments ───────────────────────────────────────────────────────────
  const addAssessment = useCallback((yearId: string, subjectId: string, classId: string, term: Term, nature: AssessmentNature, title: string): Assessment => {
    const a: Assessment = { id: nanoid(), term, nature, title, markSheet: [], scores: [] };
    mutateClass(yearId, subjectId, classId, c => ({ ...c, assessments: [...c.assessments, a] }));
    return a;
  }, [mutateClass]);

  const updateMarkSheet = useCallback((yearId: string, subjectId: string, classId: string, assessmentId: string, markSheet: MarkItem[]) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.map(a => a.id === assessmentId ? { ...a, markSheet } : a),
    }));
  }, [mutateClass]);

  const updateScores = useCallback((yearId: string, subjectId: string, classId: string, assessmentId: string, scores: ScoreEntry[]) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.map(a => a.id === assessmentId ? { ...a, scores } : a),
    }));
  }, [mutateClass]);

  const upsertScore = useCallback((yearId: string, subjectId: string, classId: string, assessmentId: string, studentId: string, itemScores: { itemId: string; score: number }[]) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.map(a => {
        if (a.id !== assessmentId) return a;
        const existing = a.scores.find(s => s.studentId === studentId);
        const newScoreRecord: Record<string, number | null> = {};
        itemScores.forEach(is => { newScoreRecord[is.itemId] = is.score; });
        const newEntry: ScoreEntry = { studentId, scores: newScoreRecord };
        if (existing) {
          return { ...a, scores: a.scores.map(s => s.studentId === studentId ? newEntry : s) };
        }
        return { ...a, scores: [...a.scores, newEntry] };
      }),
    }));
  }, [mutateClass]);

  const deleteScore = useCallback((yearId: string, subjectId: string, classId: string, assessmentId: string, studentId: string) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.map(a =>
        a.id === assessmentId ? { ...a, scores: a.scores.filter(s => s.studentId !== studentId) } : a
      ),
    }));
  }, [mutateClass]);

  const deleteAssessment = useCallback((yearId: string, subjectId: string, classId: string, assessmentId: string) => {
    mutateClass(yearId, subjectId, classId, c => ({
      ...c,
      assessments: c.assessments.filter(a => a.id !== assessmentId),
    }));
  }, [mutateClass]);

  // ── getters ───────────────────────────────────────────────────────────────
  const getSchoolYear = useCallback((yearId: string) => schoolYears.find(y => y.id === yearId), [schoolYears]);
  const getSubject = useCallback((yearId: string, subjectId: string) => getSchoolYear(yearId)?.subjects.find(s => s.id === subjectId), [getSchoolYear]);
  const getClass = useCallback((yearId: string, subjectId: string, classId: string) => getSubject(yearId, subjectId)?.classes.find(c => c.id === classId), [getSubject]);
  const getAssessment = useCallback((yearId: string, subjectId: string, classId: string, assessmentId: string) => getClass(yearId, subjectId, classId)?.assessments.find(a => a.id === assessmentId), [getClass]);

  return (
    <DataContext.Provider value={{
      schoolYears,
      addSchoolYear, deleteSchoolYear,
      addSubject, deleteSubject,
      addClass, deleteClass,
      addStudent, updateStudent, deleteStudent, importStudents,
      addAssessment, updateMarkSheet, updateScores, upsertScore, deleteScore, deleteAssessment,
      getSchoolYear, getSubject, getClass, getAssessment,
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

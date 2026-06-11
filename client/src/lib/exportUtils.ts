import type { Assessment, Student, MarkItem, ScoreEntry } from "@/contexts/DataContext";

/**
 * Builds a CSV string for the given assessment mark sheet + student scores.
 * Layout:
 *   Row 1: headers — Class No | Student Name | Q1 | 2(a) | 2(b) | … | Total | %
 *   Row 2+: one student per row
 */
export function buildMarkSheetCSV(
  assessment: Assessment,
  students: Student[]
): string {
  const items = assessment.markSheet.filter(i => !i.isSection);
  const maxTotal = items.reduce((s, i) => s + i.maxMark, 0);

  const headers = [
    "Class No",
    "Student Name",
    ...items.map(i => i.label),
    "Total",
    "%",
  ];

  const rows: string[][] = students
    .slice()
    .sort((a, b) => a.classNo.localeCompare(b.classNo, undefined, { numeric: true }))
    .map(student => {
      const entry = assessment.scores.find(e => e.studentId === student.id);
      const scoreValues = items.map(item => {
        const v = entry?.scores[item.id];
        return v != null ? String(v) : "";
      });
      const total = entry
        ? items.reduce((s, item) => {
            const v = entry.scores[item.id];
            return s + (v ?? 0);
          }, 0)
        : "";
      const pct =
        typeof total === "number" && maxTotal > 0
          ? ((total / maxTotal) * 100).toFixed(1) + "%"
          : "";
      return [student.classNo, student.name, ...scoreValues, String(total), pct];
    });

  const allRows = [headers, ...rows];
  return allRows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

/**
 * Triggers a browser download of the CSV file.
 */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Builds a suggested filename for the exported CSV.
 */
export function buildExportFilename(
  yearLabel: string,
  subjectName: string,
  className: string,
  assessment: Assessment
): string {
  const parts = [
    yearLabel,
    subjectName.replace(/\s+/g, "_"),
    className,
    assessment.term.replace(/\s+/g, ""),
    assessment.natureId,
    assessment.title.replace(/\s+/g, "_"),
  ];
  return parts.join("_") + ".csv";
}

/**
 * Generates a Google Sheets import URL (opens Sheets with the CSV pre-loaded).
 * Note: this uses the "Import" URL pattern — user must be signed in to Google.
 */
export function buildGoogleSheetsImportUrl(csvDataUrl: string): string {
  return `https://docs.google.com/spreadsheets/d/create?usp=pp_url&import=${encodeURIComponent(csvDataUrl)}`;
}

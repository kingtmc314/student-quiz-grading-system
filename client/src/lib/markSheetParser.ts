import type { MarkItem } from "@/contexts/DataContext";
import { nanoid } from "nanoid";

/**
 * Parses a question-structure definition into MarkItem rows.
 *
 * Supported input formats (one entry per line):
 *   1          5          → plain question, 5 marks
 *   2(a)       3          → subpart
 *   6(a)(i)    2          → nested subpart
 *   Section A             → section header (no marks)
 *   Total                 → total row
 *
 * Lines starting with # are ignored (comments).
 * Blank lines are ignored.
 */
export function parseMarkSheetText(raw: string): MarkItem[] {
  const items: MarkItem[] = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Section / Total rows
    if (/^(section\s+[a-z]|total)$/i.test(trimmed)) {
      items.push({ id: nanoid(), label: trimmed, maxMark: 0, isSection: true });
      continue;
    }

    // Question rows: label followed by optional mark value
    const match = trimmed.match(/^([^\s]+)\s+(\d+(?:\.\d+)?)$/);
    if (match) {
      items.push({ id: nanoid(), label: match[1], maxMark: parseFloat(match[2]), isSection: false });
      continue;
    }

    // Label only (no marks yet)
    const labelOnly = trimmed.match(/^([^\s]+)$/);
    if (labelOnly) {
      items.push({ id: nanoid(), label: labelOnly[1], maxMark: 0, isSection: false });
    }
  }

  return items;
}

/**
 * Generates a default mark-sheet structure from a question count description.
 * e.g. "12 questions, Q1-Q6 have subparts (a)(b), Q7-Q10 have (a)(b)(i)(ii), Q11-Q12 plain"
 *
 * For quick demo / manual entry, this helper generates a simple numbered list.
 */
export function generateDefaultMarkSheet(questionCount: number): MarkItem[] {
  const items: MarkItem[] = [];
  for (let i = 1; i <= questionCount; i++) {
    items.push({ id: nanoid(), label: String(i), maxMark: 0, isSection: false });
  }
  return items;
}

/**
 * Validates that all labels are unique and marks are non-negative.
 */
export function validateMarkSheet(items: MarkItem[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.label.trim()) {
      errors.push("An item has an empty label.");
    }
    if (seen.has(item.label)) {
      errors.push(`Duplicate label: "${item.label}"`);
    }
    seen.add(item.label);
    if (!item.isSection && item.maxMark < 0) {
      errors.push(`Negative mark for "${item.label}"`);
    }
  }
  return errors;
}

/**
 * Computes the total max marks (excluding section rows).
 */
export function totalMaxMarks(items: MarkItem[]): number {
  return items.filter(i => !i.isSection).reduce((sum, i) => sum + i.maxMark, 0);
}

/**
 * Serialises a MarkItem array back to the plain-text format.
 */
export function serialiseMarkSheet(items: MarkItem[]): string {
  return items
    .map(i => i.isSection ? i.label : `${i.label}\t${i.maxMark}`)
    .join("\n");
}

# Data Model & Schema Design

## Hierarchy

```
SchoolYear (e.g. "2526")
  └─ Subject (e.g. "Mathematics M2")
       └─ Class (e.g. "6A", "6B")
            └─ NameList [ { classNo, studentName } ]
            └─ Term (Term 1 | Term 2)
                 └─ AssessmentNature (Quiz | Test | Exam)
                      └─ Assessment { title, uploadedFile, markSheet[] }
```

## Mark Sheet Row

Each row corresponds to one question item in the hierarchy:

```
{ label: "6(a)(i)", maxMark: 3 }
```

Label format rules (matching DSE M2 convention):
- Top-level question:      "1", "2", ..., "12"
- First subpart:           "2(a)", "2(b)"
- Second subpart:          "7(b)(i)", "7(b)(ii)"
- Third subpart:           "11(a)(i)(1)", "11(a)(i)(2)"
- Section totals:          "Section A", "Section B", "Total"

## Student Score Entry

```
{ studentId, assessmentId, scores: { "2(a)": 3, "2(b)": 5, ... }, total, percentage }
```

## Google Sheets Export Layout

Row 1:  Header — Class | Student Name | 1 | 2(a) | 2(b) | ... | Total | %
Row 2+: One student per row

Sheet name: "{SchoolYear} {Subject} {Class} {Term} {Nature} {Title}"

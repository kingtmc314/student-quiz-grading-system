# Reference Site: PhysicsQuiz Analyzer (V2.11)

## Key UX Patterns Observed

1. **Dark navy sidebar** with tab-style navigation buttons (學生管理, 小測成績輸入, 弱點分析, 統測/大考總表, 課題圖表分析, 課題綜合分析, 數據備份)
2. **Cohort (group) selector** at top of sidebar — filter students by year group
3. **Student list panel** (left column) — shows Class(No.) Name, with score summary e.g. "11 / 25"
4. **Score entry panel** (right column) — question labels grouped by section (MC 選擇題 / LQ 長題目), each with a number input; label shows max marks e.g. "LQ1a /2"
5. **Question label format**: MC1, MC2... LQ1a, LQ1b, LQ1c, LQ2a, LQ3ai, LQ3aii, LQ3b, LQ3c — maps to our hierarchy: 1, 2(a), 2(b), 6(a)(i), 6(a)(ii)
6. **Clear record button** per student per quiz
7. **Summary/Overview tab** — select student, see cross-topic performance
8. **Cloud sync button** — saves to Google Sheets/Drive
9. **Student import** — paste from Excel (班別 Tab 學號 Tab 姓名)

## What Our System Should Match/Improve

- Same split-panel layout: student list left, score entry right
- Question labels use our DSE hierarchy: 1, 2(a), 2(b), 6(a)(i), 6(a)(ii)
- Grouped by Section A / Section B with section headers
- Show running total as scores are entered
- Class-wide results table (all students × all questions)
- Export to CSV → Google Sheets
- Bilingual labels (EN/ZH toggle)
- Hierarchy: SchoolYear > Subject > Class > Term > Nature > Assessment

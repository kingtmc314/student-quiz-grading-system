# Reference Site: PhysicsQuiz Analyzer (V2.11)

## Layout
- Dark navy left sidebar (~175px wide) with app title at top
- Main content area takes remaining width, white/light gray bg
- No top navigation bar — all navigation is in sidebar tabs

## Sidebar
- App title bold + subtitle
- Green "💾 儲存並同步至雲端" sync button
- Cohort dropdown selector
- Vertical tab buttons with icon + label, active = blue highlight

## Tabs
- 學生管理 (Student Management)
- 小測成績輸入 (Quiz Score Entry) ← main grading tab
- 弱點分析 & 補底 (Weakness Analysis)
- 統測/大考總表 (Summary Table)
- 課題圖表分析 (Topic Chart Analysis)
- 課題綜合分析 (全班) (Class Analysis)
- 數據備份與還原 (Backup & Restore)

## Quiz Score Entry Tab
- TWO-PANEL layout:
  - LEFT (~180px): scrollable student list
    - Each row: "CLASS(NO) NAME  SCORE/TOTAL"
    - Selected student = blue highlight
  - RIGHT: score entry area
    - Quiz selector dropdown (top right corner)
    - "MC 選擇題" section: grid of MC1..MC7 number inputs (orange card style)
    - "LQ 長題目" section: grid of LQ inputs with label + /MAX (e.g. LQ1a /2)
    - "清除此卷紀錄" button bottom right
    - Running total live in student list

## Summary Table Tab
- Student dropdown at top right
- Cross-quiz summary table for selected student

## Color Scheme
- Sidebar: #1a2035 very dark navy
- Active tab: #3b82f6 blue-500
- Main bg: white/light gray
- MC input cards: orange/amber border
- LQ input cards: similar card style
- Score text: muted gray

## Key UX Patterns
- Click student → score panel appears immediately (no page nav)
- Auto-save on input change (no explicit save button per question)
- Clear record button per student per quiz
- Student import: paste from Excel (班別 Tab 學號 Tab 姓名)
- Question labels: MC1, MC2... LQ1a, LQ1b → our system: 1, 2(a), 2(b), 6(a)(i)

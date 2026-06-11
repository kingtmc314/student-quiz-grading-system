# Design Ideas for Student Quiz Grading System

## Design Philosophy Exploration

<response>
<text>
**Approach A — Academic Precision (Probability: 0.07)**

**Design Movement:** Swiss International Typographic Style meets modern administrative software.

**Core Principles:**
- Information density without clutter: every pixel earns its place
- Strict typographic hierarchy using weight contrast, not decorative elements
- Neutral palette with a single authoritative accent colour
- Grid-based but asymmetric: sidebar anchors the layout, content breathes

**Color Philosophy:** Off-white (#F7F6F3) background, near-black (#1A1A1A) text, and a single deep teal (#0D6E6E) accent for interactive elements. Teal signals trust and academic authority without the corporate coldness of navy blue.

**Layout Paradigm:** Persistent left sidebar (collapsible) with a content area that uses a two-column grid on desktop. Breadcrumb trail at the top shows the full hierarchy path (School Year > Subject > Class > Term > Quiz).

**Signature Elements:**
- Thin horizontal rule separators between sections (1px, 20% opacity)
- Monospaced font for question numbers and scores (reinforces precision)
- Subtle row-striping in mark-sheet tables

**Interaction Philosophy:** Inline editing — click a cell to edit, press Tab to advance. No modal dialogs for routine score entry.

**Animation:** Minimal. Row highlights fade in at 120ms ease-out. Sidebar collapses with a 200ms ease-in-out. No decorative motion.

**Typography System:**
- Display/Heading: DM Sans 600 (clean, slightly geometric)
- Body: DM Sans 400
- Numbers/Codes: JetBrains Mono 400 (question labels, scores)
</text>
<probability>0.07</probability>
</response>

<response>
<text>
**Approach B — Structured Warmth (Probability: 0.06)**

**Design Movement:** Contemporary editorial design applied to educational tooling.

**Core Principles:**
- Warm neutrals replace cold greys to reduce fatigue during long grading sessions
- Hierarchy is communicated through spatial rhythm, not borders
- Colour-coded status indicators (not submitted, partial, complete) replace text labels
- Compact information density with generous line-height for readability

**Color Philosophy:** Warm cream (#FAFAF7) background, dark slate (#2C2C2C) text, amber (#D97706) for primary actions, and soft sage (#6B8F71) for success states. The palette evokes a well-worn teacher's notebook.

**Layout Paradigm:** Top navigation bar with a persistent breadcrumb, and a main content area that expands to full width. The mark-sheet table is the centrepiece — wide, scannable, with frozen first column (student names) and frozen header row (question labels).

**Signature Elements:**
- Amber left-border accent on active sidebar items
- Pill badges for term and quiz type labels
- Subtle paper-texture overlay on card backgrounds (very low opacity noise)

**Interaction Philosophy:** Keyboard-first score entry. Arrow keys navigate cells; Enter confirms and moves down. Batch operations available via row checkboxes.

**Animation:** Gentle. Cards slide up 8px on mount at 180ms ease-out. Table rows highlight with a warm amber tint on hover.

**Typography System:**
- Display/Heading: Lora 600 (serif, editorial authority)
- Body: Source Sans 3 400/600
- Numbers: Source Code Pro 400
</text>
<probability>0.06</probability>
</response>

<response>
<text>
**Approach C — Institutional Clarity (Probability: 0.08)**

**Design Movement:** Government/institutional design language modernised with flat-material principles.

**Core Principles:**
- Deep navy sidebar as the structural anchor, white content area for contrast
- Explicit visual hierarchy: section headers, subsection headers, data rows each have a distinct visual weight
- Status-driven colour system (draft, active, archived) visible at a glance
- Print-ready mark sheets — what you see on screen matches what you export

**Color Philosophy:** Deep navy (#1E3A5F) for sidebar and headers, white (#FFFFFF) for content surfaces, sky blue (#3B82F6) for primary actions, and light grey (#F1F5F9) for alternating table rows. The palette is familiar to educators who use school management software.

**Layout Paradigm:** Fixed-width navy sidebar (240px) with icon + label navigation. Content area uses a single-column flow with full-width tables. Breadcrumb hierarchy is always visible below the top header bar.

**Signature Elements:**
- Navy sidebar with white text and sky-blue active indicator
- Bold section dividers with uppercase tracking labels
- Sticky table headers with a subtle drop-shadow on scroll

**Interaction Philosophy:** Wizard-style flow for creating a new quiz record (step 1: select hierarchy, step 2: upload paper, step 3: review mark sheet, step 4: enter scores). Each step is clearly numbered.

**Animation:** Purposeful. Step transitions slide left/right at 250ms ease-in-out. Table rows fade in staggered at 30ms intervals on first load.

**Typography System:**
- Display/Heading: Nunito Sans 700
- Body: Nunito Sans 400/600
- Numbers: IBM Plex Mono 400
</text>
<probability>0.08</probability>
</response>

---

## Selected Design: Approach C — Institutional Clarity

Deep navy sidebar, white content surfaces, sky-blue accents, and a wizard-style flow for quiz creation. The design prioritises legibility, print-readiness, and a familiar school-management aesthetic. Typography uses Nunito Sans for headings/body and IBM Plex Mono for all numeric data.

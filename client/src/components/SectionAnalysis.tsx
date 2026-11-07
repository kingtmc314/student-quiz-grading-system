import type { SectionAnalysis } from "@shared/sectionAnalysis";

const textFor = (lang: string) => lang === "zh" ? {
  title: "分 Section 表現分析", section: "部分", questions: "題目", mark: "個人得分 / 滿分", average: "班均 / 滿分", pct: "得分率", gap: "與班均差距", high: "最高 / 滿分", low: "最低 / 滿分", count: "有效人數", advice: "分析與跟進",
  note: "只按整份已正常完成的評估計算；ABS、遲交、欠交及未完成輸入不納入此強弱分析，個人總分與加權規則不變。",
  peerNote: "個人比較的班均不包括本人。", swipe: "可左右滑動表格查看全部分析。",
  defaultNote: "未設定 Section 的題目保留為「全卷／未分組」；教師可在評分表加入 Section 標題行。", none: "尚未有評分題目。", unavailable: "未有足夠有效成績，暫不判讀。", ungrouped: "未分組題目", whole: "全卷", points: "百分點", review: "優先重溫此部分的基礎概念，重做錯題，再以短測檢查掌握度。", consolidate: "已有部分基礎；整理失分步驟，加入同類與混合題練習。", strong: "此部分表現較穩；可嘗試多步應用題，並保留定期複習。", below: "相對班均較弱，建議優先跟進。", noScore: "—",
} : {
  title: "Section Performance Analysis", section: "Section", questions: "Questions", mark: "My mark / max", average: "Class avg / max", pct: "Attainment", gap: "Gap to class avg", high: "Highest / max", low: "Lowest / max", count: "Valid students", advice: "Interpretation & next steps",
  note: "Based on fully completed, on-time papers only. ABS, late, missing and incomplete entries do not contribute to this strengths analysis. Personal totals and weighting rules remain unchanged.",
  peerNote: "Personal comparisons use the class average excluding you.", swipe: "Swipe the table sideways to see all analysis columns.",
  defaultNote: "Items without a section remain under Whole paper / Ungrouped. Teachers can add Section heading rows in the mark sheet.", none: "No question items configured yet.", unavailable: "Insufficient eligible marks; no interpretation yet.", ungrouped: "Ungrouped questions", whole: "Whole paper", points: "pp", review: "Review the core concepts in this section, redo incorrect questions, then check understanding with a short quiz.", consolidate: "Some foundation is evident. Identify lost-mark steps and practise similar and mixed questions.", strong: "Performance is relatively secure. Try multi-step application problems while keeping regular review.", below: "Below the class average; prioritise follow-up.", noScore: "—",
};
const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const marks = (value: number | null, max: number) => `${value === null ? "—" : formatNumber(value)} / ${formatNumber(max)}`;
const sectionLabel = (row: SectionAnalysis, lang: string) => row.isDefault ? (row.label === "Whole paper" ? textFor(lang).whole : textFor(lang).ungrouped) : row.label;
function insight(row: SectionAnalysis, lang: string, personal: boolean) {
  const t = textFor(lang);
  const pct = personal ? row.pct : row.averagePct;
  if (pct === null) return t.unavailable;
  const advice = pct < 50 ? t.review : pct < 70 ? t.consolidate : t.strong;
  return personal && row.averagePct !== null && pct < row.averagePct ? `${t.below} ${advice}` : advice;
}
const color = (pct: number | null) => pct === null ? "#94a3b8" : pct >= 70 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
const escape = (value: string | number) => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Self-contained print HTML shared by teacher and student report templates. */
export function sectionAnalysisHtml(sections: SectionAnalysis[], lang: string, personal = false) {
  if (!sections.length) return "";
  const t = textFor(lang);
  const headings = [t.section, ...(personal ? [t.mark] : []), t.average, t.pct, ...(personal ? [t.gap] : [t.high, t.low, t.count]), t.advice];
  const td = (content: string, style = "") => `<td style="padding:6px;border-bottom:1px solid #e2e8f0;vertical-align:top;${style}">${content}</td>`;
  const rows = sections.map(row => {
    const pct = personal ? row.pct : row.averagePct;
    const gap = row.pct !== null && row.averagePct !== null ? Math.round((row.pct - row.averagePct) * 10) / 10 : null;
    return `<tr>${td(`<b>${escape(sectionLabel(row, lang))}</b><div style="font-size:8px;color:#64748b;margin-top:2px">${escape(t.questions)}: ${row.questionLabels.map(escape).join(", ")}</div>`, "width:24%")}${personal ? td(escape(marks(row.score, row.max)), "white-space:nowrap;font-family:monospace") : ""}${td(escape(marks(row.average, row.max)), "white-space:nowrap;font-family:monospace")}${td(`${pct === null ? "—" : `${formatNumber(pct)}%`}<div style="background:#e2e8f0;height:4px;margin-top:3px"><div style="background:${color(pct)};height:4px;width:${Math.min(100, Math.max(0, pct ?? 0))}%"></div></div>`, `color:${color(pct)};font-weight:700`)}${personal ? td(gap === null ? "—" : `${gap > 0 ? "+" : ""}${formatNumber(gap)} ${t.points}`, "white-space:nowrap") : td(escape(marks(row.highest, row.max))) + td(escape(marks(row.lowest, row.max))) + td(String(row.participantCount))}${td(escape(insight(row, lang, personal)), "font-size:8px;min-width:100px")}</tr>`;
  }).join("");
  return `<div style="margin:12px 0;break-inside:auto"><h4 style="margin:0 0 6px;font-size:12px;color:#0f766e">${t.title}</h4><p style="font-size:8px;color:#64748b;margin:0 0 6px">${t.note}${personal ? ` ${t.peerNote}` : ""}</p>${sections.some(row => row.isDefault) ? `<p style="font-size:8px;color:#64748b;margin:0 0 6px">${t.defaultNote}</p>` : ""}<table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr>${headings.map(heading => `<th style="padding:6px;text-align:left;color:#fff;background:#0f766e">${heading}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function SectionAnalysisPanel({ sections, lang, personal = false }: { sections: SectionAnalysis[]; lang: string; personal?: boolean }) {
  const t = textFor(lang);
  return <section className="my-4 overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
    <header className="border-b border-teal-100 bg-teal-50/60 p-4"><h3 className="text-sm font-bold text-teal-900">{t.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t.note}{personal ? ` ${t.peerNote}` : ""}</p>{sections.some(row => row.isDefault) && <p className="mt-1 text-[11px] text-slate-500">{t.defaultNote}</p>}<p className="mt-2 text-[11px] font-semibold text-teal-700 md:hidden">{t.swipe}</p></header>
    {!sections.length ? <p className="p-4 text-xs text-slate-400">{t.none}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{[t.section, ...(personal ? [t.mark] : []), t.average, t.pct, ...(personal ? [t.gap] : [t.high, t.low, t.count]), t.advice].map(heading => <th key={heading} className="px-3 py-2 text-left font-semibold">{heading}</th>)}</tr></thead><tbody>{sections.map(row => {
      const pct = personal ? row.pct : row.averagePct;
      const gap = row.pct !== null && row.averagePct !== null ? Math.round((row.pct - row.averagePct) * 10) / 10 : null;
      return <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70"><td className="min-w-36 px-3 py-3"><p className="font-bold text-slate-800">{sectionLabel(row, lang)}</p><p className="mt-1 text-[10px] text-slate-500">{t.questions}: {row.questionLabels.join(", ")}</p></td>{personal && <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-teal-700">{marks(row.score, row.max)}</td>}<td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{marks(row.average, row.max)}</td><td className="min-w-24 px-3 py-3"><p className="font-mono font-bold" style={{ color: color(pct) }}>{pct === null ? "—" : `${formatNumber(pct)}%`}</p><div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-100"><div className="h-full rounded" style={{ background: color(pct), width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} /></div></td>{personal ? <td className="whitespace-nowrap px-3 py-3 font-mono" style={{ color: color(gap === null ? null : gap >= 0 ? 100 : 0) }}>{gap === null ? "—" : `${gap > 0 ? "+" : ""}${formatNumber(gap)} ${t.points}`}</td> : <><td className="whitespace-nowrap px-3 py-3 font-mono">{marks(row.highest, row.max)}</td><td className="whitespace-nowrap px-3 py-3 font-mono">{marks(row.lowest, row.max)}</td><td className="px-3 py-3 font-mono">{row.participantCount}</td></>}<td className="min-w-52 px-3 py-3 text-[11px] leading-relaxed text-slate-600">{insight(row, lang, personal)}</td></tr>;
    })}</tbody></table></div>}
  </section>;
}

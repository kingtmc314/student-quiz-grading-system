import { useData } from "@/contexts/DataContext";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Download, KeyRound, Loader2, LogIn, RefreshCw, Search, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type StudentLoginAccount = {
  id: number;
  username: string | null;
  name: string | null;
  role: "user" | "admin" | "teacher" | "student";
  studentId: string | null;
  studentNumber: string | null;
  active: boolean;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type StudentNumberCandidate = {
  studentNumber: string;
  name: string;
  representativeStudentId: string;
  recordCount: number;
  locations: string[];
  searchText: string;
};

const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" }) : "—";
const csvCell = (value: string | number | null | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function StudentLoginManagement() {
  const { schoolYears, subjects } = useData();
  const utils = trpc.useUtils();
  const { data: accounts, isLoading, error } = trpc.studentLogins.list.useQuery();
  const [search, setSearch] = useState("");
  const [selectedNumber, setSelectedNumber] = useState("");
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentLoginAccount | null>(null);

  const candidates = useMemo<StudentNumberCandidate[]>(() => {
    const subjectById = new Map(subjects.map(subject => [subject.id, subject]));
    const groups = new Map<string, StudentNumberCandidate>();
    schoolYears.forEach(year => year.subjects.forEach(yearSubject => yearSubject.classes.forEach(cls => cls.students.forEach(student => {
      const suppliedNumber = student.studentNumber?.trim();
      if (!suppliedNumber) return;
      const studentNumber = suppliedNumber.toLocaleUpperCase();
      const subject = subjectById.get(yearSubject.subjectId);
      const location = `${year.label} · ${subject?.code ?? yearSubject.subjectId} · ${cls.name}`;
      const existing = groups.get(studentNumber);
      if (existing) {
        existing.recordCount += 1;
        if (!existing.locations.includes(location)) existing.locations.push(location);
        return;
      }
      const name = student.nameCht?.trim() || student.name;
      groups.set(studentNumber, {
        studentNumber,
        name,
        representativeStudentId: student.id,
        recordCount: 1,
        locations: [location],
        searchText: `${studentNumber} ${name} ${student.name} ${student.nameCht} ${location}`.toLocaleLowerCase(),
      });
    }))));
    return Array.from(groups.values()).sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: "base" }));
  }, [schoolYears, subjects]);

  const accountByStudentNumber = useMemo(() => new Map((accounts ?? []).flatMap(account => account.studentNumber ? [[account.studentNumber.toLocaleUpperCase(), account] as const] : [])), [accounts]);
  const filteredCandidates = useMemo(() => candidates.filter(candidate => candidate.searchText.includes(search.trim().toLocaleLowerCase())), [candidates, search]);
  const selectedCandidate = candidates.find(candidate => candidate.studentNumber === selectedNumber);
  const unlinkedCandidates = useMemo(() => candidates.filter(candidate => !accountByStudentNumber.has(candidate.studentNumber)), [candidates, accountByStudentNumber]);
  const linkedCount = candidates.length - unlinkedCandidates.length;

  const invalidateAccounts = async () => utils.studentLogins.list.invalidate();
  const createLogin = trpc.studentLogins.createByNumber.useMutation({
    onSuccess: async (_result, input) => {
      await invalidateAccounts();
      setSelectedNumber("");
      toast.success(`已建立學生登入帳戶：${input.studentNumber}；預設密碼為「${input.studentNumber.toLocaleUpperCase()}hoyu」。`);
    },
    onError: err => toast.error(err.message),
  });
  const createBatch = trpc.studentLogins.createBatch.useMutation({
    onSuccess: async result => {
      await invalidateAccounts();
      setBatchDialogOpen(false);
      toast.success(`已建立 ${result.created.length} 個學生登入帳戶${result.skipped.length ? `；略過 ${result.skipped.length} 個已有或不合資格帳戶` : ""}。`);
    },
    onError: err => toast.error(err.message),
  });
  const resetDefaultPassword = trpc.studentLogins.resetDefaultPassword.useMutation({
    onSuccess: async () => {
      await invalidateAccounts();
      toast.success("已重設為學生編號 + hoyu 的預設密碼。");
    },
    onError: err => toast.error(err.message),
  });
  const deleteLogin = trpc.studentLogins.delete.useMutation({
    onSuccess: async () => {
      await invalidateAccounts();
      setDeleteTarget(null);
      toast.success("學生登入帳戶已刪除；學生名單及所有學業資料均已保留。");
    },
    onError: err => toast.error(err.message),
  });

  const exportAccountList = () => {
    const rows = [
      ["Student Number", "Login ID", "Student", "Status", "Password Policy", "Last Sign-in", "Created At"],
      ...(accounts ?? []).map(account => [
        account.studentNumber, account.username, account.name,
        account.active ? "Active" : "Disabled",
        "Default: student number + hoyu",
        formatDate(account.lastSignedIn), formatDate(account.createdAt),
      ]),
    ];
    const blob = new Blob([`\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `student-login-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <div className="h-full overflow-auto bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2"><UsersRound className="h-6 w-6 text-teal-600" /><h2 className="text-xl font-bold text-slate-900">學生登入管理</h2></div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">每個<strong>學生編號</strong>只會建立一個登入帳戶，即使同一學生出現在不同學年、班別或同科歷史記錄中。帳戶名稱為學生編號；預設密碼為「學生編號 + hoyu」。</p>
      </div>
      <Badge className="w-fit bg-teal-100 text-teal-800 hover:bg-teal-100">按學生編號跨學年配對</Badge>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">已有學生編號</p><p className="mt-1 text-2xl font-bold text-slate-800">{candidates.length}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">已建立登入</p><p className="mt-1 text-2xl font-bold text-teal-700">{linkedCount}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">尚未建立登入</p><p className="mt-1 text-2xl font-bold text-blue-700">{unlinkedCandidates.length}</p></div>
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5"><Label htmlFor="student-login-search">搜尋學生編號或姓名</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="student-login-search" className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setSelectedNumber(""); }} placeholder="例如：20260001、陳大文" /></div></div>
        <div className="min-w-0 flex-[1.6] space-y-1.5"><Label htmlFor="student-login-number">選擇未建立登入的學生編號</Label><select id="student-login-number" value={selectedNumber} onChange={event => setSelectedNumber(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={createLogin.isPending}><option value="">請選擇</option>{filteredCandidates.filter(candidate => !accountByStudentNumber.has(candidate.studentNumber)).map(candidate => <option key={candidate.studentNumber} value={candidate.studentNumber}>{candidate.studentNumber} · {candidate.name} · {candidate.locations.join(" / ")}</option>)}</select></div>
        <Button onClick={() => selectedCandidate && createLogin.mutate({ studentNumber: selectedCandidate.studentNumber, name: selectedCandidate.name, representativeStudentId: selectedCandidate.representativeStudentId })} disabled={!selectedCandidate || createLogin.isPending} className="bg-teal-600 hover:bg-teal-700">{createLogin.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />建立中…</> : <><LogIn className="h-4 w-4" />建立學生登入</>}</Button>
        <Button onClick={() => setBatchDialogOpen(true)} disabled={!unlinkedCandidates.length || createBatch.isPending} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"><UsersRound className="h-4 w-4" />批量建立 ({unlinkedCandidates.length})</Button>
      </div>
      {selectedCandidate && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900"><p className="font-semibold">即將建立：{selectedCandidate.studentNumber} · {selectedCandidate.name}</p><p className="mt-1">帳戶名稱：<code className="rounded bg-white px-1.5 py-0.5">{selectedCandidate.studentNumber}</code>；預設密碼：<code className="rounded bg-white px-1.5 py-0.5">{selectedCandidate.studentNumber}hoyu</code>。</p></div>}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">批量建立只會為「尚未有登入帳戶」且已填學生編號的學生建立登入；重複提交會自動略過，不會重設現有密碼或修改任何學業資料。沒有學生編號的學生不會出現在本頁，請先在「學生管理」補上編號。</p>
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-800">學生登入帳戶</h3><p className="mt-1 text-xs text-slate-500">系統只儲存加鹽密碼雜湊，不會儲存或匯出密碼。</p></div><Button variant="outline" size="sm" onClick={exportAccountList} disabled={!(accounts ?? []).length}><Download className="h-4 w-4" />匯出帳戶清單</Button></div>
      {isLoading && <div className="flex justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入學生帳戶中…</div>}
      {error && <div className="p-5 text-sm text-red-600">無法載入學生帳戶：{error.message}</div>}
      {!isLoading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">學生編號／登入帳戶</th><th className="px-4 py-3">學生</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3">密碼規則</th><th className="px-4 py-3">最近登入</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{(accounts ?? []).length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">尚未建立學生登入帳戶。</td></tr> : (accounts ?? []).map(account => <tr key={account.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><p className="font-mono font-semibold text-teal-800">{account.studentNumber || "舊式記錄"}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{account.username || "—"}</p></td><td className="px-4 py-4 font-medium text-slate-800">{account.name || "未命名"}</td><td className="px-4 py-4">{account.active ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />啟用</span> : <span className="text-slate-500">已停用</span>}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600"><KeyRound className="h-3.5 w-3.5" />預設：編號 + hoyu</span></td><td className="px-4 py-4 text-xs text-slate-600">{formatDate(account.lastSignedIn)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{account.studentNumber && <Button variant="outline" size="sm" onClick={() => resetDefaultPassword.mutate({ accountId: account.id })} disabled={resetDefaultPassword.isPending}><RefreshCw className="h-3.5 w-3.5" />重設密碼</Button>}<Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(account)} disabled={deleteLogin.isPending}><Trash2 className="h-3.5 w-3.5" />刪除帳戶</Button></div></td></tr>)}</tbody></table></div>}
    </section>

    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900"><div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />帳戶安全與配對規則</div><ul className="mt-2 list-disc space-y-1 pl-5"><li>一個學生編號只可有一個學生登入帳戶，並可跨學年對應同一學生。</li><li>帳戶名稱為學生編號；預設密碼為「學生編號 + hoyu」。系統只儲存加鹽雜湊，不會保留明文密碼。</li><li>刪除學生帳戶只會移除登入權限；不會刪除學生名單、成績、評估、課題或報告資料；刪除操作會保留審計紀錄。</li></ul></div>

    <AlertDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>批量建立 {unlinkedCandidates.length} 個學生登入帳戶？</AlertDialogTitle><AlertDialogDescription>系統會只為尚未有帳戶的學生編號建立登入。每個帳戶的登入名稱為學生編號，預設密碼為「學生編號 + hoyu」。現有帳戶、密碼、學生名單及成績均不會被改動。</AlertDialogDescription></AlertDialogHeader><div className="max-h-40 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{unlinkedCandidates.slice(0, 30).map(candidate => <p key={candidate.studentNumber}>{candidate.studentNumber} · {candidate.name}</p>)}{unlinkedCandidates.length > 30 && <p className="mt-1 font-semibold">…以及另外 {unlinkedCandidates.length - 30} 人</p>}</div><AlertDialogFooter><AlertDialogCancel disabled={createBatch.isPending}>取消</AlertDialogCancel><AlertDialogAction disabled={createBatch.isPending} onClick={event => { event.preventDefault(); createBatch.mutate({ candidates: unlinkedCandidates.map(candidate => ({ studentNumber: candidate.studentNumber, name: candidate.name, representativeStudentId: candidate.representativeStudentId })) }); }}>{createBatch.isPending ? "建立中…" : `確認建立 ${unlinkedCandidates.length} 個帳戶`}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleteLogin.isPending) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>刪除學生登入帳戶？</AlertDialogTitle><AlertDialogDescription>{deleteTarget ? <>即將刪除 <strong>{deleteTarget.studentNumber || deleteTarget.username}</strong> 的登入帳戶。學生將不能再登入；但學生名單、分數、評估、課題及所有學業資料均不會被刪除。</> : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteLogin.isPending}>取消</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={!deleteTarget || deleteLogin.isPending} onClick={event => { event.preventDefault(); if (deleteTarget) deleteLogin.mutate({ accountId: deleteTarget.id }); }}>{deleteLogin.isPending ? "刪除中…" : "確認刪除登入帳戶"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></div>;
}

import { useData } from "@/contexts/DataContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock3, KeyRound, Loader2, LogIn, RefreshCw, Search, ShieldCheck, UsersRound } from "lucide-react";
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

function TemporaryPasswordStatus({ account }: { account: StudentLoginAccount }) {
  if (!account.mustChangePassword) return <span className="text-xs text-slate-600">學生已自行設定密碼</span>;
  const expiresAt = account.temporaryPasswordExpiresAt ? new Date(account.temporaryPasswordExpiresAt) : null;
  const expired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  return <span className={expired ? "inline-flex items-center gap-1 text-xs font-semibold text-red-700" : "inline-flex items-center gap-1 text-xs font-semibold text-amber-700"}>
    <Clock3 className="h-3.5 w-3.5" />{expired ? "預設密碼已逾期" : `首次登入待處理（至 ${formatDate(expiresAt)}）`}
  </span>;
}

export default function StudentLoginManagement() {
  const { schoolYears, subjects } = useData();
  const utils = trpc.useUtils();
  const { data: accounts, isLoading, error } = trpc.studentLogins.list.useQuery();
  const [search, setSearch] = useState("");
  const [selectedNumber, setSelectedNumber] = useState("");

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
  const linkedCount = candidates.filter(candidate => accountByStudentNumber.has(candidate.studentNumber)).length;
  const unlinkedCount = candidates.length - linkedCount;

  const createLogin = trpc.studentLogins.createByNumber.useMutation({
    onSuccess: async (_result, input) => {
      await utils.studentLogins.list.invalidate();
      setSelectedNumber("");
      toast.success(`已建立學生登入帳戶：${input.studentNumber}；首次密碼為「${input.studentNumber.toLocaleUpperCase()}hoyu」，48 小時內須更改。`);
    },
    onError: err => toast.error(err.message),
  });
  const resetDefaultPassword = trpc.studentLogins.resetDefaultPassword.useMutation({
    onSuccess: async () => {
      await utils.studentLogins.list.invalidate();
      toast.success("已重設為學生編號 + hoyu 的暫用密碼；48 小時內必須更改。");
    },
    onError: err => toast.error(err.message),
  });

  const createSelectedStudentLogin = () => {
    if (!selectedCandidate) return;
    createLogin.mutate({
      studentNumber: selectedCandidate.studentNumber,
      name: selectedCandidate.name,
      representativeStudentId: selectedCandidate.representativeStudentId,
    });
  };

  return <div className="h-full overflow-auto bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2"><UsersRound className="h-6 w-6 text-teal-600" /><h2 className="text-xl font-bold text-slate-900">學生登入管理</h2></div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">每個<strong>學生編號</strong>只會建立一個登入帳戶，即使同一學生出現在不同學年、班別或同科歷史記錄中。帳戶名稱為學生編號；首次暫用密碼為「學生編號 + hoyu」，首次登入後必須更改。</p>
      </div>
      <Badge className="w-fit bg-teal-100 text-teal-800 hover:bg-teal-100">按學生編號跨學年配對</Badge>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">已有學生編號</p><p className="mt-1 text-2xl font-bold text-slate-800">{candidates.length}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">已建立登入</p><p className="mt-1 text-2xl font-bold text-teal-700">{linkedCount}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">尚未建立登入</p><p className="mt-1 text-2xl font-bold text-blue-700">{unlinkedCount}</p></div>
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5"><Label htmlFor="student-login-search">搜尋學生編號或姓名</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="student-login-search" className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setSelectedNumber(""); }} placeholder="例如：20260001、陳大文" /></div></div>
        <div className="min-w-0 flex-[1.6] space-y-1.5"><Label htmlFor="student-login-number">選擇未建立登入的學生編號</Label><select id="student-login-number" value={selectedNumber} onChange={event => setSelectedNumber(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={createLogin.isPending}><option value="">請選擇</option>{filteredCandidates.filter(candidate => !accountByStudentNumber.has(candidate.studentNumber)).map(candidate => <option key={candidate.studentNumber} value={candidate.studentNumber}>{candidate.studentNumber} · {candidate.name} · {candidate.locations.join(" / ")}</option>)}</select></div>
        <Button onClick={createSelectedStudentLogin} disabled={!selectedCandidate || createLogin.isPending} className="bg-teal-600 hover:bg-teal-700">{createLogin.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />建立中…</> : <><LogIn className="h-4 w-4" />建立學生登入</>}</Button>
      </div>
      {selectedCandidate && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900"><p className="font-semibold">即將建立：{selectedCandidate.studentNumber} · {selectedCandidate.name}</p><p className="mt-1">帳戶名稱：<code className="rounded bg-white px-1.5 py-0.5">{selectedCandidate.studentNumber}</code>；首次暫用密碼：<code className="rounded bg-white px-1.5 py-0.5">{selectedCandidate.studentNumber}hoyu</code>。首次登入後必須更改，48 小時後會失效。</p></div>}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">同一編號於不同學年出現時只列為一位學生；這不會改動現有學生名單、成績、評估或學生 ID。沒有學生編號的學生不會出現在本頁，請先在「學生管理」補上編號。</p>
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold text-slate-800">學生登入帳戶</h3><p className="mt-1 text-xs text-slate-500">系統只儲存加鹽密碼雜湊，不會儲存或顯示學生自行更改後的密碼。</p></div>
      {isLoading && <div className="flex justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入學生帳戶中…</div>}
      {error && <div className="p-5 text-sm text-red-600">無法載入學生帳戶：{error.message}</div>}
      {!isLoading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">學生編號／登入帳戶</th><th className="px-4 py-3">學生</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3">密碼狀態</th><th className="px-4 py-3">最近登入</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{(accounts ?? []).length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">尚未建立學生登入帳戶。</td></tr> : (accounts ?? []).map(account => <tr key={account.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><p className="font-mono font-semibold text-teal-800">{account.studentNumber || "舊式記錄"}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{account.username || "—"}</p></td><td className="px-4 py-4 font-medium text-slate-800">{account.name || "未命名"}</td><td className="px-4 py-4">{account.active ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />啟用</span> : <span className="text-slate-500">已停用</span>}</td><td className="px-4 py-4"><TemporaryPasswordStatus account={account} /></td><td className="px-4 py-4 text-xs text-slate-600">{formatDate(account.lastSignedIn)}</td><td className="px-5 py-4 text-right">{account.studentNumber ? <Button variant="outline" size="sm" onClick={() => resetDefaultPassword.mutate({ accountId: account.id })} disabled={resetDefaultPassword.isPending}><RefreshCw className="h-3.5 w-3.5" />重設為編號 + hoyu</Button> : <span className="text-xs text-slate-400">請以學生編號重新建立</span>}</td></tr>)}</tbody></table></div>}
    </section>

    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900"><div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />帳戶安全與配對規則</div><ul className="mt-2 list-disc space-y-1 pl-5"><li>一個學生編號只可有一個學生登入帳戶，並可跨學年對應同一學生。</li><li>預設密碼只在建立／重設時使用，48 小時內首次登入必須更改；其後不再顯示或保留明文密碼。</li><li>所有建立、登入、重設、啟用及停用操作均記錄於教師帳戶頁的操作紀錄。</li></ul></div>
  </div></div>;
}

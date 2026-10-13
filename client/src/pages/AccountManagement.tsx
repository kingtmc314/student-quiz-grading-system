import { trpc } from "@/lib/trpc";
import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Clock3, KeyRound, Link2, Loader2, LockKeyhole, Plus, ShieldCheck, UserCog, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AccountRecord = {
  id: number;
  username: string | null;
  name: string | null;
  role: "user" | "admin" | "teacher" | "student";
  studentId: string | null;
  active: boolean;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type StudentCandidate = { id: string; label: string; searchText: string };

const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" }) : "—";
const passwordHint = "最少 10 個字元";
const roleLabel = (role: AccountRecord["role"]) => ({ admin: "管理員", teacher: "教師", student: "學生", user: "一般" })[role];
const roleClass = (role: AccountRecord["role"]) => role === "admin" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : role === "student" ? "bg-teal-100 text-teal-700 hover:bg-teal-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100";

function TemporaryPasswordStatus({ account }: { account: AccountRecord }) {
  if (!account.mustChangePassword) return <span className="text-xs text-slate-600">已設定</span>;
  const expiresAt = account.temporaryPasswordExpiresAt ? new Date(account.temporaryPasswordExpiresAt) : null;
  const expired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  return <span className={expired ? "inline-flex items-center gap-1 text-xs font-semibold text-red-700" : "inline-flex items-center gap-1 text-xs font-semibold text-amber-700"}>
    <Clock3 className="h-3.5 w-3.5" />{expired ? "暫用密碼已逾期" : `須更改（至 ${formatDate(expiresAt)}）`}
  </span>;
}

export function ChangePasswordDialog({ open, onFinished }: { open: boolean; onFinished: () => void }) {
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const mutation = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      toast.success("密碼已更新");
      setCurrentPassword(""); setNextPassword(""); setConfirmPassword(""); setError("");
      await utils.auth.me.invalidate();
      onFinished();
    },
    onError: err => setError(err.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (nextPassword !== confirmPassword) { setError("新密碼與確認密碼不一致"); return; }
    mutation.mutate({ currentPassword, nextPassword });
  };
  return <Dialog open={open} onOpenChange={value => { if (!value && !mutation.isPending) onFinished(); }}>
    <DialogContent className="sm:max-w-md" showCloseButton={!mutation.isPending}>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-blue-600" />更改密碼</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">這是首次登入或管理員重設的暫用密碼，請於 48 小時內更改。</p>
        {error && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        <div className="space-y-1.5"><Label htmlFor="current-password">現有密碼</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={mutation.isPending} /></div>
        <div className="space-y-1.5"><Label htmlFor="new-password">新密碼</Label><Input id="new-password" type="password" autoComplete="new-password" value={nextPassword} onChange={event => setNextPassword(event.target.value)} placeholder={passwordHint} required disabled={mutation.isPending} /></div>
        <div className="space-y-1.5"><Label htmlFor="confirm-password">確認新密碼</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required disabled={mutation.isPending} /></div>
        <DialogFooter><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />更新中…</> : "儲存新密碼"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export default function AccountManagement() {
  const { schoolYears, subjects } = useData();
  const utils = trpc.useUtils();
  const { data: accounts, isLoading, error } = trpc.accounts.list.useQuery();
  const { data: auditLogs, isLoading: auditLoading } = trpc.accounts.auditLog.useQuery();
  const [createTeacherOpen, setCreateTeacherOpen] = useState(false);
  const [createStudentOpen, setCreateStudentOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AccountRecord | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [formError, setFormError] = useState("");

  const studentCandidates = useMemo<StudentCandidate[]>(() => {
    const subjectById = new Map(subjects.map(subject => [subject.id, subject]));
    const byId = new Map<string, StudentCandidate>();
    schoolYears.forEach(year => year.subjects.forEach(yearSubject => yearSubject.classes.forEach(cls => cls.students.forEach(student => {
      if (byId.has(student.id)) return;
      const subject = subjectById.get(yearSubject.subjectId);
      const displayName = student.nameCht?.trim() || student.name;
      const label = `${displayName} · ${cls.name} · ${student.classNo || "—"}${subject ? ` · ${subject.code}` : ""}`;
      byId.set(student.id, { id: student.id, label, searchText: `${label} ${student.name} ${student.nameCht}`.toLowerCase() });
    }))));
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  }, [schoolYears, subjects]);
  const linkedStudentIds = useMemo(() => new Set((accounts ?? []).map(account => account.studentId).filter(Boolean)), [accounts]);
  const availableStudents = useMemo(() => studentCandidates.filter(candidate => !linkedStudentIds.has(candidate.id) && candidate.searchText.includes(studentSearch.trim().toLowerCase())), [studentCandidates, linkedStudentIds, studentSearch]);
  const chosenStudent = studentCandidates.find(candidate => candidate.id === studentId);

  const refresh = async () => { await Promise.all([utils.accounts.list.invalidate(), utils.accounts.auditLog.invalidate()]); };
  const resetForm = () => { setName(""); setUsername(""); setPassword(""); setStudentId(""); setStudentSearch(""); setFormError(""); };
  const createTeacher = trpc.accounts.createTeacher.useMutation({ onSuccess: async () => { await refresh(); setCreateTeacherOpen(false); resetForm(); toast.success("教師帳戶已建立；暫用密碼 48 小時有效。 "); }, onError: err => setFormError(err.message) });
  const createStudent = trpc.accounts.createStudent.useMutation({ onSuccess: async () => { await refresh(); setCreateStudentOpen(false); resetForm(); toast.success("學生帳戶已建立並安全配對；暫用密碼 48 小時有效。 "); }, onError: err => setFormError(err.message) });
  const resetPassword = trpc.accounts.resetPassword.useMutation({ onSuccess: async () => { await refresh(); setResetTarget(null); setPassword(""); setFormError(""); toast.success("暫用密碼已重設，48 小時後失效。 "); }, onError: err => setFormError(err.message) });
  const setActive = trpc.accounts.setActive.useMutation({ onSuccess: async () => { await refresh(); toast.success("帳戶狀態已更新。 "); }, onError: err => toast.error(err.message) });

  useEffect(() => { if (createTeacherOpen || createStudentOpen || resetTarget) setFormError(""); }, [createTeacherOpen, createStudentOpen, resetTarget]);
  const submitTeacher = (event: FormEvent) => { event.preventDefault(); setFormError(""); createTeacher.mutate({ name, username, password }); };
  const submitStudent = (event: FormEvent) => { event.preventDefault(); setFormError(""); if (!chosenStudent) { setFormError("請從現有學生記錄中選取學生。"); return; } createStudent.mutate({ name: name.trim() || chosenStudent.label.split(" · ")[0], username, password, studentId: chosenStudent.id }); };
  const submitReset = (event: FormEvent) => { event.preventDefault(); if (!resetTarget) return; setFormError(""); resetPassword.mutate({ accountId: resetTarget.id, password }); };

  return <div className="h-full overflow-auto bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">帳戶、學生配對與權限</h2></div><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">管理員可建立教師帳戶，或從現有學生記錄配對一個學生帳戶。每筆學生記錄只可配對一次；不會重建、移動或修改任何既有學生與成績資料。</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { resetForm(); setCreateStudentOpen(true); }}><Link2 className="h-4 w-4" />配對學生帳戶</Button><Button onClick={() => { resetForm(); setCreateTeacherOpen(true); }}><Plus className="h-4 w-4" />新增教師帳戶</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">已配對學生</p><p className="mt-1 text-2xl font-bold text-teal-700">{(accounts ?? []).filter(account => account.role === "student").length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">可配對現有學生</p><p className="mt-1 text-2xl font-bold text-blue-700">{availableStudents.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">暫用密碼待處理</p><p className="mt-1 text-2xl font-bold text-amber-700">{(accounts ?? []).filter(account => account.mustChangePassword).length}</p></div></div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold text-slate-800">帳戶清單</h3><p className="mt-1 text-xs text-slate-500">密碼不會顯示或儲存為明文。首次登入及管理員重設後的暫用密碼均於 48 小時後失效。</p></div>
      {isLoading && <div className="flex justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入帳戶中…</div>}
      {error && <div className="p-5 text-sm text-red-600">無法載入帳戶：{error.message}</div>}
      {!isLoading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">帳戶</th><th className="px-4 py-3">角色</th><th className="px-4 py-3">學生配對</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3">密碼狀態</th><th className="px-4 py-3">最近登入</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{(accounts ?? []).map(account => <tr key={account.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{account.name || "未命名"}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{account.username || "—"}</p></td><td className="px-4 py-4"><Badge className={roleClass(account.role)}>{roleLabel(account.role)}</Badge></td><td className="px-4 py-4">{account.studentId ? <span className="inline-flex items-center gap-1 font-mono text-xs text-teal-700"><Link2 className="h-3.5 w-3.5" />已鎖定</span> : <span className="text-xs text-slate-400">—</span>}</td><td className="px-4 py-4">{account.active ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />啟用</span> : <span className="inline-flex items-center gap-1 text-slate-500"><UserRoundX className="h-4 w-4" />已停用</span>}</td><td className="px-4 py-4"><TemporaryPasswordStatus account={account} /></td><td className="px-4 py-4 text-xs text-slate-600">{formatDate(account.lastSignedIn)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setResetTarget(account); setPassword(""); }}><KeyRound className="h-3.5 w-3.5" />重設密碼</Button><Button variant={account.active ? "outline" : "default"} size="sm" onClick={() => setActive.mutate({ accountId: account.id, active: !account.active })} disabled={setActive.isPending}>{account.active ? <><UserRoundX className="h-3.5 w-3.5" />停用</> : <><UserRoundCheck className="h-3.5 w-3.5" />啟用</>}</Button></div></td></tr>)}</tbody></table></div>}
    </div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-bold text-slate-800">帳戶操作紀錄</h3><p className="mt-1 text-xs text-slate-500">保留最近 100 筆建立、學生配對、重設密碼、登入及啟用／停用事件；不包含密碼或雜湊。</p></div><Badge variant="outline">最近 100 筆</Badge></div>{auditLoading ? <div className="flex justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入紀錄中…</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">時間</th><th className="px-4 py-3">操作者</th><th className="px-4 py-3">目標帳戶</th><th className="px-4 py-3">操作</th><th className="px-5 py-3">摘要</th></tr></thead><tbody className="divide-y divide-slate-100">{(auditLogs ?? []).length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">尚未有帳戶操作紀錄。</td></tr> : (auditLogs ?? []).map(log => <tr key={log.id}><td className="px-5 py-3 text-xs text-slate-600">{formatDate(log.createdAt)}</td><td className="px-4 py-3">{log.actorLabel}</td><td className="px-4 py-3">{log.targetLabel}</td><td className="px-4 py-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{log.action}</code></td><td className="max-w-[280px] truncate px-5 py-3 text-xs text-slate-500">{log.details || "—"}</td></tr>)}</tbody></table></div>}</div>
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">權限與資料保護</p><p className="mt-1 leading-relaxed">管理員可管理帳戶及檢視紀錄；教師不能查看帳戶管理頁。學生帳戶目前只完成安全配對與登入準備，尚未獲得任何教師管理頁、學生檔案或 PDF 匯出存取權。學生專用成績頁須在後端資料列權限完成後才會啟用。</p></div>
  </div>

  <Dialog open={createTeacherOpen} onOpenChange={setCreateTeacherOpen}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-blue-600" />新增教師帳戶</DialogTitle></DialogHeader><form onSubmit={submitTeacher} className="space-y-4">{formError && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}<div className="space-y-1.5"><Label htmlFor="teacher-name">教師名稱</Label><Input id="teacher-name" value={name} onChange={event => setName(event.target.value)} required disabled={createTeacher.isPending} /></div><div className="space-y-1.5"><Label htmlFor="teacher-username">帳戶名稱</Label><Input id="teacher-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="例如：maths.teacher" required disabled={createTeacher.isPending} /><p className="text-xs text-slate-500">只可使用英文字母、數字、.、_ 或 -。</p></div><div className="space-y-1.5"><Label htmlFor="teacher-password">暫用密碼</Label><Input id="teacher-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} required disabled={createTeacher.isPending} /><p className="text-xs text-slate-500">首次登入時必須更改；48 小時後失效。</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateTeacherOpen(false)} disabled={createTeacher.isPending}>取消</Button><Button type="submit" disabled={createTeacher.isPending}>{createTeacher.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />建立中…</> : "建立教師帳戶"}</Button></DialogFooter></form></DialogContent></Dialog>

  <Dialog open={createStudentOpen} onOpenChange={setCreateStudentOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-teal-600" />配對現有學生帳戶</DialogTitle></DialogHeader><form onSubmit={submitStudent} className="space-y-4">{formError && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}<div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-sm leading-relaxed text-teal-900">請由現有學生記錄選取；已配對的學生不會再次出現。系統只鎖定既有學生 ID，不會改動學生名單或任何成績。</div><div className="space-y-1.5"><Label htmlFor="student-search">搜尋現有學生</Label><Input id="student-search" value={studentSearch} onChange={event => { setStudentSearch(event.target.value); setStudentId(""); }} placeholder="輸入姓名、班別、班號或科目" disabled={createStudent.isPending} /></div><div className="space-y-1.5"><Label htmlFor="student-record">選取學生記錄</Label><select id="student-record" value={studentId} onChange={event => { const nextId = event.target.value; setStudentId(nextId); const student = studentCandidates.find(candidate => candidate.id === nextId); if (student && !name) setName(student.label.split(" · ")[0]); }} required disabled={createStudent.isPending} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">請選擇（{availableStudents.length} 位可配對）</option>{availableStudents.map(student => <option key={student.id} value={student.id}>{student.label}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="student-name">帳戶顯示名稱</Label><Input id="student-name" value={name} onChange={event => setName(event.target.value)} placeholder="選取學生後自動填入" required disabled={createStudent.isPending} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="student-username">學生登入名稱</Label><Input id="student-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="例如：s6a01" required disabled={createStudent.isPending} /></div><div className="space-y-1.5"><Label htmlFor="student-password">暫用密碼</Label><Input id="student-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} required disabled={createStudent.isPending} /></div></div><p className="text-xs text-slate-500">暫用密碼首次登入時必須更改，並在 48 小時後失效。</p><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateStudentOpen(false)} disabled={createStudent.isPending}>取消</Button><Button type="submit" disabled={createStudent.isPending || !studentId}>{createStudent.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />配對中…</> : <><Link2 className="h-4 w-4" />建立並配對</>}</Button></DialogFooter></form></DialogContent></Dialog>

  <Dialog open={Boolean(resetTarget)} onOpenChange={open => { if (!open) setResetTarget(null); }}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-blue-600" />重設密碼</DialogTitle></DialogHeader><form onSubmit={submitReset} className="space-y-4"><p className="text-sm text-slate-600">為 <strong>{resetTarget?.name || resetTarget?.username}</strong> 設定新的暫用密碼；帳戶須在 48 小時內登入並更改密碼。</p>{formError && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}<div className="space-y-1.5"><Label htmlFor="reset-password">新暫用密碼</Label><Input id="reset-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} required disabled={resetPassword.isPending} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setResetTarget(null)} disabled={resetPassword.isPending}>取消</Button><Button type="submit" disabled={resetPassword.isPending}>{resetPassword.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />重設中…</> : "重設密碼"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

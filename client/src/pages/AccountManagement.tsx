import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Clock3, KeyRound, Loader2, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AccountRecord = {
  id: number;
  username: string | null;
  name: string | null;
  role: "user" | "admin" | "teacher" | "student";
  active: boolean;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" }) : "—";
const passwordHint = "最少 10 個字元";
const roleLabel = (role: AccountRecord["role"]) => ({ admin: "管理員", teacher: "教師", student: "學生", user: "一般" })[role];
const roleClass = (role: AccountRecord["role"]) => role === "admin" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100";

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
        <div className="space-y-1.5"><Label htmlFor="new-password">新密碼</Label><Input id="new-password" type="password" autoComplete="new-password" value={nextPassword} onChange={event => setNextPassword(event.target.value)} placeholder={passwordHint} minLength={10} required disabled={mutation.isPending} /></div>
        <div className="space-y-1.5"><Label htmlFor="confirm-password">確認新密碼</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} required disabled={mutation.isPending} /></div>
        <DialogFooter><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />更新中…</> : "儲存新密碼"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export default function AccountManagement() {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading, error } = trpc.accounts.list.useQuery();
  const { data: auditLogs, isLoading: auditLoading } = trpc.accounts.auditLog.useQuery();
  const [createTeacherOpen, setCreateTeacherOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AccountRecord | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const staffAccounts = useMemo(() => (accounts ?? []).filter(account => account.role !== "student"), [accounts]);

  const refresh = async () => { await Promise.all([utils.accounts.list.invalidate(), utils.accounts.auditLog.invalidate()]); };
  const resetForm = () => { setName(""); setUsername(""); setPassword(""); setFormError(""); };
  const createTeacher = trpc.accounts.createTeacher.useMutation({
    onSuccess: async () => { await refresh(); setCreateTeacherOpen(false); resetForm(); toast.success("教師帳戶已建立；暫用密碼 48 小時有效。"); },
    onError: err => setFormError(err.message),
  });
  const resetPassword = trpc.accounts.resetPassword.useMutation({
    onSuccess: async () => { await refresh(); setResetTarget(null); setPassword(""); setFormError(""); toast.success("暫用密碼已重設，48 小時後失效。"); },
    onError: err => setFormError(err.message),
  });
  const setActive = trpc.accounts.setActive.useMutation({ onSuccess: async () => { await refresh(); toast.success("帳戶狀態已更新。"); }, onError: err => toast.error(err.message) });

  useEffect(() => { if (createTeacherOpen || resetTarget) setFormError(""); }, [createTeacherOpen, resetTarget]);
  const submitTeacher = (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (name.trim().length === 0 || username.trim().length < 3 || password.length < 10) { setFormError("請填妥姓名、至少 3 個字元的帳戶名稱，以及至少 10 個字元的密碼。"); return; }
    createTeacher.mutate({ name: name.trim(), username: username.trim(), password });
  };
  const submitReset = (event: FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    setFormError("");
    if (password.length < 10) { setFormError("新暫用密碼最少 10 個字元。"); return; }
    resetPassword.mutate({ accountId: resetTarget.id, password });
  };

  return <>
    <div className="h-full overflow-auto bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">教師帳戶及系統安全</h2></div><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">此頁只管理管理員及教師帳戶。學生登入已移至獨立的「學生登入管理」頁，並會以學生編號作為唯一跨學年帳戶身份。</p></div>
        <Button onClick={() => { resetForm(); setCreateTeacherOpen(true); }}><Plus className="h-4 w-4" />新增教師帳戶</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">管理員</p><p className="mt-1 text-2xl font-bold text-violet-700">{staffAccounts.filter(account => account.role === "admin").length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">教師帳戶</p><p className="mt-1 text-2xl font-bold text-blue-700">{staffAccounts.filter(account => account.role === "teacher").length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">暫用密碼待處理</p><p className="mt-1 text-2xl font-bold text-amber-700">{staffAccounts.filter(account => account.mustChangePassword).length}</p></div></div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold text-slate-800">教師及管理員帳戶</h3><p className="mt-1 text-xs text-slate-500">密碼不會顯示或儲存為明文。首次登入及管理員重設後的暫用密碼均於 48 小時後失效。</p></div>
        {isLoading && <div className="flex justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入帳戶中…</div>}
        {error && <div className="p-5 text-sm text-red-600">無法載入帳戶：{error.message}</div>}
        {!isLoading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">帳戶</th><th className="px-4 py-3">角色</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3">密碼狀態</th><th className="px-4 py-3">最近登入</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{staffAccounts.map(account => <tr key={account.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{account.name || "未命名"}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{account.username || "—"}</p></td><td className="px-4 py-4"><Badge className={roleClass(account.role)}>{roleLabel(account.role)}</Badge></td><td className="px-4 py-4">{account.active ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />啟用</span> : <span className="inline-flex items-center gap-1 text-slate-500"><UserRoundX className="h-4 w-4" />已停用</span>}</td><td className="px-4 py-4"><TemporaryPasswordStatus account={account} /></td><td className="px-4 py-4 text-xs text-slate-600">{formatDate(account.lastSignedIn)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setResetTarget(account); setPassword(""); }}><KeyRound className="h-3.5 w-3.5" />重設密碼</Button><Button variant={account.active ? "outline" : "default"} size="sm" onClick={() => setActive.mutate({ accountId: account.id, active: !account.active })} disabled={setActive.isPending}>{account.active ? <><UserRoundX className="h-3.5 w-3.5" />停用</> : <><UserRoundCheck className="h-3.5 w-3.5" />啟用</>}</Button></div></td></tr>)}</tbody></table></div>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-bold text-slate-800">帳戶操作紀錄</h3><p className="mt-1 text-xs text-slate-500">保留最近 100 筆建立、學生登入建立、重設密碼、登入及啟用／停用事件；不包含密碼或雜湊。</p></div><Badge variant="outline">最近 100 筆</Badge></div>{auditLoading ? <div className="flex justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入紀錄中…</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">時間</th><th className="px-4 py-3">操作者</th><th className="px-4 py-3">目標帳戶</th><th className="px-4 py-3">操作</th><th className="px-5 py-3">摘要</th></tr></thead><tbody className="divide-y divide-slate-100">{(auditLogs ?? []).length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">尚未有帳戶操作紀錄。</td></tr> : (auditLogs ?? []).map(log => <tr key={log.id}><td className="px-5 py-3 text-xs text-slate-600">{formatDate(log.createdAt)}</td><td className="px-4 py-3">{log.actorLabel}</td><td className="px-4 py-3">{log.targetLabel}</td><td className="px-4 py-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{log.action}</code></td><td className="max-w-[280px] truncate px-5 py-3 text-xs text-slate-500">{log.details || "—"}</td></tr>)}</tbody></table></div>}</div>
    </div></div>

    <Dialog open={createTeacherOpen} onOpenChange={open => { if (!open && !createTeacher.isPending) { setCreateTeacherOpen(false); resetForm(); } }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!createTeacher.isPending}>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" />新增教師帳戶</DialogTitle><DialogDescription>建立後會顯示在此帳戶清單；教師首次登入後須在 48 小時內更改暫用密碼。</DialogDescription></DialogHeader>
        <form onSubmit={submitTeacher} className="space-y-4">
          {formError && <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}
          <div className="space-y-1.5"><Label htmlFor="teacher-name">教師姓名</Label><Input id="teacher-name" value={name} onChange={event => setName(event.target.value)} placeholder="例如：陳老師" autoComplete="name" required disabled={createTeacher.isPending} /></div>
          <div className="space-y-1.5"><Label htmlFor="teacher-username">帳戶名稱</Label><Input id="teacher-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="例如：maths.chan" autoComplete="username" pattern="[A-Za-z0-9._-]+" minLength={3} required disabled={createTeacher.isPending} /><p className="text-xs text-slate-500">只可使用英文字母、數字、句點、底線或連字號。</p></div>
          <div className="space-y-1.5"><Label htmlFor="teacher-password">暫用密碼</Label><Input id="teacher-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} autoComplete="new-password" minLength={10} required disabled={createTeacher.isPending} /><p className="text-xs text-slate-500">暫用密碼不會以明文儲存，且於建立後 48 小時失效。</p></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => { setCreateTeacherOpen(false); resetForm(); }} disabled={createTeacher.isPending}>取消</Button><Button type="submit" disabled={createTeacher.isPending}>{createTeacher.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />建立中…</> : "建立教師帳戶"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(resetTarget)} onOpenChange={open => { if (!open && !resetPassword.isPending) { setResetTarget(null); setPassword(""); setFormError(""); } }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!resetPassword.isPending}>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-blue-600" />重設教師密碼</DialogTitle><DialogDescription>{resetTarget ? `為「${resetTarget.name || resetTarget.username}」設定新的暫用密碼。` : ""}</DialogDescription></DialogHeader>
        <form onSubmit={submitReset} className="space-y-4">
          {formError && <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}
          <div className="space-y-1.5"><Label htmlFor="reset-password">新暫用密碼</Label><Input id="reset-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} autoComplete="new-password" minLength={10} required disabled={resetPassword.isPending} /><p className="text-xs text-slate-500">重設後有效期為 48 小時，教師必須在首次登入後更改密碼。</p></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => { setResetTarget(null); setPassword(""); setFormError(""); }} disabled={resetPassword.isPending}>取消</Button><Button type="submit" disabled={resetPassword.isPending}>{resetPassword.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />重設中…</> : "儲存暫用密碼"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

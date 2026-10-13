import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, LockKeyhole, Plus, ShieldCheck, UserCog, UserRoundCheck, UserRoundX } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type AccountRecord = {
  id: number;
  username: string | null;
  name: string | null;
  role: "user" | "admin" | "teacher" | "student";
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" }) : "—";
const passwordHint = "最少 10 個字元";

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
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">這是首次登入或管理員重設的帳戶，請先更改暫用密碼。</p>
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
  const utils = trpc.useUtils();
  const { data: accounts, isLoading, error } = trpc.accounts.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AccountRecord | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const refresh = () => utils.accounts.list.invalidate();

  const createTeacher = trpc.accounts.createTeacher.useMutation({ onSuccess: async () => { await refresh(); setCreateOpen(false); setName(""); setUsername(""); setPassword(""); setFormError(""); toast.success("教師帳戶已建立，首次登入時須更改密碼。"); }, onError: err => setFormError(err.message) });
  const resetPassword = trpc.accounts.resetPassword.useMutation({ onSuccess: async () => { await refresh(); setResetTarget(null); setPassword(""); setFormError(""); toast.success("暫用密碼已重設。"); }, onError: err => setFormError(err.message) });
  const setActive = trpc.accounts.setActive.useMutation({ onSuccess: async () => { await refresh(); toast.success("帳戶狀態已更新。"); }, onError: err => toast.error(err.message) });

  useEffect(() => { if (createOpen || resetTarget) setFormError(""); }, [createOpen, resetTarget]);
  const create = (event: FormEvent) => { event.preventDefault(); setFormError(""); createTeacher.mutate({ name, username, password }); };
  const reset = (event: FormEvent) => { event.preventDefault(); if (!resetTarget) return; setFormError(""); resetPassword.mutate({ accountId: resetTarget.id, password }); };

  return <div className="h-full overflow-auto bg-slate-50 p-4 md:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">教師帳戶與權限</h2></div><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">只有管理員可建立、停用或重設教師帳戶。教師帳戶可使用現有所有教學、成績輸入、分析與匯出功能；帳戶不會顯示或儲存明文密碼。</p></div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新增教師帳戶</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold text-slate-800">帳戶清單</h3><p className="mt-1 text-xs text-slate-500">登入名稱不分大小寫；管理員停用後會立即失去存取權限。</p></div>
        {isLoading && <div className="flex justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入帳戶中…</div>}
        {error && <div className="p-5 text-sm text-red-600">無法載入帳戶：{error.message}</div>}
        {!isLoading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">帳戶</th><th className="px-4 py-3">角色</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3">密碼</th><th className="px-4 py-3">最近登入</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{(accounts ?? []).map(account => <tr key={account.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{account.name || "未命名"}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{account.username || "—"}</p></td><td className="px-4 py-4"><Badge className={account.role === "admin" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100"}>{account.role === "admin" ? "管理員" : "教師"}</Badge></td><td className="px-4 py-4">{account.active ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />啟用</span> : <span className="inline-flex items-center gap-1 text-slate-500"><UserRoundX className="h-4 w-4" />已停用</span>}</td><td className="px-4 py-4 text-xs text-slate-600">{account.mustChangePassword ? "首次登入須更改" : "已設定"}</td><td className="px-4 py-4 text-xs text-slate-600">{formatDate(account.lastSignedIn)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setResetTarget(account); setPassword(""); }}><KeyRound className="h-3.5 w-3.5" />重設密碼</Button><Button variant={account.active ? "outline" : "default"} size="sm" onClick={() => setActive.mutate({ accountId: account.id, active: !account.active })} disabled={setActive.isPending}>{account.active ? <><UserRoundX className="h-3.5 w-3.5" />停用</> : <><UserRoundCheck className="h-3.5 w-3.5" />啟用</>}</Button></div></td></tr>)}</tbody></table></div>}
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">本階段權限範圍</p><p className="mt-1 leading-relaxed">管理員：可管理帳戶及使用全部既有功能。教師：可使用全部既有教學功能，但不能新增、停用或重設帳戶。學生的個人成績頁與資料列權限會在教師帳戶流程確認後另行接上。</p></div>
    </div>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-blue-600" />新增教師帳戶</DialogTitle></DialogHeader><form onSubmit={create} className="space-y-4">{formError && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}<div className="space-y-1.5"><Label htmlFor="teacher-name">教師名稱</Label><Input id="teacher-name" value={name} onChange={event => setName(event.target.value)} required disabled={createTeacher.isPending} /></div><div className="space-y-1.5"><Label htmlFor="teacher-username">帳戶名稱</Label><Input id="teacher-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="例如：maths.teacher" required disabled={createTeacher.isPending} /><p className="text-xs text-slate-500">只可使用英文字母、數字、.、_ 或 -。</p></div><div className="space-y-1.5"><Label htmlFor="teacher-password">暫用密碼</Label><Input id="teacher-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} required disabled={createTeacher.isPending} /><p className="text-xs text-slate-500">帳戶首次登入時必須自行更改。</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createTeacher.isPending}>取消</Button><Button type="submit" disabled={createTeacher.isPending}>{createTeacher.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />建立中…</> : "建立教師帳戶"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(resetTarget)} onOpenChange={open => { if (!open) setResetTarget(null); }}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-blue-600" />重設密碼</DialogTitle></DialogHeader><form onSubmit={reset} className="space-y-4"><p className="text-sm text-slate-600">為 <strong>{resetTarget?.name || resetTarget?.username}</strong> 設定新的暫用密碼。該帳戶下次登入時必須更改密碼。</p>{formError && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}<div className="space-y-1.5"><Label htmlFor="reset-password">新暫用密碼</Label><Input id="reset-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={passwordHint} required disabled={resetPassword.isPending} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setResetTarget(null)} disabled={resetPassword.isPending}>取消</Button><Button type="submit" disabled={resetPassword.isPending}>{resetPassword.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />重設中…</> : "重設密碼"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

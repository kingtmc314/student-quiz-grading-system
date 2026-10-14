import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, GraduationCap, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setError("");
      setPassword("");
      await utils.auth.me.invalidate();
    },
    onError: err => setError(err.message || "登入失敗，請稍後再試。"),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    login.mutate({ username, password });
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/40">
        <header className="bg-[#1a2035] px-7 py-7 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">數學成績分析系統</h1>
              <p className="mt-0.5 text-xs text-blue-200">Teacher & Student Login Portal</p>
            </div>
          </div>
        </header>
        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">系統登入</h2>
            <p className="mt-1 text-sm text-slate-500">教師使用管理員派發的帳戶；學生使用學生編號登入。</p>
          </div>
          {error && (
            <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="login-username">帳戶名稱 / Username</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="login-username" autoComplete="username" className="pl-9" value={username} onChange={event => setUsername(event.target.value)} placeholder="例如：maths.teacher 或 20260001" required disabled={login.isPending} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">密碼 / Password</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="login-password" type="password" autoComplete="current-password" className="pl-9" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 10 個字元" required disabled={login.isPending} />
            </div>
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={login.isPending}>
            {login.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />正在驗證…</> : "登入系統"}
          </Button>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs leading-relaxed text-slate-500">學生首次密碼為「學生編號 + hoyu」，須於 48 小時內更改。如遺失密碼，請聯絡系統管理員重設；密碼不會以明文方式儲存。</p>
        </form>
      </section>
    </main>
  );
}

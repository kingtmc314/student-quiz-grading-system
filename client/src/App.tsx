/*
 * App.tsx — Student Maths Performance Analytics v1.0.0
 * Single-page tabbed app (NO routing). All navigation is via tab state.
 * Design: Institutional Clarity — dark navy sidebar (#1a2035), white content
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { I18nProvider } from "./contexts/I18nContext";
import { useAuth } from "./_core/hooks/useAuth";
import { ChangePasswordDialog } from "./pages/AccountManagement";
import LoginPage from "./pages/LoginPage";
import MainApp from "./pages/MainApp";

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /><span className="ml-2 text-sm">正在驗證登入狀態…</span></div>;
  }

  if (!user) return <LoginPage />;

  if (user.role === "student") {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4"><div className="max-w-md rounded-xl border border-teal-200 bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-bold text-slate-900">學生帳戶已完成配對</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">此帳戶已安全連結到學生記錄。學生專用成績頁正在準備後端資料列權限，啟用前不會顯示教師系統或其他學生資料。</p></div></div>;
  }

  if (user.role !== "admin" && user.role !== "teacher") {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4"><div className="max-w-md rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-bold text-slate-900">帳戶尚未獲授權</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">此帳戶暫未有系統權限。請聯絡系統管理員。</p></div></div>;
  }

  return <DataProvider>
    <MainApp />
    <ChangePasswordDialog open={user.mustChangePassword} onFinished={() => undefined} />
  </DataProvider>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <ProtectedApp />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

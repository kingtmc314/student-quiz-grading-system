import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { I18nProvider } from "./contexts/I18nContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import SchoolYears from "./pages/SchoolYears";
import Subjects from "./pages/Subjects";
import Classes from "./pages/Classes";
import Students from "./pages/Students";
import Assessments from "./pages/Assessments";
import MarkSheet from "./pages/MarkSheet";
import Grading from "./pages/Grading";
import Results from "./pages/Results";
import Settings from "./pages/Settings";
import Topics from "./pages/Topics";
import StudentProfile from "./pages/StudentProfile";
import Analysis from "./pages/Analysis";

function Router() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
  return (
    <WouterRouter base={base}>
      <DashboardLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/school-years" component={SchoolYears} />
          <Route path="/school-years/:yearId/subjects" component={Subjects} />
          <Route path="/school-years/:yearId/subjects/:subjectId/topics" component={Topics} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes" component={Classes} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/students" component={Students} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments" component={Assessments} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments/:assessmentId/marksheet" component={MarkSheet} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments/:assessmentId/grading" component={Grading} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments/:assessmentId/results" component={Results} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/students/:studentId/profile" component={StudentProfile} />
          <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/analysis" component={Analysis} />
          <Route path="/settings" component={Settings} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <DataProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </DataProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

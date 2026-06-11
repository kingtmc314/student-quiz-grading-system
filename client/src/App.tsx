import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/school-years" component={SchoolYears} />
        <Route path="/school-years/:yearId/subjects" component={Subjects} />
        <Route path="/school-years/:yearId/subjects/:subjectId/classes" component={Classes} />
        <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/students" component={Students} />
        <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments" component={Assessments} />
        <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments/:assessmentId/marksheet" component={MarkSheet} />
        <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments/:assessmentId/grading" component={Grading} />
        <Route path="/school-years/:yearId/subjects/:subjectId/classes/:classId/assessments/:assessmentId/results" component={Results} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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

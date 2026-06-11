/*
 * App.tsx — Student Maths Performance Analytics v1.0.0
 * Single-page tabbed app (NO routing). All navigation is via tab state.
 * Design: Institutional Clarity — dark navy sidebar (#1a2035), white content
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { I18nProvider } from "./contexts/I18nContext";
import MainApp from "./pages/MainApp";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <DataProvider>
            <TooltipProvider>
              <Toaster />
              <MainApp />
            </TooltipProvider>
          </DataProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

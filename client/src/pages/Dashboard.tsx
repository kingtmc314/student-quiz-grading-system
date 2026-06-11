/* Design: Institutional Clarity — Dashboard overview */
import { Link } from "wouter";
import { CalendarDays, BookOpen, Users, ClipboardList, ArrowRight, GraduationCap } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";

export default function Dashboard() {
  const { schoolYears } = useData();
  const { t } = useI18n();

  const totalSubjects = schoolYears.reduce((s, y) => s + y.subjects.length, 0);
  const totalClasses = schoolYears.reduce((s, y) => s + y.subjects.reduce((ss, sub) => ss + sub.classes.length, 0), 0);
  const totalStudents = schoolYears.reduce((s, y) => s + y.subjects.reduce((ss, sub) => ss + sub.classes.reduce((sss, cls) => sss + cls.students.length, 0), 0), 0);
  const totalAssessments = schoolYears.reduce((s, y) => s + y.subjects.reduce((ss, sub) => ss + sub.classes.reduce((sss, cls) => sss + cls.assessments.length, 0), 0), 0);

  const stats = [
    { label: t("schoolYears"), value: schoolYears.length, icon: CalendarDays, color: "bg-blue-50 text-blue-600 border-blue-100" },
    { label: t("subjects"), value: totalSubjects, icon: BookOpen, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
    { label: t("classes"), value: totalClasses, icon: Users, color: "bg-violet-50 text-violet-600 border-violet-100" },
    { label: t("totalStudents"), value: totalStudents, icon: GraduationCap, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    { label: t("totalAssessments"), value: totalAssessments, icon: ClipboardList, color: "bg-amber-50 text-amber-600 border-amber-100" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome banner */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">{t("welcomeTitle")}</h2>
            <p className="text-blue-100 text-sm">{t("welcomeDesc")}</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-xl border p-4 ${stat.color} flex flex-col gap-2`}>
              <Icon className="w-5 h-5" />
              <div>
                <p className="text-2xl font-bold font-mono">{stat.value}</p>
                <p className="text-xs font-semibold opacity-80 mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* School years list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">{t("schoolYears")}</h3>
          <Link href="/school-years">
            <a className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
              {t("add")} / {t("edit")} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </Link>
        </div>
        {schoolYears.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
            {t("noData")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {schoolYears.map((year) => (
              <Link key={year.id} href={`/school-years/${year.id}/subjects`}>
                <a className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all duration-150 group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-lg font-mono">{year.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {year.subjects.length} {t("subjects")} ·{" "}
                        {year.subjects.reduce((s, sub) => s + sub.classes.length, 0)} {t("classes")}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "wouter";
import { Plus, Trash2, ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";

export default function SchoolYears() {
  const { schoolYears, addSchoolYear, deleteSchoolYear } = useData();
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    addSchoolYear(label);
    setNewLabel("");
    setShowAdd(false);
    toast.success(t("saved"));
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSchoolYear(deleteId);
    setDeleteId(null);
    toast.success(t("deleted"));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("schoolYears")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{schoolYears.length} {t("schoolYears").toLowerCase()}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> {t("addSchoolYear")}
        </Button>
      </div>

      {schoolYears.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">
          {t("noData")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schoolYears.map((year) => (
            <div key={year.id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 font-mono">{year.label}</p>
                <p className="text-xs text-slate-500">
                  {year.subjects.length} {t("subjects")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/school-years/${year.id}/subjects`}>
                  <a className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Link>
                <button
                  onClick={() => setDeleteId(year.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addSchoolYear")}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{t("label")} (e.g. 2526)</label>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="2526"
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={!newLabel.trim()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">{t("deleteConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

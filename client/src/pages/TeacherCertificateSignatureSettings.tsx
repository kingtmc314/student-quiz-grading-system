import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ImageUp, Loader2, PenLine, Save, ShieldCheck, Trash2 } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_IMAGE_BYTES = 1_000_000;

/**
 * Per-account signature configuration for printable class certificates. The image
 * is uploaded to protected object storage by the server; marks and student data
 * are never read or changed here.
 */
export default function TeacherCertificateSignatureSettings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: savedSignature, isLoading, error } = trpc.certificateSignature.mine.useQuery();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signerName, setSignerName] = useState("");
  const [draftImageDataUrl, setDraftImageDataUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && savedSignature !== undefined) {
      setSignerName(savedSignature?.signerName ?? user?.name ?? "");
      setInitialized(true);
    }
  }, [initialized, savedSignature, user?.name]);

  const saveSignature = trpc.certificateSignature.save.useMutation({
    onSuccess: async saved => {
      setSignerName(saved.signerName ?? user?.name ?? "");
      setDraftImageDataUrl(null);
      setRemoveImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await utils.certificateSignature.mine.invalidate();
      toast.success("獎狀簽名設定已儲存");
    },
    onError: err => toast.error(err.message || "未能儲存獎狀簽名設定"),
  });

  const handleImageChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!(file.type === "image/png" || file.type === "image/jpeg")) {
      toast.error("只接受 PNG 或 JPG 簽名圖片。");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("簽名圖片必須小於 1 MB。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error("無法讀取簽名圖片。");
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        toast.error("無法讀取簽名圖片。");
        return;
      }
      setDraftImageDataUrl(reader.result);
      setRemoveImage(false);
    };
    reader.readAsDataURL(file);
  };

  const previewUrl = removeImage ? null : (draftImageDataUrl ?? savedSignature?.signatureUrl ?? null);
  const displayName = signerName.trim() || user?.name || "科任老師";

  if (isLoading) {
    return <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />載入簽名設定中…</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">未能載入獎狀簽名設定：{error.message}</div>;
  }

  return <div className="max-w-3xl space-y-4">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h3 className="font-bold text-amber-900">班級獎狀簽名設定</h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">上傳的簽名圖片只會用於你登入後所匯出的班級獎狀。圖片會安全儲存，系統只記錄其儲存參照；不會更改學生、成績或排行榜資料。</p>
        </div>
      </div>
    </div>

    <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="certificate-signer-name">簽名下方顯示名稱</Label>
          <Input id="certificate-signer-name" value={signerName} onChange={event => setSignerName(event.target.value)} maxLength={160} placeholder={user?.name || "例如：陳老師"} disabled={saveSignature.isPending} />
          <p className="text-xs text-slate-500">留空時，獎狀會顯示目前登入帳戶名稱。</p>
        </div>

        <div className="space-y-2">
          <Label>簽名圖片</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={saveSignature.isPending} className="gap-1.5"><ImageUp className="h-4 w-4" />選擇 PNG / JPG</Button>
            {previewUrl && <Button type="button" variant="outline" onClick={() => { setDraftImageDataUrl(null); setRemoveImage(true); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={saveSignature.isPending} className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />移除圖片</Button>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChosen} />
          <p className="text-xs text-slate-500">建議使用透明背景的橫向簽名圖；PNG 或 JPG，檔案大小少於 1 MB。</p>
        </div>

        <Button type="button" onClick={() => saveSignature.mutate({ signerName: signerName.trim(), imageDataUrl: draftImageDataUrl ?? undefined, clearImage: removeImage })} disabled={saveSignature.isPending} className="gap-1.5">
          {saveSignature.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</> : <><Save className="h-4 w-4" />儲存獎狀簽名設定</>}
        </Button>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">獎狀簽名預覽</p>
        <div className="mt-3 flex min-h-28 items-end justify-center border-b border-slate-400 px-3 pb-2">
          {previewUrl ? <img src={previewUrl} alt="教師簽名預覽" className="max-h-20 max-w-full object-contain" /> : <PenLine className="h-9 w-9 text-slate-300" />}
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-slate-700">{displayName}</p>
        <p className="text-center text-xs text-slate-500">科任老師 / Subject Teacher</p>
      </div>
    </div>
  </div>;
}

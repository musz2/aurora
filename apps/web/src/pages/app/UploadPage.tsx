import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileAudio, Loader2, CheckCircle2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/app/shared";
import { SUPPORTED_UPLOAD_FORMATS } from "@aurora/shared";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export function UploadPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const upload = async (file: File) => {
    setFileName(file.name);
    setError("");
    setPhase("uploading");
    const form = new FormData();
    form.append("file", file);
    form.append("mode", demoMode ? "demo" : "real");
    const isVideo = file.name.toLowerCase().endsWith(".mp4");
    try {
      setPhase("processing");
      const { data } = await api.post(
        isVideo ? "/uploads/video" : "/uploads/audio",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setPhase("done");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setTimeout(() => navigate(`/app/meetings/${data.meeting.id}`), 900);
    } catch (err) {
      setError(apiError(err, "Upload failed"));
      setPhase("error");
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  return (
    <div>
      <PageTitle
        title="Upload a recording"
        subtitle="Import existing audio or video and Aurora will transcribe and summarize it."
      />

      <div className="mx-auto max-w-2xl">
        <Card
          className={`flex flex-col items-center justify-center border-2 border-dashed p-12 text-center transition ${
            drag ? "border-aurora-400 bg-aurora-50/40" : "border-black/10"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
        >
          {phase === "idle" || phase === "error" ? (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-aurora-gradient text-white">
                <UploadCloud className="h-7 w-7" />
              </span>
              <p className="mt-4 font-medium text-ink">
                Drag & drop your file here
              </p>
              <p className="mt-1 text-sm text-muted">
                or click to browse
              </p>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={() => inputRef.current?.click()}
              >
                Choose file
              </Button>
              <label className="mt-4 flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                  className="h-4 w-4 accent-aurora-600"
                />
                Demo sample transcription
              </label>
              <input
                ref={inputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,audio/*,video/mp4"
                className="hidden"
                onChange={onFile}
              />
              <p className="mt-5 text-xs text-muted">
                Supported formats:{" "}
                {SUPPORTED_UPLOAD_FORMATS.map((f) => f.toUpperCase()).join(", ")}
              </p>
              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center">
              {phase === "done" ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              ) : (
                <Loader2 className="h-12 w-12 animate-spin text-aurora-600" />
              )}
              <div className="mt-4 flex items-center gap-2 text-ink">
                <FileAudio className="h-4 w-4" /> {fileName}
              </div>
              <p className="mt-2 text-sm text-muted">
                {phase === "uploading" && "Uploading…"}
                {phase === "processing" &&
                  "Transcribing & generating summary…"}
                {phase === "done" && "Done — opening your meeting…"}
              </p>
            </div>
          )}
        </Card>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUPPORTED_UPLOAD_FORMATS.map((f) => (
            <div
              key={f}
              className="rounded-xl border border-black/[0.06] bg-white p-3 text-center"
            >
              <p className="text-sm font-semibold text-ink">.{f}</p>
              <p className="text-xs text-muted">supported</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

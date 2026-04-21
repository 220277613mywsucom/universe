import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Camera,
  MessageSquareText,
  Sparkles,
  X,
  Loader2,
  Pencil,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "post" | "whisper" | "moment";

/**
 * Floating action button + composer that posts a Photo / Whisper / 24h Moment
 * from anywhere in the app. Shown above the bottom nav on mobile.
 */
export function UnifiedComposer() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("post");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const reset = () => {
    setText("");
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const choose = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "whisper") {
        const t = text.trim();
        if (!t) return toast.error("Say something");
        if (t.length > 280) return toast.error("Max 280 characters");
        const { error } = await supabase
          .from("whispers")
          .insert({ user_id: user.id, content: t });
        if (error) throw error;
        toast.success("Whisper shared");
      } else {
        if (!file) return toast.error("Pick a photo");
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${mode}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        if (mode === "post") {
          const { error } = await supabase.from("posts").insert({
            user_id: user.id,
            image_url: data.publicUrl,
            caption: text.trim() || null,
          });
          if (error) throw error;
          toast.success("Post shared");
        } else {
          const { error } = await supabase.from("moments").insert({
            user_id: user.id,
            image_url: data.publicUrl,
            caption: text.trim() || null,
          });
          if (error) throw error;
          toast.success("Moment shared — visible 24h");
        }
      }
      reset();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to share");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 left-4 z-40 w-14 h-14 rounded-full bg-gold text-gold-foreground shadow-gold flex items-center justify-center hover:scale-105 active:scale-95 transition-smooth"
        aria-label="Create"
        title="Create"
      >
        <Pencil className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[55] bg-primary/70 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl md:rounded-lg shadow-elegant w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl">Create</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(
                [
                  { k: "post" as Mode, label: "Post", icon: Camera },
                  { k: "whisper" as Mode, label: "Whisper", icon: MessageSquareText },
                  { k: "moment" as Mode, label: "Moment", icon: Sparkles },
                ]
              ).map(({ k, label, icon: Icon }) => (
                <button
                  key={k}
                  onClick={() => {
                    setMode(k);
                    if (k === "whisper") {
                      setFile(null);
                      setPreview(null);
                    }
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-smooth",
                    mode === k
                      ? "bg-primary text-primary-foreground shadow-elegant"
                      : "bg-accent/40 text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={mode === "whisper" ? 280 : 500}
              placeholder={
                mode === "whisper"
                  ? "What's on your mind?"
                  : mode === "post"
                    ? "Add a caption…"
                    : "Caption your moment (optional)"
              }
              rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-ring/30"
            />

            {mode !== "whisper" && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => choose(e.target.files?.[0] ?? null)}
                />
                {preview ? (
                  <div className="relative mt-3">
                    <img src={preview} alt="" className="rounded-md max-h-64 w-full object-cover" />
                    <button
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-burgundy text-burgundy-foreground"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="mt-3 w-full py-6 border-2 border-dashed border-border rounded-md text-sm text-muted-foreground hover:bg-accent/30 transition-smooth flex items-center justify-center gap-2"
                  >
                    <ImagePlus className="w-4 h-4" /> Choose a photo
                  </button>
                )}
              </>
            )}

            <div className="mt-4 flex justify-between items-center">
              {mode === "whisper" ? (
                <span className={cn("text-xs", text.length > 260 ? "text-burgundy" : "text-muted-foreground")}>
                  {text.length} / 280
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  {mode === "moment" ? "Visible for 24 hours" : "Posted to your feed"}
                </span>
              )}
              <button
                onClick={submit}
                disabled={busy || (mode !== "whisper" && !file) || (mode === "whisper" && !text.trim())}
                className="px-5 py-2 rounded-md bg-burgundy text-burgundy-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2 shadow-elegant"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

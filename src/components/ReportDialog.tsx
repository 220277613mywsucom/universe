import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag, X } from "lucide-react";

const REASONS = [
  "Spam",
  "Harassment or bullying",
  "Hate speech",
  "Nudity or sexual content",
  "Violence or threats",
  "Self-harm",
  "Misinformation",
  "Impersonation",
  "Other",
];

export function ReportDialog({
  targetType,
  targetId,
  open,
  onClose,
}: {
  targetType: "post" | "whisper" | "moment" | "comment" | "user" | "message";
  targetId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report received. Thank you for keeping UniVerse safe.");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-primary/70 backdrop-blur flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-elegant max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl flex items-center gap-2">
            <Flag className="w-5 h-5 text-burgundy" /> Report
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Tell us what's wrong. Reports are confidential.
        </p>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-md bg-background border border-border text-sm"
        >
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full mb-4 px-3 py-2 rounded-md bg-background border border-border text-sm resize-none"
          placeholder="Add any context that helps us review…"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm hover:bg-accent transition-smooth"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-md text-sm bg-burgundy text-burgundy-foreground hover:opacity-90 disabled:opacity-50 transition-smooth shadow-elegant"
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

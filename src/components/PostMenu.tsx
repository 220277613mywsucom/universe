import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Flag, Ban, Link2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ReportDialog } from "./ReportDialog";

export function PostMenu({
  authorId,
  targetType,
  targetId,
  shareUrl,
  onDelete,
}: {
  authorId: string;
  targetType: "post" | "whisper" | "moment" | "comment" | "message";
  targetId: string;
  shareUrl?: string;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);

  const isOwn = user?.id === authorId;

  const block = async () => {
    if (!user || isOwn) return;
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: user.id, blocked_id: authorId });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success("Blocked. They can no longer reach you.");
    setOpen(false);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
    setOpen(false);
  };

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-card border border-border rounded-md shadow-elegant py-1 text-sm">
            {shareUrl && (
              <button
                onClick={copyLink}
                className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
              >
                <Link2 className="w-3.5 h-3.5" /> Copy link
              </button>
            )}
            {!isOwn && (
              <>
                <button
                  onClick={() => {
                    setReportOpen(true);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                >
                  <Flag className="w-3.5 h-3.5" /> Report
                </button>
                <button
                  onClick={block}
                  className="w-full px-3 py-2 text-left hover:bg-accent text-burgundy flex items-center gap-2"
                >
                  <Ban className="w-3.5 h-3.5" /> Block user
                </button>
              </>
            )}
            {isOwn && onDelete && (
              <button
                onClick={() => {
                  if (confirm("Delete this?")) onDelete();
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-accent text-burgundy flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
      <ReportDialog
        targetType={targetType}
        targetId={targetId}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}

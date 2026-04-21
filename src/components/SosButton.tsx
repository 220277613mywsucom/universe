import { useState } from "react";
import { ShieldAlert, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function SosButton() {
  const { user } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const triggerSos = async () => {
    setBusy(true);
    let lat: number | null = null;
    let lng: number | null = null;

    // best-effort GPS
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no geo"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // continue without coords
    }

    // Check contacts exist
    const { data: contacts } = await supabase
      .from("emergency_contacts")
      .select("id")
      .eq("user_id", user.id);

    if (!contacts || contacts.length === 0) {
      setBusy(false);
      setConfirm(false);
      toast.error("Add emergency contacts first in Safety settings.");
      return;
    }

    const { error } = await supabase.from("sos_alerts").insert({
      user_id: user.id,
      latitude: lat,
      longitude: lng,
      message: "Emergency — I need help.",
    });
    setBusy(false);
    setConfirm(false);
    if (error) return toast.error(error.message);
    toast.success(
      `SOS sent to ${contacts.length} contact${contacts.length > 1 ? "s" : ""}.`,
    );
  };

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        className="fixed bottom-20 md:bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-burgundy text-burgundy-foreground shadow-elegant flex items-center justify-center hover:scale-105 active:scale-95 transition-smooth ring-4 ring-burgundy/20"
        aria-label="Emergency SOS"
        title="Emergency SOS"
      >
        <ShieldAlert className="w-6 h-6" />
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-[70] bg-primary/80 backdrop-blur flex items-center justify-center p-4"
          onClick={() => !busy && setConfirm(false)}
        >
          <div
            className="bg-card border border-burgundy/40 rounded-lg shadow-elegant max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-burgundy/10 mx-auto flex items-center justify-center mb-3">
              <ShieldAlert className="w-7 h-7 text-burgundy" />
            </div>
            <h2 className="font-serif text-xl mb-2">Send Emergency Alert?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Your emergency contacts will be notified immediately with your
              current location.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={triggerSos}
                disabled={busy}
                className="w-full py-3 rounded-md bg-burgundy text-burgundy-foreground font-medium hover:opacity-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-elegant"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                {busy ? "Sending…" : "Send SOS now"}
              </button>
              <Link
                to="/safety"
                onClick={() => setConfirm(false)}
                className="text-xs text-muted-foreground hover:text-burgundy"
              >
                Manage emergency contacts →
              </Link>
              <button
                onClick={() => setConfirm(false)}
                disabled={busy}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 mt-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { loadActiveStayPages } from "@/lib/active-stay-pages";

type ActiveStay = Database["public"]["Tables"]["transactions"]["Row"];
const PAGE_SIZE = 200;

/**
 * Operational occupancy must not rely on the first default-limited page of all
 * historical transactions. Read every RLS-visible check_in row on the server,
 * in stable pages, and fail closed when any page fails.
 */
export function useActiveRoomStays() {
  const [rows, setRows] = useState<ActiveStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const channelId = useId();

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const collected = await loadActiveStayPages<ActiveStay>(async (start, end) =>
        await supabase
          .from("transactions")
          .select("*")
          .eq("status", "check_in")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(start, end),
        PAGE_SIZE,
      );
      if (version === requestVersion.current) {
        setRows(collected);
        setError("");
      }
    } catch (failure) {
      if (version === requestVersion.current) {
        setRows([]);
        setError(failure instanceof Error ? failure.message : "Data hunian aktif tidak tersedia.");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel(`active-stays-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        void refresh();
      })
      // Reconcile the gap between the initial read and Realtime subscription.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      ++requestVersion.current;
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [channelId, refresh]);

  return { rows, loading, error, refresh };
}

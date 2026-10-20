import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrainingStatus =
  "NONE" | "PENDING" | "ACTIVE" | "EXPIRED_PENDING_OWNER" | "PASSED" | "FAILED" | "REVOKED";

export type TrainingContext = {
  status: TrainingStatus;
  is_training: boolean;
  can_transact: boolean;
  assignment_id: string | null;
  trainee_user_id: string | null;
  supervisor_user_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  label: "Training" | null;
  session_id: string | null;
};

export const NO_TRAINING_CONTEXT: TrainingContext = {
  status: "NONE",
  is_training: false,
  can_transact: false,
  assignment_id: null,
  trainee_user_id: null,
  supervisor_user_id: null,
  starts_on: null,
  ends_on: null,
  label: null,
  session_id: null,
};

function parseTrainingContext(value: unknown): TrainingContext {
  if (!value || typeof value !== "object") return NO_TRAINING_CONTEXT;
  const row = value as Record<string, unknown>;
  const status = typeof row["status"] === "string" ? (row["status"] as TrainingStatus) : "NONE";
  return {
    status,
    is_training: row["is_training"] === true,
    can_transact: row["can_transact"] === true,
    assignment_id: typeof row["assignment_id"] === "string" ? row["assignment_id"] : null,
    trainee_user_id: typeof row["trainee_user_id"] === "string" ? row["trainee_user_id"] : null,
    supervisor_user_id:
      typeof row["supervisor_user_id"] === "string" ? row["supervisor_user_id"] : null,
    starts_on: typeof row["starts_on"] === "string" ? row["starts_on"] : null,
    ends_on: typeof row["ends_on"] === "string" ? row["ends_on"] : null,
    label: row["label"] === "Training" ? "Training" : null,
    session_id: typeof row["session_id"] === "string" ? row["session_id"] : null,
  };
}

export async function getTrainingContext(): Promise<TrainingContext> {
  const { data, error } = await supabase.rpc("get_finance_training_context");
  if (error) throw error;
  return parseTrainingContext(data);
}

export function useTrainingContext() {
  const [context, setContext] = useState<TrainingContext>(NO_TRAINING_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void getTrainingContext()
      .then((next) => {
        if (alive) setContext(next);
      })
      .catch((failure: unknown) => {
        if (alive)
          setError(failure instanceof Error ? failure.message : "Status Training gagal dimuat.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { ...context, loading, error };
}

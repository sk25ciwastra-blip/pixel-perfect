import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { selectCashSession } from '@/lib/select-cash-session';

const ACTIVE_SESSION_KEY = 'baturaden25.active_finance_session_id';
export const SESI_KAS_CONTEXT_CHANGED = 'baturaden25:finance-session-context-changed';

export function setSesiKasKonteks(sessionId: string | null) {
  if (typeof window === 'undefined') return;
  if (sessionId) {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } else {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  // sessionStorage's native storage event does not fire in this tab.
  window.dispatchEvent(new Event(SESI_KAS_CONTEXT_CHANGED));
}

function bacaSesiKasKonteks() {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(ACTIVE_SESSION_KEY) ?? '';
}

export function useSesiKasKonteks() {
  const { posisiKode, training } = usePeran();
  const sessions = useTable('finance_cash_sessions');
  const [userId, setUserId] = useState('');
  const [assistedSessionId, setAssistedSessionId] = useState(bacaSesiKasKonteks);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? '');
    });
  }, []);

  useEffect(() => {
    const handleStorage = () => setAssistedSessionId(bacaSesiKasKonteks());
    window.addEventListener('storage', handleStorage);
    window.addEventListener(SESI_KAS_CONTEXT_CHANGED, handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SESI_KAS_CONTEXT_CHANGED, handleStorage);
    };
  }, []);

  const openSessions = useMemo(
    () => sessions.rows.filter((session) => session.status === 'OPEN'),
    [sessions.rows],
  );
  const ownSession = training.is_training
    ? undefined
    : openSessions.find((session) => session.opened_by === userId);
  const isSessionHelper = posisiKode === 'owner' || posisiKode === 'supervisor';
  const assistedSession = isSessionHelper
    ? openSessions.find((session) => session.id === assistedSessionId)
    : undefined;

  // Explicit assistance wins over an Owner/Supervisor's own cash session.
  // If a selected session has closed, never silently shift the cash drawer
  // to another session until the user clears or reselects the context.
  const activeSession = selectCashSession(
    openSessions,
    userId,
    isSessionHelper,
    assistedSessionId,
    training.session_id,
    training.is_training,
  );
  const needsAssistedContext = training.is_training
    ? !trainingSession
    : isSessionHelper && (
      (Boolean(assistedSessionId) && !assistedSession) ||
      (!assistedSessionId && !ownSession && openSessions.length > 1)
    );

  return {
    sessionId: activeSession?.id ?? '',
    activeSession,
    openSessions,
    ownSession,
    assistedSessionId,
    assistedSession,
    isSessionHelper,
    isTraining: training.is_training,
    trainingStatus: training.status,
    trainingSupervisorId: training.supervisor_user_id,
    canOpenSession: !training.is_training,
    needsAssistedContext,
    loading: sessions.loading || !userId,
    error: sessions.error,
  };
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';

const ACTIVE_SESSION_KEY = 'baturaden25.active_finance_session_id';
const SESSION_CONTEXT_CHANGE = 'baturaden25:sesi-kas-konteks';

export function setSesiKasKonteks(sessionId: string | null) {
  if (typeof window === 'undefined') return;
  if (sessionId) {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } else {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  // Native storage events do not fire in the same tab that makes the change.
  window.dispatchEvent(new Event(SESSION_CONTEXT_CHANGE));
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
    const sync = () => setAssistedSessionId(bacaSesiKasKonteks());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_SESSION_KEY || event.key === null) sync();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(SESSION_CONTEXT_CHANGE, sync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SESSION_CONTEXT_CHANGE, sync);
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
  const onlyOpenSession = isSessionHelper && openSessions.length === 1
    ? openSessions[0]
    : undefined;
  const trainingSession = training.is_training && training.session_id
    ? openSessions.find((session) => session.id === training.session_id)
    : undefined;
  // An explicit Owner/Supervisor selection wins over an owned session.
  // If that selection closes, never silently switch the operator to another cash drawer.
  const activeSession = training.is_training
    ? trainingSession
    : isSessionHelper && assistedSessionId
      ? assistedSession
      : ownSession ?? onlyOpenSession;
  const needsAssistedContext = training.is_training
    ? !trainingSession
    : isSessionHelper && !activeSession && (openSessions.length > 0 || Boolean(assistedSessionId));

  return {
    sessionId: activeSession?.id ?? '',
    activeSession,
    openSessions,
    ownSession,
    refreshSessions: sessions.refresh,
    assistedSessionId: isSessionHelper ? assistedSessionId : '',
    selectAssistedSession: (sessionId: string | null) => {
      if (!isSessionHelper || training.is_training) return false;
      if (sessionId && !openSessions.some((session) => session.id === sessionId)) return false;
      setSesiKasKonteks(sessionId);
      return true;
    },
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

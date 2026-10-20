import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';

const ACTIVE_SESSION_KEY = 'baturaden25.active_finance_session_id';

export function setSesiKasKonteks(sessionId: string | null) {
  if (typeof window === 'undefined') return;
  if (sessionId) {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } else {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  }
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
    return () => window.removeEventListener('storage', handleStorage);
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
  const activeSession = training.is_training
    ? trainingSession
    : ownSession ?? assistedSession ?? onlyOpenSession;
  const needsAssistedContext = training.is_training
    ? !trainingSession
    : isSessionHelper && !ownSession && openSessions.length > 1 && !assistedSession;

  return {
    sessionId: activeSession?.id ?? '',
    activeSession,
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

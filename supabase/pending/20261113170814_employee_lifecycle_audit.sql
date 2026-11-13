-- DRAFT / PENDING OWNER REVIEW ONLY. No Cloud execution.
-- Depends on existing role foundation and 20261018 Training enforcement, NOT PR #67.
BEGIN;
DO $preflight$
BEGIN
  IF current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.employees'::regclass)) THEN
    RAISE EXCEPTION 'Migrasi harus memakai trusted owner tabel employees';
  END IF;
  IF to_regprocedure('public.create_finance_training_assignment(uuid,uuid,date)') IS NULL
     OR to_regprocedure('public.resolve_finance_training_assignment(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Fondasi Training existing belum tersedia';
  END IF;
END;
$preflight$;
CREATE TABLE public.employee_lifecycle (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id),
  employment_state text NOT NULL CHECK (employment_state IN ('LEGACY','REGISTERED','ACTIVE','SUSPENDED','ENDED')),
  join_date date,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE public.employee_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  version bigint NOT NULL,
  event text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_on date NOT NULL,
  effective_at timestamptz,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 300),
  previous_state jsonb,
  new_state jsonb NOT NULL,
  UNIQUE(employee_id, version)
);
ALTER TABLE public.employee_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_lifecycle, public.employee_lifecycle_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employee_lifecycle, public.employee_lifecycle_events TO authenticated;

CREATE FUNCTION public.employee_lifecycle_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE;
$$;
CREATE POLICY lifecycle_owner_read ON public.employee_lifecycle FOR SELECT TO authenticated
USING (public.employee_lifecycle_owner());
CREATE POLICY lifecycle_events_owner_read ON public.employee_lifecycle_events FOR SELECT TO authenticated
USING (public.employee_lifecycle_owner());

CREATE FUNCTION public.employee_lifecycle_events_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Riwayat kepegawaian append-only'; END;
$$;
CREATE TRIGGER lifecycle_events_immutable BEFORE UPDATE OR DELETE ON public.employee_lifecycle_events
FOR EACH ROW EXECUTE FUNCTION public.employee_lifecycle_events_immutable();

-- Private writer. Caller must already hold the employee row lock.
CREATE FUNCTION public.append_employee_lifecycle_event(
  _employee_id uuid, _event text, _reason text, _effective_on date,
  _previous jsonb, _new jsonb, _effective_at timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Aktor audit wajib tersedia'; END IF;
  UPDATE public.employee_lifecycle SET version=version+1 WHERE employee_id=_employee_id RETURNING version INTO v;
  IF v IS NULL THEN RAISE EXCEPTION 'Lifecycle belum tersedia'; END IF;
  INSERT INTO public.employee_lifecycle_events(employee_id,version,event,effective_on,effective_at,actor_id,reason,previous_state,new_state)
  VALUES (_employee_id,v,_event,_effective_on,_effective_at,auth.uid(),btrim(_reason),_previous,_new||jsonb_build_object('version',v));
END;
$$;

-- New registrations only. Existing rows are never backfilled or changed on install.
CREATE FUNCTION public.employee_registration_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.employee_lifecycle_owner() IS NOT TRUE THEN RAISE EXCEPTION 'Registrasi membutuhkan Owner terautentikasi'; END IF;
  IF public.has_role(NEW.user_id,'owner') THEN RAISE EXCEPTION 'Akun Owner tidak dikelola melalui lifecycle karyawan'; END IF;
  INSERT INTO public.employee_lifecycle(employee_id,employment_state) VALUES(NEW.id,'REGISTERED');
  UPDATE public.employees SET active=false WHERE id=NEW.id;
  PERFORM public.append_employee_lifecycle_event(NEW.id,'REGISTERED','Registrasi menunggu Training',
    (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,NULL,
    jsonb_build_object('employment_state','REGISTERED','operational_active',false,'join_date',NULL));
  RETURN NEW;
END;
$$;
CREATE TRIGGER employee_registration_lifecycle AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employee_registration_lifecycle();

-- No browser/old manage endpoint can silently toggle active or move identity.
-- Trusted SECURITY DEFINER lifecycle writers run as the employees table owner.
CREATE FUNCTION public.guard_employee_lifecycle_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.employees'::regclass)) THEN
      RAISE EXCEPTION 'Perubahan akses wajib melalui lifecycle teraudit';
    END IF;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND EXISTS(SELECT 1 FROM public.employee_lifecycle WHERE employee_id=OLD.id) THEN
    RAISE EXCEPTION 'Identitas lifecycle tidak dapat dipindahkan';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_employee_lifecycle_write BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_lifecycle_write();

CREATE FUNCTION public.change_employee_lifecycle(
  _employee_id uuid, _event text, _reason text, _expected_version bigint,
  _effective_on date DEFAULT NULL, _join_date date DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e record; s public.employee_lifecycle; before_state jsonb; target text; today date;
BEGIN
  IF public.employee_lifecycle_owner() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  today := (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date;
  IF _expected_version IS NULL OR _expected_version<0 OR _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Versi dan alasan audit wajib valid';
  END IF;
  IF coalesce(_effective_on,today) <> today THEN
    RAISE EXCEPTION 'Tanggal efektif selain hari ini menunggu keputusan Owner';
  END IF;
  SELECT * INTO e FROM public.employees WHERE id=_employee_id FOR UPDATE;
  IF NOT FOUND OR public.has_role(e.user_id,'owner') THEN RAISE EXCEPTION 'Karyawan tidak dapat dikelola'; END IF;
  SELECT * INTO s FROM public.employee_lifecycle WHERE employee_id=_employee_id;
  IF NOT FOUND THEN
    -- Explicit first management action snapshots legacy state, never invents join_date.
    INSERT INTO public.employee_lifecycle(employee_id,employment_state) VALUES(_employee_id,'LEGACY') RETURNING * INTO s;
  END IF;
  IF s.version <> _expected_version THEN RAISE EXCEPTION 'Versi lifecycle berubah; muat ulang'; END IF;
  before_state := to_jsonb(s) || jsonb_build_object('operational_active',e.active);
  target := s.employment_state;
  IF _event='SET_JOIN_DATE' THEN
    IF _join_date IS NULL OR _join_date>today THEN RAISE EXCEPTION 'Tanggal bergabung wajib valid dan tidak di masa depan'; END IF;
    UPDATE public.employee_lifecycle SET join_date=_join_date WHERE employee_id=_employee_id;
  ELSE
    IF _join_date IS NOT NULL THEN RAISE EXCEPTION 'Tanggal bergabung hanya melalui SET_JOIN_DATE'; END IF;
    IF _event='SUSPEND' AND target IN ('LEGACY','REGISTERED','ACTIVE') THEN target:='SUSPENDED';
    ELSIF _event='END_EMPLOYMENT' AND target <> 'ENDED' THEN target:='ENDED';
    ELSIF (_event='ACTIVATE' AND target IN ('REGISTERED','LEGACY')) OR (_event='REACTIVATE' AND target='SUSPENDED') THEN
      IF s.join_date IS NULL OR NOT public.has_role(e.user_id,'employee')
         OR NOT EXISTS(SELECT 1 FROM public.finance_training_assignment_for(e.user_id) a WHERE a.status='PASSED') THEN
        RAISE EXCEPTION 'Aktivasi memerlukan tanggal bergabung, role employee dan kelulusan Training eksplisit';
      END IF;
      target:='ACTIVE';
    ELSE RAISE EXCEPTION 'Transisi lifecycle tidak diizinkan';
    END IF;
    UPDATE public.employee_lifecycle SET employment_state=target WHERE employee_id=_employee_id;
    UPDATE public.employees SET active=(target='ACTIVE') WHERE id=_employee_id;
  END IF;
  SELECT * INTO s FROM public.employee_lifecycle WHERE employee_id=_employee_id;
  PERFORM public.append_employee_lifecycle_event(_employee_id,_event,_reason,
    CASE WHEN _event='SET_JOIN_DATE' THEN _join_date ELSE today END,before_state,
    to_jsonb(s) || jsonb_build_object('operational_active',(SELECT active FROM public.employees WHERE id=_employee_id)),
    CASE WHEN _event='SET_JOIN_DATE' THEN NULL ELSE clock_timestamp() END);
  RETURN s.version+1;
END;
$$;

-- Compatibility restriction bridge, NOT a change to Training assignment status.
-- Also denies existing session mutation by disabled staff after an earlier PASS.
CREATE OR REPLACE FUNCTION public.finance_training_is_restricted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.employees e LEFT JOIN public.employee_lifecycle l ON e.id=l.employee_id
                WHERE e.user_id=_user_id AND NOT public.has_role(_user_id,'owner')
                  AND (NOT e.active OR l.employment_state IN ('REGISTERED','SUSPENDED','ENDED')))
    OR coalesce((SELECT a.status<>'PASSED' FROM public.finance_training_assignments a
                 WHERE a.trainee_user_id=_user_id ORDER BY a.starts_on DESC,a.created_at DESC LIMIT 1),false);
$$;

-- Re-check employee access on every use of an existing Training cash context.
-- No cash owner/operator identities or session records are rewritten.
CREATE OR REPLACE FUNCTION public.finance_training_session_is_valid(_user_id uuid,_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.finance_training_assignments a
    JOIN public.finance_cash_sessions s ON s.id=_session_id AND s.opened_by=a.supervisor_user_id AND s.status='OPEN'
    JOIN public.employees trainee ON trainee.user_id=a.trainee_user_id AND trainee.active
    WHERE a.trainee_user_id=_user_id AND a.status='ACTIVE'
      AND ((now() AT TIME ZONE 'Asia/Jakarta')::date BETWEEN a.starts_on AND a.ends_on)
      AND (public.has_role(a.supervisor_user_id,'owner') OR public.has_employee_position(a.supervisor_user_id,ARRAY['supervisor'::public.employee_position]))
  );
$$;

-- Existing Training RPC authority remains: Owner/Supervisor assign, Owner resolves.
CREATE FUNCTION public.audit_employee_training_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e record; s public.employee_lifecycle; previous jsonb; today date;
BEGIN
  IF auth.uid() IS NULL OR public.finance_training_is_restricted(auth.uid()) THEN RAISE EXCEPTION 'Akses pengelolaan Training ditolak'; END IF;
  IF TG_OP='INSERT' THEN
    IF NOT (public.employee_lifecycle_owner() OR public.has_employee_position(auth.uid(),ARRAY['supervisor'::public.employee_position])) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  ELSIF public.employee_lifecycle_owner() IS NOT TRUE THEN RAISE EXCEPTION 'Kelulusan hanya oleh Owner';
  END IF;
  SELECT * INTO e FROM public.employees WHERE user_id=NEW.trainee_user_id FOR UPDATE;
  IF NOT FOUND OR public.has_role(e.user_id,'owner') THEN RAISE EXCEPTION 'Peserta tidak tersedia'; END IF;
  SELECT * INTO s FROM public.employee_lifecycle WHERE employee_id=e.id;
  IF NOT FOUND THEN
    INSERT INTO public.employee_lifecycle(employee_id,employment_state) VALUES(e.id,'LEGACY') RETURNING * INTO s;
  END IF;
  IF TG_OP='INSERT' AND s.employment_state IN ('SUSPENDED','ENDED') THEN RAISE EXCEPTION 'Akses peserta dinonaktifkan'; END IF;
  previous:=to_jsonb(s)||jsonb_build_object('operational_active',e.active,'training',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END);
  today:=(clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date;
  IF s.employment_state='REGISTERED' THEN
    UPDATE public.employees SET active=(NEW.status='ACTIVE') WHERE id=e.id;
  END IF;
  PERFORM public.append_employee_lifecycle_event(e.id,CASE WHEN TG_OP='INSERT' THEN 'TRAINING_ASSIGNED' ELSE 'TRAINING_RESOLVED' END,
    CASE WHEN TG_OP='INSERT' THEN 'Jadwal Training melalui otoritas existing' ELSE 'Keputusan Training: '||NEW.status END,
    CASE WHEN TG_OP='INSERT' THEN NEW.starts_on ELSE today END,previous,
    to_jsonb(s)||jsonb_build_object('training',to_jsonb(NEW),'operational_active',(SELECT active FROM public.employees WHERE id=e.id)),
    CASE WHEN TG_OP='INSERT' THEN (NEW.starts_on::timestamp AT TIME ZONE 'Asia/Jakarta') ELSE clock_timestamp() END);
  IF TG_OP='INSERT' THEN
    PERFORM public.append_employee_lifecycle_event(e.id,'TRAINING_WINDOW_END_SCHEDULED','Batas jadwal dua hari, bukan kelulusan otomatis',
      NEW.ends_on,NULL,jsonb_build_object('assignment_id',NEW.id,'last_training_day',NEW.ends_on,'automatic_pass',false),
      ((NEW.ends_on+1)::timestamp AT TIME ZONE 'Asia/Jakarta'));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_employee_training_lifecycle AFTER INSERT OR UPDATE OF status ON public.finance_training_assignments
FOR EACH ROW EXECUTE FUNCTION public.audit_employee_training_lifecycle();

CREATE FUNCTION public.prepare_employee_training(_employee_id uuid,_supervisor_user_id uuid,_starts_on date,_expected_version bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e record; s public.employee_lifecycle; assignment_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.finance_training_is_restricted(auth.uid())
    OR NOT (public.employee_lifecycle_owner() OR public.has_employee_position(auth.uid(),ARRAY['supervisor'::public.employee_position])) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO e FROM public.employees WHERE id=_employee_id FOR UPDATE;
  IF NOT FOUND OR public.has_role(e.user_id,'owner') THEN RAISE EXCEPTION 'Peserta tidak tersedia'; END IF;
  SELECT * INTO s FROM public.employee_lifecycle WHERE employee_id=e.id;
  IF NOT FOUND OR s.employment_state NOT IN ('REGISTERED','LEGACY') OR _expected_version IS NULL OR s.version<>_expected_version THEN
    RAISE EXCEPTION 'Lifecycle tidak siap atau versi berubah';
  END IF;
  IF s.employment_state='LEGACY' AND NOT e.active THEN RAISE EXCEPTION 'Akun lama nonaktif memerlukan peninjauan Owner'; END IF;
  IF _starts_on IS NULL THEN RAISE EXCEPTION 'Tanggal Training wajib diisi'; END IF;
  -- Temporary compatibility flag is atomic with assignment creation and its audit.
  PERFORM public.append_employee_lifecycle_event(e.id,'TRAINING_PREPARED','Persiapan kompatibilitas Training, bukan aktivasi operasional',
    (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,to_jsonb(s)||jsonb_build_object('operational_active',e.active),
    to_jsonb(s)||jsonb_build_object('operational_active',true));
  UPDATE public.employees SET active=true WHERE id=e.id;
  SELECT public.create_finance_training_assignment(e.user_id,_supervisor_user_id,_starts_on) INTO assignment_id;
  RETURN assignment_id;
END;
$$;

CREATE FUNCTION public.read_employee_lifecycle(_employee_id uuid,_after_version bigint DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e record; s public.employee_lifecycle; t record; events jsonb; provider_banned boolean;
BEGIN
  IF public.employee_lifecycle_owner() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF _after_version IS NULL OR _after_version<0 THEN RAISE EXCEPTION 'Cursor tidak valid'; END IF;
  SELECT * INTO e FROM public.employees WHERE id=_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Karyawan tidak tersedia'; END IF;
  SELECT * INTO s FROM public.employee_lifecycle WHERE employee_id=e.id;
  SELECT * INTO t FROM public.finance_training_assignment_for(e.user_id);
  SELECT coalesce(banned_until>now(),false) INTO provider_banned FROM auth.users WHERE id=e.user_id;
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.version),'[]'::jsonb) INTO events
  FROM (SELECT * FROM public.employee_lifecycle_events WHERE employee_id=e.id AND version>_after_version ORDER BY version LIMIT 100) page;
  RETURN jsonb_build_object('employee_id',e.id,'lifecycle',to_jsonb(s),
    'account',jsonb_build_object('provider','supabase_auth','banned_now',provider_banned,'operational_compat_active',e.active),
    'training',jsonb_build_object('assignment',to_jsonb(t),'display_status',CASE WHEN t.id IS NULL THEN 'NONE'
      WHEN t.status<>'ACTIVE' THEN t.status WHEN (now() AT TIME ZONE 'Asia/Jakarta')::date<t.starts_on THEN 'PENDING'
      WHEN (now() AT TIME ZONE 'Asia/Jakarta')::date>t.ends_on THEN 'EXPIRED_PENDING_OWNER' ELSE 'ACTIVE' END),
    'events',events,'current_version',coalesce(s.version,0),'has_more',coalesce(s.version,0)>coalesce((events->-1->>'version')::bigint,_after_version));
END;
$$;

REVOKE ALL ON FUNCTION public.employee_lifecycle_owner() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.employee_lifecycle_owner() TO authenticated;
REVOKE ALL ON FUNCTION public.append_employee_lifecycle_event(uuid,text,text,date,jsonb,jsonb,timestamptz),
  public.employee_lifecycle_events_immutable(),public.employee_registration_lifecycle(),public.guard_employee_lifecycle_write(),
  public.audit_employee_training_lifecycle() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.change_employee_lifecycle(uuid,text,text,bigint,date,date),public.prepare_employee_training(uuid,uuid,date,bigint),public.read_employee_lifecycle(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_employee_lifecycle(uuid,text,text,bigint,date,date),public.prepare_employee_training(uuid,uuid,date,bigint),public.read_employee_lifecycle(uuid,bigint) TO authenticated;
-- Keep existing internal helper ACLs; CREATE OR REPLACE preserves them.
COMMIT;

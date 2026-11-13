-- DRAFT only, AFTER PR67 -> PR68 -> PR69. No SMTP/Cloud configuration here.
BEGIN;
DO $$ BEGIN
 IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.employee_enrollment_requests'::regclass)) THEN
  RAISE EXCEPTION 'Migrasi memerlukan trusted owner enrollment';
 END IF;
END $$;
CREATE TABLE public.employee_email_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.employee_enrollment_requests(request_id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  event text NOT NULL CHECK(event IN ('DELIVERY_ATTEMPTED','DELIVERY_SENT','DELIVERY_UNKNOWN','SETUP_AUTH_CONTEXT_CONFIRMED')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX employee_email_audit_once ON public.employee_email_audit(request_id,event);
ALTER TABLE public.employee_email_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_email_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.employee_email_audit TO authenticated;
CREATE POLICY email_audit_creator_owner_read ON public.employee_email_audit FOR SELECT TO authenticated
USING ((SELECT public.can_manage_employee_private_profile()) AND EXISTS(
  SELECT 1 FROM public.employee_enrollment_requests r WHERE r.request_id=employee_email_audit.request_id AND r.actor_id=auth.uid()));
CREATE FUNCTION public.employee_email_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Audit email append-only'; END $$;
CREATE TRIGGER employee_email_audit_immutable BEFORE UPDATE OR DELETE ON public.employee_email_audit
FOR EACH ROW EXECUTE FUNCTION public.employee_email_audit_immutable();

-- Same signature/once-only state machine as PR69, now with atomic actor/time audit.
CREATE OR REPLACE FUNCTION public.claim_employee_setup_delivery(_request_id uuid,_outcome text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.employee_enrollment_requests; action text;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id AND actor_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR r.state<>'COMPLETED' THEN RAISE EXCEPTION 'Enrollment belum selesai'; END IF;
  IF _outcome IS NULL THEN
    IF r.delivery_state<>'NOT_ATTEMPTED' THEN RETURN false; END IF;
    UPDATE public.employee_enrollment_requests SET delivery_state='ATTEMPTED' WHERE request_id=_request_id;
    action:='DELIVERY_ATTEMPTED';
  ELSE
    IF _outcome NOT IN ('SENT','UNKNOWN') OR r.delivery_state<>'ATTEMPTED' THEN RAISE EXCEPTION 'Status delivery tidak valid'; END IF;
    UPDATE public.employee_enrollment_requests SET delivery_state=_outcome WHERE request_id=_request_id;
    action:='DELIVERY_'||_outcome;
  END IF;
  INSERT INTO public.employee_email_audit(request_id,actor_id,event) VALUES(_request_id,auth.uid(),action);
  RETURN true;
END $$;

CREATE FUNCTION public.read_employee_email_status(_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.employee_enrollment_requests; events jsonb;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id AND actor_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak tersedia'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('event',a.event,'actor_id',a.actor_id,'recorded_at',a.recorded_at) ORDER BY a.recorded_at,a.id),'[]'::jsonb)
  INTO events FROM public.employee_email_audit a WHERE a.request_id=_request_id;
  RETURN jsonb_build_object('request_id',r.request_id,'state',r.state,'delivery_state',r.delivery_state,'auto_resend',false,'events',events);
END $$;

-- Auth-only caller's own context: no Owner/operational route requirement, no
-- actor/user/role parameter. Does NOT claim SQL itself verified an OTP token.
CREATE FUNCTION public.confirm_my_employee_setup() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.employee_enrollment_requests; e record;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(),'employee') IS NOT TRUE THEN RAISE EXCEPTION 'Setup tidak tersedia'; END IF;
  SELECT r0.* INTO r FROM public.employee_enrollment_requests r0 JOIN auth.users u ON u.id=r0.auth_user_id
  WHERE u.id=auth.uid() AND r0.state='COMPLETED'
    AND u.raw_app_meta_data->'employee_enrollment'->>'request_id'=r0.request_id::text
    AND u.raw_app_meta_data->'employee_enrollment'->>'actor_id'=r0.actor_id::text;
  IF NOT FOUND OR r.delivery_state NOT IN ('ATTEMPTED','SENT','UNKNOWN') THEN RAISE EXCEPTION 'Setup tidak tersedia'; END IF;
  SELECT e0.id,e0.employee_id,l.employment_state INTO e FROM public.employees e0
  JOIN public.employee_lifecycle l ON l.employee_id=e0.id
  WHERE e0.id=r.employee_id AND e0.user_id=auth.uid();
  IF NOT FOUND OR e.employment_state<>'REGISTERED' THEN RAISE EXCEPTION 'Setup tidak tersedia'; END IF;
  INSERT INTO public.employee_email_audit(request_id,actor_id,event) VALUES(r.request_id,auth.uid(),'SETUP_AUTH_CONTEXT_CONFIRMED')
  ON CONFLICT(request_id,event) DO NOTHING;
  RETURN jsonb_build_object('user_id',auth.uid(),'employee_code',e.employee_id,'employment_state',e.employment_state,'next_step','SET_PASSWORD_ONLY');
END $$;
REVOKE ALL ON FUNCTION public.employee_email_audit_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_employee_setup_delivery(uuid,text),public.read_employee_email_status(uuid),public.confirm_my_employee_setup() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_employee_setup_delivery(uuid,text),public.read_employee_email_status(uuid),public.confirm_my_employee_setup() TO authenticated;
COMMIT;

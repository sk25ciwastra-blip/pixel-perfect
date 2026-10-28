BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.payments') IS NULL OR to_regclass('public.transactions') IS NULL THEN
    RAISE EXCEPTION 'Receipt requires existing transactions/payments';
  END IF;
  IF to_regprocedure('public.finance_is_booking_operator(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Receipt requires approved finance operator authorization';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.receipt_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_kind text NOT NULL CHECK (template_kind IN ('BOOKING','WALK_IN')),
  version integer NOT NULL CHECK (version > 0),
  preset text NOT NULL CHECK (preset IN ('COMPACT','STANDARD','DETAILED','PREMIUM_MINIMAL')),
  language text NOT NULL DEFAULT 'en' CHECK (language = 'en'),
  paper_width_mm numeric(5,2) NOT NULL DEFAULT 58 CHECK (paper_width_mm = 58),
  blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  header_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (template_kind, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS receipt_template_one_active_kind ON public.receipt_template_versions(template_kind) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  receipt_kind text NOT NULL CHECK (receipt_kind IN ('DEPOSIT','PARTIAL_PAYMENT','FINAL_PAYMENT','ADDITIONAL_PAYMENT')),
  template_version_id uuid REFERENCES public.receipt_template_versions(id),
  template_snapshot jsonb NOT NULL,
  receipt_snapshot jsonb NOT NULL,
  payment_amount numeric(12,2) NOT NULL CHECK (payment_amount > 0),
  total_paid_at_issue numeric(12,2) NOT NULL CHECK (total_paid_at_issue >= 0),
  outstanding_at_issue numeric(12,2) NOT NULL CHECK (outstanding_at_issue >= 0),
  payment_status_at_issue text NOT NULL CHECK (payment_status_at_issue IN ('PAID IN FULL','BALANCE DUE')),
  served_by uuid NOT NULL REFERENCES auth.users(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  schema_version integer NOT NULL DEFAULT 1,
  snapshot_hash text
);
CREATE INDEX IF NOT EXISTS payment_receipts_transaction_idx ON public.payment_receipts(transaction_id, issued_at);

CREATE TABLE IF NOT EXISTS public.receipt_print_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts(id),
  print_no integer NOT NULL CHECK (print_no > 0),
  copy_label text NOT NULL DEFAULT '',
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','PRINT_DIALOG_OPENED','CONFIRMED','FAILED','UNKNOWN')),
  idempotency_key uuid NOT NULL UNIQUE,
  printer_target text,
  physical_confirmed_at timestamptz,
  error_code text,
  error_message text,
  UNIQUE (receipt_id, print_no)
);
CREATE INDEX IF NOT EXISTS receipt_print_requests_receipt_idx ON public.receipt_print_requests(receipt_id, print_no);

INSERT INTO public.receipt_template_versions
  (template_kind, version, preset, language, paper_width_mm, blocks, header_config, footer_config, status)
SELECT kind, 1, 'STANDARD', 'en', 58,
  '[{"key":"header","required":true},{"key":"transaction_details","required":true},{"key":"description","required":true},{"key":"payment_history","required":false},{"key":"current_payment","required":true},{"key":"totals","required":true},{"key":"footer","required":true}]'::jsonb,
  '{"title":"Baturaden 25 Homestay","address":"Jl. Baturaden Raya No. 25, Ciwastra","city":"Bandung City","whatsapp":"0811669505"}'::jsonb,
  CASE WHEN kind='BOOKING' THEN '{"thank_you":"Thank you for booking"}'::jsonb ELSE '{"thank_you":"Thank you for your visit"}'::jsonb END,
  'ACTIVE'
FROM (VALUES ('BOOKING'::text),('WALK_IN'::text)) d(kind)
WHERE NOT EXISTS (SELECT 1 FROM public.receipt_template_versions v WHERE v.template_kind=d.kind AND v.status='ACTIVE');

CREATE OR REPLACE FUNCTION public.issue_payment_receipt(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  payment_row record; existing_id uuid; template_row public.receipt_template_versions;
  total_paid numeric(12,2); charge_total numeric(12,2); refund_total numeric(12,2); effective_total numeric(12,2); outstanding numeric(12,2); receipt_kind_value text; v_template_kind text; charge_history jsonb;
  history jsonb; snapshot jsonb; template_snapshot jsonb; v_training_invalid boolean;
BEGIN
  IF NOT public.can_frontdesk(auth.uid()) THEN RAISE EXCEPTION 'Akses receipt ditolak'; END IF;
  SELECT id INTO existing_id FROM public.payment_receipts WHERE payment_id=_payment_id;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  SELECT pay.id, pay.transaction_id, pay.amount, pay.method, pay.kind, pay.created_at, pay.recorded_by, pay.cash_session_id,
         t.transaction_number, t.status, t.price_snapshot, t.scheduled_check_in, t.scheduled_check_out,
         t.started_at, t.ends_at, t.checked_out_at, t.base_price_snapshot, t.guest_count, t.extra_guest_count, t.extra_guest_charge,
         g.full_name AS guest_name, g.phone AS guest_phone, r.room_number, rt.name AS room_type,
         pkg.name AS package_name, e.name AS served_by_name
  INTO payment_row
  FROM public.payments pay
  JOIN public.transactions t ON t.id=pay.transaction_id
  JOIN public.guests g ON g.id=t.guest_id
  LEFT JOIN public.rooms r ON r.id=t.room_id
  LEFT JOIN public.room_types rt ON rt.id=r.room_type_id
  LEFT JOIN public.packages pkg ON pkg.id=t.package_id
  LEFT JOIN public.employees e ON e.user_id=pay.recorded_by
  WHERE pay.id=_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment tidak ditemukan'; END IF;
  IF to_regprocedure('public.finance_training_is_restricted(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.finance_training_is_restricted($1) AND NOT public.finance_training_session_is_valid($1,$2)' INTO v_training_invalid USING auth.uid(), payment_row.cash_session_id;
    IF v_training_invalid THEN RAISE EXCEPTION 'Training receipt wajib memakai sesi kas penanggung jawab'; END IF;
  END IF;
  SELECT COALESCE(SUM(amount),0) INTO total_paid FROM public.payments WHERE transaction_id=payment_row.transaction_id;
  SELECT COALESCE(SUM(amount),0) INTO charge_total FROM public.finance_charge_events WHERE transaction_id=payment_row.transaction_id;
  SELECT COALESCE(SUM(amount),0) INTO refund_total FROM public.finance_refunds WHERE transaction_id=payment_row.transaction_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',c.kind,'amount',c.amount,'created_at',c.created_at) ORDER BY c.created_at,c.id),'[]'::jsonb) INTO charge_history FROM public.finance_charge_events c WHERE c.transaction_id=payment_row.transaction_id;
  effective_total := COALESCE(payment_row.price_snapshot,0) + charge_total;
  outstanding := GREATEST(effective_total - total_paid + refund_total,0);
  receipt_kind_value := CASE WHEN payment_row.kind='dp' THEN 'DEPOSIT' WHEN outstanding=0 THEN 'FINAL_PAYMENT' ELSE 'PARTIAL_PAYMENT' END;
  v_template_kind := CASE WHEN payment_row.scheduled_check_in IS NOT NULL THEN 'BOOKING' ELSE 'WALK_IN' END;
  SELECT v.* INTO template_row FROM public.receipt_template_versions v WHERE v.template_kind=v_template_kind AND v.status='ACTIVE' ORDER BY v.version DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template receipt aktif belum tersedia'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'payment_id', ph.id, 'amount', ph.amount, 'method', ph.method, 'kind', ph.kind,
    'created_at', ph.created_at, 'recorded_by', ph.recorded_by
    ) ORDER BY ph.created_at, ph.id),'[]'::jsonb)
  INTO history
  FROM public.payments ph
  WHERE ph.transaction_id=payment_row.transaction_id
    AND (ph.created_at, ph.id) < (payment_row.created_at, payment_row.id);
  template_snapshot := jsonb_build_object('template_kind',template_row.template_kind,'version',template_row.version,'preset',template_row.preset,'language',template_row.language,'paper_width_mm',template_row.paper_width_mm,'blocks',template_row.blocks,'header',template_row.header_config,'footer',template_row.footer_config);
  snapshot := jsonb_build_object(
    'header', jsonb_build_object('name','Baturaden 25 Homestay','address','Jl. Baturaden Raya No. 25, Ciwastra','city','Bandung City','whatsapp','0811669505'),
    'cash_session_id',payment_row.cash_session_id,'registration_number',payment_row.transaction_number,'payment_reference',payment_row.id,'served_by',jsonb_build_object('user_id',payment_row.recorded_by,'name',payment_row.served_by_name),
    'transaction_type',v_template_kind,'scheduled_check_in',payment_row.scheduled_check_in,'scheduled_check_out',payment_row.scheduled_check_out,
    'actual_check_in',CASE WHEN v_template_kind='WALK_IN' THEN payment_row.started_at ELSE NULL END,
    'actual_check_out',CASE WHEN v_template_kind='WALK_IN' THEN payment_row.checked_out_at ELSE NULL END,
    'guest',jsonb_build_object('name',payment_row.guest_name,'phone',payment_row.guest_phone),'room',jsonb_build_object('number',payment_row.room_number,'type',payment_row.room_type),
    'package',payment_row.package_name,'guest_count',payment_row.guest_count,'extra_guest_count',payment_row.extra_guest_count,'extra_guest_charge',payment_row.extra_guest_charge,
    'base_price',payment_row.base_price_snapshot,'official_charge_total',charge_total,'official_charges',charge_history,'refund_total',refund_total,'total_bill',effective_total,'payment_history',history,
    'current_payment',jsonb_build_object('amount',payment_row.amount,'method',payment_row.method,'kind',receipt_kind_value,'created_at',payment_row.created_at),
    'total_paid',total_paid,'outstanding_balance',outstanding,'payment_status',CASE WHEN outstanding=0 THEN 'PAID IN FULL' ELSE 'BALANCE DUE' END
  );
  INSERT INTO public.payment_receipts(payment_id,transaction_id,receipt_kind,template_version_id,template_snapshot,receipt_snapshot,payment_amount,total_paid_at_issue,outstanding_at_issue,payment_status_at_issue,served_by,snapshot_hash)
  VALUES (_payment_id,payment_row.transaction_id,receipt_kind_value,template_row.id,template_snapshot,snapshot,payment_row.amount,total_paid,outstanding,CASE WHEN outstanding=0 THEN 'PAID IN FULL' ELSE 'BALANCE DUE' END,payment_row.recorded_by,md5(snapshot::text))
  ON CONFLICT (payment_id) DO NOTHING
  RETURNING id INTO existing_id;
  IF existing_id IS NULL THEN SELECT id INTO existing_id FROM public.payment_receipts WHERE payment_id=_payment_id; END IF;
  RETURN existing_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_receipt_print(_receipt_id uuid, _idempotency_key uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r public.payment_receipts; existing public.receipt_print_requests; n integer; result jsonb; v_training_invalid boolean;
BEGIN
  IF NOT public.can_frontdesk(auth.uid()) THEN RAISE EXCEPTION 'Akses print receipt ditolak'; END IF;
  SELECT * INTO r FROM public.payment_receipts WHERE id=_receipt_id FOR UPDATE;
  IF to_regprocedure('public.finance_training_is_restricted(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.finance_training_is_restricted($1) AND NOT public.finance_training_session_is_valid($1,$2)' INTO v_training_invalid USING auth.uid(), NULLIF(r.receipt_snapshot->>'cash_session_id','')::uuid;
    IF v_training_invalid THEN RAISE EXCEPTION 'Training print wajib memakai sesi kas penanggung jawab'; END IF;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt tidak ditemukan'; END IF;
  SELECT * INTO existing FROM public.receipt_print_requests WHERE idempotency_key=_idempotency_key;
  IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('print_request_id',existing.id,'print_no',existing.print_no,'copy_label',existing.copy_label,'receipt_snapshot',r.receipt_snapshot,'template_snapshot',r.template_snapshot); END IF;
  SELECT COALESCE(MAX(print_no),0)+1 INTO n FROM public.receipt_print_requests WHERE receipt_id=_receipt_id;
  INSERT INTO public.receipt_print_requests(receipt_id,print_no,copy_label,requested_by,idempotency_key)
  VALUES (_receipt_id,n,CASE WHEN n=1 THEN '' ELSE 'SALINAN '||(n-1)::text END,auth.uid(),_idempotency_key)
  RETURNING * INTO existing;
  result := jsonb_build_object('print_request_id',existing.id,'print_no',existing.print_no,'copy_label',existing.copy_label,'status',existing.status,'receipt_snapshot',r.receipt_snapshot,'template_snapshot',r.template_snapshot);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_receipt_print_result(_print_request_id uuid, _status text, _error_code text DEFAULT NULL, _error_message text DEFAULT NULL, _physical_confirmed boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF _status NOT IN ('PRINT_DIALOG_OPENED','CONFIRMED','FAILED','UNKNOWN') THEN RAISE EXCEPTION 'Status print tidak valid'; END IF;
  UPDATE public.receipt_print_requests
  SET status=_status, error_code=_error_code, error_message=_error_message,
      physical_confirmed_at=CASE WHEN _physical_confirmed THEN now() ELSE physical_confirmed_at END
  WHERE id=_print_request_id AND requested_by=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Print request tidak ditemukan atau bukan operatornya'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_receipt_template_version(_template_kind text, _preset text, _blocks jsonb, _header_config jsonb, _footer_config jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE new_id uuid; next_version integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengatur template receipt'; END IF;
  IF _template_kind NOT IN ('BOOKING','WALK_IN') OR _preset NOT IN ('COMPACT','STANDARD','DETAILED','PREMIUM_MINIMAL') OR jsonb_typeof(_blocks) <> 'array' THEN RAISE EXCEPTION 'Konfigurasi template tidak valid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_blocks) b WHERE b->>'key'='header') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_blocks) b WHERE b->>'key'='transaction_details') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_blocks) b WHERE b->>'key'='current_payment') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_blocks) b WHERE b->>'key'='totals') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_blocks) b WHERE b->>'key'='footer') THEN
    RAISE EXCEPTION 'Blok wajib receipt tidak boleh dihapus';
  END IF;
  SELECT COALESCE(MAX(version),0)+1 INTO next_version FROM public.receipt_template_versions WHERE template_kind=_template_kind;
  INSERT INTO public.receipt_template_versions(template_kind,version,preset,blocks,header_config,footer_config,created_by)
  VALUES(_template_kind,next_version,_preset,_blocks,COALESCE(_header_config,'{}'::jsonb),COALESCE(_footer_config,'{}'::jsonb),auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_receipt_template_version(_template_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE target_kind text;
BEGIN
  IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengaktifkan template receipt'; END IF;
  SELECT template_kind INTO target_kind FROM public.receipt_template_versions WHERE id=_template_id;
  IF target_kind IS NULL THEN RAISE EXCEPTION 'Template receipt tidak ditemukan'; END IF;
  UPDATE public.receipt_template_versions SET status='RETIRED' WHERE template_kind=target_kind AND status='ACTIVE';
  UPDATE public.receipt_template_versions SET status='ACTIVE', published_at=now() WHERE id=_template_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_receipt_template_version(text,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_receipt_template_version(text,text,jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.activate_receipt_template_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_receipt_template_version(uuid) TO authenticated;
ALTER TABLE public.receipt_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_print_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_templates_read ON public.receipt_template_versions;
CREATE POLICY receipt_templates_read ON public.receipt_template_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'owner') OR status='ACTIVE');
DROP POLICY IF EXISTS payment_receipts_read ON public.payment_receipts;
CREATE POLICY payment_receipts_read ON public.payment_receipts FOR SELECT TO authenticated USING (public.can_frontdesk(auth.uid()));
DROP POLICY IF EXISTS receipt_print_requests_read ON public.receipt_print_requests;
CREATE POLICY receipt_print_requests_read ON public.receipt_print_requests FOR SELECT TO authenticated USING (requested_by=auth.uid() OR public.can_frontdesk(auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.receipt_template_versions, public.payment_receipts, public.receipt_print_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.receipt_template_versions, public.payment_receipts, public.receipt_print_requests TO authenticated;
REVOKE ALL ON FUNCTION public.issue_payment_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_payment_receipt(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.request_receipt_print(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_receipt_print(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_receipt_print_result(uuid,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_receipt_print_result(uuid,text,text,text,boolean) TO authenticated;

DO $receipt_postcheck$
BEGIN
  IF to_regprocedure('public.issue_payment_receipt(uuid)') IS NULL
     OR to_regprocedure('public.request_receipt_print(uuid,uuid)') IS NULL
     OR to_regclass('public.payment_receipts') IS NULL
     OR to_regclass('public.receipt_print_requests') IS NULL THEN
    RAISE EXCEPTION 'Receipt foundation postcheck failed';
  END IF;
END
$receipt_postcheck$;

COMMIT;

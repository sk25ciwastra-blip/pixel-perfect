-- P0-01 READ-ONLY PREFLIGHT
-- Jalankan di database lokal/clone terisolasi. File ini tidak melakukan write.

WITH transaction_numbers AS (
  SELECT
    t.transaction_number,
    t.created_at,
    CASE
      WHEN t.transaction_number ~ '^BTRDTRX-[0-9]+$'
        THEN substring(t.transaction_number FROM '^BTRDTRX-([0-9]+)$')::bigint
      WHEN t.transaction_number ~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$'
        THEN substring(t.transaction_number FROM '^BTRD25-TRX-([0-9]{6})-[0-9]{2}$')::bigint
      WHEN t.transaction_number ~ '^BTRD25-[0-9]{6}$'
        THEN substring(t.transaction_number FROM '^BTRD25-([0-9]{6})$')::bigint
      ELSE NULL
    END AS sequence_value,
    CASE
      WHEN t.transaction_number ~ '^BTRDTRX-[0-9]+$' THEN 'owner_final'
      WHEN t.transaction_number ~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$' THEN 'official_legacy'
      WHEN t.transaction_number ~ '^BTRD25-[0-9]{6}$' THEN 'baseline_legacy'
      ELSE 'unrecognized'
    END AS format_family
  FROM public.transactions t
), housekeeping_numbers AS (
  SELECT
    source_number,
    created_at,
    CASE
      WHEN source_number ~ '^BTRDHK-[0-9]+$'
        THEN substring(source_number FROM '^BTRDHK-([0-9]+)$')::bigint
      WHEN source_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
        THEN substring(source_number FROM '^BTRD25-HK-([0-9]{6})-[0-9]{2}$')::bigint
      ELSE NULL
    END AS sequence_value,
    CASE
      WHEN source_number ~ '^BTRDHK-[0-9]+$' THEN 'owner_final'
      WHEN source_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$' THEN 'official_legacy'
      ELSE 'unrecognized'
    END AS format_family
  FROM (
    SELECT j.job_number AS source_number, j.created_at
    FROM public.housekeeping_jobs j
    UNION ALL
    SELECT h.job_number AS source_number, h.created_at
    FROM public.housekeeping_history h
    WHERE h.job_number IS NOT NULL
  ) numbers
), expense_numbers AS (
  SELECT
    to_jsonb(e)->>'expense_number' AS expense_number,
    e.created_at,
    CASE
      WHEN (to_jsonb(e)->>'expense_number') ~ '^BTRDEXP-[0-9]+$'
        THEN substring(to_jsonb(e)->>'expense_number' FROM '^BTRDEXP-([0-9]+)$')::bigint
      ELSE NULL
    END AS sequence_value,
    CASE
      WHEN (to_jsonb(e)->>'expense_number') ~ '^BTRDEXP-[0-9]+$' THEN 'owner_final'
      WHEN (to_jsonb(e)->>'expense_number') IS NULL THEN 'legacy_without_number'
      ELSE 'unrecognized'
    END AS format_family
  FROM public.finance_expenses e
)
SELECT 'transaction' AS category, format_family, count(*) AS rows,
       max(sequence_value) AS max_sequence,
       CASE WHEN max(sequence_value) IS NULL THEN 1 ELSE max(sequence_value) + 1 END AS safe_next_sequence
FROM transaction_numbers
GROUP BY format_family
UNION ALL
SELECT 'housekeeping', format_family, count(*), max(sequence_value),
       CASE WHEN max(sequence_value) IS NULL THEN 1 ELSE max(sequence_value) + 1 END
FROM housekeeping_numbers
GROUP BY format_family
UNION ALL
SELECT 'expense', format_family, count(*), max(sequence_value),
       CASE WHEN max(sequence_value) IS NULL THEN 1 ELSE max(sequence_value) + 1 END
FROM expense_numbers
GROUP BY format_family
ORDER BY category, format_family;

-- Duplikat dan nomor yang tidak dikenali harus ditinjau sebelum migration.
SELECT 'transaction_duplicate' AS finding, transaction_number AS value, count(*) AS rows
FROM public.transactions
GROUP BY transaction_number
HAVING count(*) > 1
UNION ALL
SELECT 'housekeeping_duplicate', source_number, count(*)
FROM (
  SELECT job_number AS source_number FROM public.housekeeping_jobs
  UNION ALL
  SELECT job_number FROM public.housekeeping_history WHERE job_number IS NOT NULL
) numbers
GROUP BY source_number
HAVING count(*) > 1
UNION ALL
SELECT 'transaction_unrecognized', transaction_number, count(*)
FROM public.transactions
WHERE transaction_number !~ '^BTRDTRX-[0-9]+$'
  AND transaction_number !~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$'
  AND transaction_number !~ '^BTRD25-[0-9]{6}$'
GROUP BY transaction_number
UNION ALL
SELECT 'housekeeping_unrecognized', source_number, count(*)
FROM (
  SELECT job_number AS source_number FROM public.housekeeping_jobs
  UNION ALL
  SELECT job_number FROM public.housekeeping_history WHERE job_number IS NOT NULL
) numbers
WHERE source_number !~ '^BTRDHK-[0-9]+$'
  AND source_number !~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
GROUP BY source_number;

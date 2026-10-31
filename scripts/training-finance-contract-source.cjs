// Static contract guard only. Does not replace PostgreSQL runtime tests.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20261018000000_finance_training_enforcement.sql"),
  "utf8"
);
function fn(name) {
  const escaped = name.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  const start = sql.search(new RegExp("CREATE OR REPLACE FUNCTION public\\." + escaped + "\\s*\\("));
  assert.ok(start >= 0, name + " exists");
  const end = sql.indexOf("$function$;", start);
  assert.ok(end > start, name + " has complete body");
  return sql.slice(start, end);
}

const summary = fn("get_finance_session_summary");
assert.match(summary, /finance_training_is_restricted\(auth\.uid\(\)\)/);
assert.match(summary, /finance_training_context_matches_session\(auth\.uid\(\), _session_id\)/);
assert.match(summary, /AND NOT public\\.finance_training_context_matches_session\\(auth\\.uid\\(\\), _session_id\\)[\\s\\S]*?RAISE EXCEPTION 'Akses sesi ditolak'/);
assert.match(summary, /'expected_cash',\s*s\.opening_cash/);
assert.match(summary, /public\.payments[\s\S]*?method = 'Cash'/);
assert.match(summary, /public\.finance_expenses[\s\S]*?method = 'CASH'/);
assert.match(summary, /public\.finance_refunds[\s\S]*?refund_method = 'CASH'/);
assert.match(summary, /'payments_total'/);

const payment = fn("finance_prepare_payment");
assert.match(payment, /NOT public\.finance_training_is_restricted\(NEW\.recorded_by\)/);
assert.match(payment, /public\.finance_is_owner_or_supervisor\(NEW\.recorded_by\)/);
assert.match(payment, /public\.finance_training_context_matches_session\(/);
assert.match(payment, /NEW\.cash_session_id := selected_session\.id/);

const guard = fn("finance_training_session_guard");
assert.match(guard, /finance_training_is_restricted\(auth\.uid\(\)\)/);
assert.match(guard, /RAISE EXCEPTION 'Peserta Training tidak boleh membuka, mengubah, atau menutup sesi kas'/);
assert.match(sql, /CREATE TRIGGER finance_training_session_guard_trigger[\s\S]*?ON public\.finance_cash_sessions/);

console.log("training-finance-contract-source: PASS (static assertions only)");

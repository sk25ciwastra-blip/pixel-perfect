const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20261018000000_finance_training_enforcement.sql",
  ),
  "utf8",
);

function trainingDayState(startsOn, endsOn, today, status = "ACTIVE") {
  if (status !== "ACTIVE") return status;
  if (today < startsOn) return "PENDING";
  if (today > endsOn) return "EXPIRED_PENDING_OWNER";
  return "ACTIVE";
}

function validTrainingSession({
  status,
  today,
  startsOn,
  endsOn,
  sessionOpen,
  sessionOwner,
  supervisor,
}) {
  return (
    status === "ACTIVE" &&
    today >= startsOn &&
    today <= endsOn &&
    sessionOpen &&
    sessionOwner === supervisor
  );
}

function isRestricted(status) {
  return status !== "PASSED";
}

function canUseMutationPath({
  restricted,
  contextValid,
  sessionOwner,
  assignedSupervisor,
  sessionOpen,
}) {
  return !restricted || (contextValid && sessionOpen && sessionOwner === assignedSupervisor);
}

function auditBinding({
  derivedAssignment,
  requestedAssignment,
  operator,
  authUser,
  sessionOwner,
  assignedSupervisor,
}) {
  return (
    derivedAssignment === requestedAssignment &&
    operator === authUser &&
    sessionOwner === assignedSupervisor
  );
}

assert.equal(trainingDayState("2026-10-20", "2026-10-21", "2026-10-19"), "PENDING");
assert.equal(trainingDayState("2026-10-20", "2026-10-21", "2026-10-20"), "ACTIVE");
assert.equal(trainingDayState("2026-10-20", "2026-10-21", "2026-10-21"), "ACTIVE");
assert.equal(trainingDayState("2026-10-20", "2026-10-21", "2026-10-22"), "EXPIRED_PENDING_OWNER");
assert.equal(trainingDayState("2026-10-20", "2026-10-21", "2026-10-22", "PASSED"), "PASSED");

assert.equal(
  validTrainingSession({
    status: "ACTIVE",
    today: "2026-10-20",
    startsOn: "2026-10-20",
    endsOn: "2026-10-21",
    sessionOpen: true,
    sessionOwner: "supervisor-1",
    supervisor: "supervisor-1",
  }),
  true,
);
assert.equal(
  validTrainingSession({
    status: "ACTIVE",
    today: "2026-10-22",
    startsOn: "2026-10-20",
    endsOn: "2026-10-21",
    sessionOpen: true,
    sessionOwner: "supervisor-1",
    supervisor: "supervisor-1",
  }),
  false,
);
assert.equal(
  validTrainingSession({
    status: "ACTIVE",
    today: "2026-10-20",
    startsOn: "2026-10-20",
    endsOn: "2026-10-21",
    sessionOpen: false,
    sessionOwner: "supervisor-1",
    supervisor: "supervisor-1",
  }),
  false,
);
assert.equal(
  validTrainingSession({
    status: "ACTIVE",
    today: "2026-10-20",
    startsOn: "2026-10-20",
    endsOn: "2026-10-21",
    sessionOpen: true,
    sessionOwner: "owner-1",
    supervisor: "supervisor-1",
  }),
  false,
);

assert.equal(isRestricted("ACTIVE"), true);
assert.equal(isRestricted("EXPIRED_PENDING_OWNER"), true);
assert.equal(isRestricted("FAILED"), true);
assert.equal(isRestricted("REVOKED"), true);
assert.equal(isRestricted("PASSED"), false);

assert.equal(
  canUseMutationPath({
    restricted: true,
    contextValid: false,
    sessionOwner: "trainee-1",
    assignedSupervisor: "supervisor-1",
    sessionOpen: true,
  }),
  false,
);
assert.equal(
  canUseMutationPath({
    restricted: true,
    contextValid: true,
    sessionOwner: "supervisor-1",
    assignedSupervisor: "supervisor-1",
    sessionOpen: true,
  }),
  true,
);
assert.equal(
  canUseMutationPath({
    restricted: true,
    contextValid: true,
    sessionOwner: "supervisor-1",
    assignedSupervisor: "supervisor-1",
    sessionOpen: false,
  }),
  false,
);
assert.equal(
  auditBinding({
    derivedAssignment: "assignment-1",
    requestedAssignment: "assignment-1",
    operator: "trainee-1",
    authUser: "trainee-1",
    sessionOwner: "supervisor-1",
    assignedSupervisor: "supervisor-1",
  }),
  true,
);
assert.equal(
  auditBinding({
    derivedAssignment: "assignment-1",
    requestedAssignment: "assignment-forged",
    operator: "trainee-1",
    authUser: "trainee-1",
    sessionOwner: "supervisor-1",
    assignedSupervisor: "supervisor-1",
  }),
  false,
);

for (const marker of [
  "finance_training_assignments",
  "finance_training_audit",
  "ends_on = starts_on + 1",
  "finance_training_session_is_valid",
  "finance_training_session_guard_trigger",
  "finance_training_transactions_guard_trigger",
  "finance_training_payments_guard_trigger",
  "finance_training_expenses_guard_trigger",
  "finance_training_deposits_guard_trigger",
  "finance_training_forbidden_finance_mutation_guard",
  "finance_training_refunds_guard_trigger",
  "finance_training_context_matches_session",
  "finance_prepare_payment",
  "finance_training_current_user_can_read_session",
  "check_out_training_transaction",
  "get_finance_session_summary",
  "create_training_reservation",
  "record_training_transaction_payment",
  "check_in_training_booking",
  "resolve_finance_training_assignment",
  "label = 'Training'",
  "SECURITY DEFINER",
  "SET search_path = public",
]) {
  assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON public\.finance_cash_sessions/);
assert.doesNotMatch(migration, /app\.finance_training_assignment_id/);

// Prevent a Training migration from revoking the approved Owner/Supervisor
// Bantu Sesi Aktif payment path while enforcing the trainee session binding.
const paymentTrigger = migration.match(
  /CREATE OR REPLACE FUNCTION public\.finance_prepare_payment\(\)[\s\S]*?\$function\$;/,
)?.[0];
assert.ok(paymentTrigger, "finance_prepare_payment trigger must exist");
assert.match(
  paymentTrigger,
  /NOT public\.finance_training_is_restricted\(NEW\.recorded_by\)[\s\S]*?public\.finance_is_owner_or_supervisor\(NEW\.recorded_by\)/,
);
assert.match(
  paymentTrigger,
  /public\.finance_training_context_matches_session\([\s\S]*?auth\.uid\(\), selected_session\.id/,
);

function mayAssistSession({ ownerMatchesOperator, elevated, restrictedTrainee, trainingContext }) {
  return ownerMatchesOperator || (elevated && !restrictedTrainee) || trainingContext;
}
assert.equal(mayAssistSession({ ownerMatchesOperator: true, elevated: false, restrictedTrainee: false, trainingContext: false }), true);
assert.equal(mayAssistSession({ ownerMatchesOperator: false, elevated: true, restrictedTrainee: false, trainingContext: false }), true);
assert.equal(mayAssistSession({ ownerMatchesOperator: false, elevated: false, restrictedTrainee: true, trainingContext: true }), true);
assert.equal(mayAssistSession({ ownerMatchesOperator: false, elevated: false, restrictedTrainee: true, trainingContext: false }), false);
assert.equal(mayAssistSession({ ownerMatchesOperator: false, elevated: false, restrictedTrainee: false, trainingContext: false }), false);

console.log("training-enforcement-pure-tests: PASS");

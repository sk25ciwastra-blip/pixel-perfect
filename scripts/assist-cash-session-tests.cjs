const assert = require("node:assert/strict");
const { selectCashSession } = require("../src/lib/select-cash-session.ts");
const sessions = [
  {id:"reception-a",opened_by:"recep-a",status:"OPEN"},
  {id:"reception-b",opened_by:"recep-b",status:"OPEN"},
  {id:"owner",opened_by:"owner-u",status:"OPEN"},
  {id:"closed",opened_by:"recep-c",status:"FINAL"},
];
const choose=(uid,helper,selected="",trainingId=null,isTraining=false,source=sessions)=>selectCashSession(source,uid,helper,selected,trainingId,isTraining);
assert.equal(choose("owner-u",true,"reception-a")?.id,"reception-a","explicit assist overrides own cash drawer");
assert.equal(choose("owner-u",true)?.id,"owner","own session remains default");
assert.equal(choose("owner-u",true,"closed"),undefined,"closed assistance never falls back own");
assert.equal(choose("owner-u",true,"missing"),undefined,"missing assistance never falls back");
assert.equal(choose("super-u",true,"reception-b")?.id,"reception-b","supervisor assists");
assert.equal(choose("recep-a",false,"reception-b")?.id,"reception-a","receptionist cannot switch drawers");
assert.equal(choose("trainee",false,"reception-b","reception-a",true)?.id,"reception-a","training uses assigned supervisor session");
assert.equal(choose("owner-u",true,"reception-b","reception-a",true)?.id,"reception-a","training cannot override assigned drawer");
assert.equal(choose("super-u",true,"",null,false,[sessions[0]])?.id,"reception-a","one OPEN fallback helper");
assert.equal(choose("super-u",true),undefined,"multiple OPEN no arbitrary fallback");
assert.equal(choose("super-u",true,"reception-a",null,false,[sessions[3]]),undefined,"closed selection rejected");
console.log("PASS cash session selection: dual identity context, explicit assist, CLOSED fail-safe, receptionist/training restrictions, multiple OPEN");

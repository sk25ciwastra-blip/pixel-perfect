#!/usr/bin/env python3
"""Baturaden 25 Homestay — read-only static table ACL migration inventory/gate.

Scope: SQL source under drizzle/migrations and supabase/(migrations,pending).
Historical files are inventory ONLY, never rewritten nor treated as Cloud truth.
Prospective gate: new CREATE TABLE on public requires a same-file transactional
REVOKE TRUNCATE / REVOKE ALL ON TABLE targeting anon and authenticated.

This is an intentionally conservative static heuristic, NOT a full SQL parser
and NOT a replacement for runtime ACL verification or Owner Cloud approval.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCAN_DIRS = ("drizzle/migrations", "supabase/migrations", "supabase/pending")
CREATE = re.compile(
    r'^\s*CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?'
    r'(?:(?P<schema>"?[\w]+"?)\s*\.\s*)?(?P<name>"?[\w]+"?)\s*\(',
    re.IGNORECASE,
)
REVOKE_START = re.compile(r'^\s*REVOKE\s+(?P<privs>ALL|[A-Z_]+(?:\s*,\s*[A-Z_]+)*)'
                          r'\s+ON\s+(?:TABLE\s+)?(?P<objects>.+?)\s+FROM\s+(?P<grantees>.+)$',
                          re.IGNORECASE | re.DOTALL)
TABLENAME = re.compile(r'(?:"?public"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?\s*$', re.IGNORECASE)


def bare_identifier(x: str) -> str:
    return x.strip().strip('"').lower()


def clean_comments(text: str) -> str:
    # Retain newlines, ignore ordinary comments; detect dollar quoted blocks
    # and reject unsafe ambiguous parse cases in new migration gate.
    text = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), text, flags=re.DOTALL)
    text = re.sub(r'--[^\n]*', lambda m: ' '*len(m.group(0)), text)
    return text


def segments(text: str):
    """Split at SQL semicolons outside literal strings/dollar blocks.

    We only need top-level transaction boundaries and REVOKE statements.
    """
    cleaned=clean_comments(text)
    parts=[]
    i=0
    start=0
    quote=None
    dollar=None
    while i<len(cleaned):
        ch=cleaned[i]
        if dollar is not None:
            if cleaned.startswith(dollar,i):
                i+=len(dollar)
                dollar=None
                continue
        elif quote is not None:
            if ch==quote:
                if i+1<len(cleaned) and cleaned[i+1]==quote:
                    i+=2
                    continue
                quote=None
        else:
            if ch in ("'",'"'):
                quote=ch
            elif ch=='$':
                m=re.match(r'\$[A-Za-z0-9_]*\$',cleaned[i:])
                if m:
                    dollar=m.group(0)
                    i+=len(dollar)
                    continue
            elif ch==';':
                parts.append((cleaned[start:i],start,i))
                start=i+1
        i+=1
    if cleaned[start:].strip():
        parts.append((cleaned[start:],start,len(cleaned)))
    return parts


def parse_public_creates(text: str):
    # Conservative: only top-level CREATE TABLE statements; ignore CREATes
    # inside PL/pgSQL bodies. Dynamic SQL must be reviewed manually.
    res=[]
    for stmt,start,end in segments(text):
        m=CREATE.search(stmt)
        if not m: continue
        schema=bare_identifier(m.group("schema") or "public")
        if schema!="public": continue
        res.append({"table":bare_identifier(m.group("name")),
                    "line":text.count("\n",0,start+m.start())+1,
                    "start":start,"end":end})
    return res


def parse_revoke_tables(text: str):
    revokes=[]
    for stmt,start,end in segments(text):
        m=REVOKE_START.match(stmt)
        if not m: continue
        privs={p.strip().upper() for p in m.group("privs").split(",")}
        if not ("ALL" in privs or "TRUNCATE" in privs):continue
        # GRANT/REVOKE on FUNCTION cannot qualify for table ACL guard.
        if re.match(r'^\s*(FUNCTION|SEQUENCE|SCHEMA|DATABASE)\b',
                    m.group("objects"),re.IGNORECASE):
            continue
        grantees={bare_identifier(s) for s in m.group("grantees").split(",")}
        grantees.discard("restrict")
        grantees.discard("cascade")
        tables=[]
        for item in m.group("objects").split(","):
            mm=TABLENAME.match(item.strip())
            if mm: tables.append(mm.group(1).lower())
        if tables:
            revokes.append({"tables":tables, "roles":grantees, "start":start,
                            "end":end})
    return revokes


def evaluate(text: str):
    creates=parse_public_creates(text)
    revokes=parse_revoke_tables(text)
    top=segments(text)
    in_tx=False
    intervals=[]
    for stmt,start,end in top:
        word=stmt.strip().upper()
        if word in ("BEGIN","START TRANSACTION"):
            in_tx=True
            tx_start=end
        if word in ("COMMIT","END") and in_tx:
            intervals.append((tx_start,start))
            in_tx=False
    records=[]
    for create in creates:
        found={"anon":False, "authenticated":False}
        located=False
        for r in revokes:
            if create["table"] not in r["tables"] or r["start"]<=create["start"]:
                continue
            common=any(lo<=create["start"]<r["start"]<=hi
                       for lo,hi in intervals)
            if not common:
                continue
            located=True
            for role in found:
                if role in r["roles"]:
                    found[role]=True
        records.append({
            "table":create["table"],
            "line":create["line"],
            "protected_in_same_transaction":all(found.values()),
            "missing_roles":[r for r,done in found.items() if not done],
            "has_matching_transactional_revoke":located,
        })
    return records


def inventory():
    rows=[]
    total_files=0
    for d in SCAN_DIRS:
        path=ROOT/d
        if not path.exists():continue
        for f in sorted(path.glob("*.sql")):
            total_files+=1
            records=evaluate(f.read_text(encoding="utf-8-sig"))
            for x in records:
                rows.append({"source":str(f.relative_to(ROOT)),
                             "kind":"pending" if d.endswith("pending") else "historical",
                             **x})
    return {"scanned_sql_files":total_files,
            "create_table_definitions":len(rows),
            "protective_revoke_in_same_file_transaction":sum(x["protected_in_same_transaction"] for x in rows),
            "without_detected_explicit_revoke":sum(not x["protected_in_same_transaction"] for x in rows),
            "rows":rows,
            "notice":"Historical migration text is not proof of effective LIVE privileges. "
                     "This scan is static; complex/dynamic SQL requires manual review."}


def tests():
    good="""BEGIN;
CREATE TABLE public.alpha (id int);
REVOKE TRUNCATE ON TABLE public.alpha FROM anon, authenticated;
COMMIT;"""
    assert evaluate(good)[0]["protected_in_same_transaction"]
    split="""BEGIN;
CREATE TABLE public.alpha (id int);
REVOKE TRUNCATE ON TABLE public.alpha FROM anon;
REVOKE TRUNCATE ON TABLE public.alpha FROM authenticated;
COMMIT;"""
    assert evaluate(split)[0]["protected_in_same_transaction"]
    assert not evaluate("CREATE TABLE public.alpha (id int);")[0]["protected_in_same_transaction"]
    badfunc="""BEGIN;
CREATE TABLE public.alpha (id int);
REVOKE ALL ON FUNCTION public.alpha() FROM anon, authenticated;
COMMIT;"""
    assert not evaluate(badfunc)[0]["protected_in_same_transaction"]
    false_positive="""BEGIN;
CREATE TABLE public.alpha (id int);
REVOKE TRUNCATE ON TABLE public.beta FROM anon, authenticated;
COMMIT;"""
    assert not evaluate(false_positive)[0]["protected_in_same_transaction"]
    no_tx="""CREATE TABLE public.alpha (id int);
REVOKE TRUNCATE ON TABLE public.alpha FROM anon, authenticated;"""
    assert not evaluate(no_tx)[0]["protected_in_same_transaction"]
    partial="""BEGIN; CREATE TABLE public.alpha (id int);
REVOKE ALL ON TABLE public.alpha FROM PUBLIC, anon;
COMMIT;"""
    assert not evaluate(partial)[0]["protected_in_same_transaction"]
    done="""BEGIN; CREATE TABLE public.alpha (id int);
REVOKE ALL ON TABLE public.alpha FROM PUBLIC, anon, authenticated;
COMMIT;"""
    assert evaluate(done)[0]["protected_in_same_transaction"]
    multi="""BEGIN; CREATE TABLE public.alpha (id int);
CREATE TABLE public.beta (id int);
REVOKE TRUNCATE ON TABLE public.alpha, public.beta FROM anon, authenticated;
COMMIT;"""
    assert len(evaluate(multi))==2 and all(x["protected_in_same_transaction"] for x in evaluate(multi))
    strings="""-- CREATE TABLE public.fake (id int);
BEGIN; CREATE TABLE public.alpha (id int); REVOKE TRUNCATE ON TABLE public.alpha
FROM anon, authenticated; COMMIT;"""
    assert len(evaluate(strings))==1 and evaluate(strings)[0]["protected_in_same_transaction"]
    print("PASS: 9 static gate cases (including positive, missing, wrong object, no transaction, split roles)",flush=True)


def changes_vs_main():
    # Strict prospective gate: only files newly added or modified compared to
    # origin/main. Historical inventory never blocks the isolated review run.
    base=subprocess.run(["git","diff","--name-only","--diff-filter=AM",
                         "origin/main...HEAD","--",
                         *SCAN_DIRS],text=True,capture_output=True,check=True)
    candidates=[]
    for rel in base.stdout.splitlines():
        path=ROOT/rel
        if path.is_file() and path.suffix.lower()==".sql":
            candidates.append(rel)
    violations=[]
    for rel in candidates:
        for row in evaluate((ROOT/rel).read_text(encoding="utf-8-sig")):
            if not row["protected_in_same_transaction"]:
                violations.append({"file":rel,"table":row["table"],
                                   "line":row["line"],
                                   "missing_roles":row["missing_roles"]})
    return {"candidate_sql_files":candidates,"violations":violations}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--audit-tree",action="store_true")
    parser.add_argument("--gate-changes",action="store_true")
    parser.add_argument("--selftest",action="store_true")
    args=parser.parse_args()
    if args.selftest:tests()
    if args.audit_tree:
        x=inventory()
        print("B25_ACL_MIGRATION_INVENTORY "+json.dumps(x,sort_keys=True),flush=True)
        print("PASS: inventory completed (findings are REVIEW, not Cloud status)",flush=True)
    if args.gate_changes:
        x=changes_vs_main()
        print("B25_ACL_PROSPECTIVE_GATE "+json.dumps(x,sort_keys=True),flush=True)
        if x["violations"]:
            print("BLOCKED: new/changed CREATE TABLE SQL lacks same-transaction API TRUNCATE REVOKE",file=sys.stderr,flush=True)
            sys.exit(1)
        print("PASS: no unsafe new/changed CREATE TABLE migration in review branch",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("BLOCKED: "+str(exc),file=sys.stderr,flush=True)
        sys.exit(1)

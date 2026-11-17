"""Generate review-only patch from pinned fixtures; never contacts a remote app."""
from pathlib import Path
import argparse,difflib
parser=argparse.ArgumentParser();parser.add_argument('--source-root',type=Path,required=True);args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
paths=['src/components/checklist-housekeeping.tsx','src/components/kerangka.tsx','src/lib/data-live.ts','src/lib/sesi-kas.ts','src/routes/housekeeping.tsx','src/routes/index.tsx','src/routes/kamar.tsx','src/lib/checklist-for-ready-job.ts','src/routes/keuangan.tsx']
parts=[]
for path in paths:
 original=root/'scripts/fixtures/lovable-3218bd2'/path
 old=original.read_text() if original.exists() else ''
 new=(args.source_root/path).read_text()
 assert old!=new,path
 parts.append(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+path if old else '/dev/null',tofile='b/'+path)))
(root/'patches/operational-integration-lovable-3218bd2.patch').write_text(''.join(parts))
print('Prepared nine-file pinned-source review patch. No remote action.')

"""Read-only integration gate. Never patches, commits, contacts Lovable or Cloud."""
import argparse,hashlib,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source-root',required=True,type=Path);a=p.parse_args()
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'patches/operational-release-manifest.json').read_text())
fail=[]
for entry in manifest['source_files']:
 target=a.source_root/entry['path']
 actual=hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
 if actual!=entry['sha256']:fail.append(entry['path'])
for entry in manifest['artifacts']:
 if hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()!=entry['sha256']:fail.append(entry['path'])
result=subprocess.run(['git','status','--porcelain','--untracked-files=all'],cwd=a.source_root,capture_output=True,text=True)
if result.returncode or result.stdout.strip():fail.append('source checkout must be clean and tracked')
if fail:
 print('STOP: source or package drift; do not apply:',*fail,sep='\n');raise SystemExit(1)
print('PASS: pinned source paths match pinned bytes, artifacts intact, checkout clean. No patch applied. Owner integration approval still required.')

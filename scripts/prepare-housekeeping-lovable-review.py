"""Build an offline patch against pinned Lovable source. Never contacts Cloud."""
from pathlib import Path
import difflib, subprocess
root=Path(__file__).resolve().parents[1]
fixture=root/'scripts/fixtures/lovable-3218bd2'
paths=['src/components/checklist-housekeeping.tsx','src/lib/data-live.ts','src/routes/kamar.tsx','src/routes/housekeeping.tsx','src/lib/checklist-for-ready-job.ts']
changes=[]
for path in paths:
    old=(fixture/path).read_text() if (fixture/path).exists() else ''
    if path == paths[0]:
        baseline=subprocess.check_output(['git','show','17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1:'+path],cwd=root,text=True)
        assert old.rstrip()==baseline.rstrip(), 'source parity changed: '+path
        new=(root/path).read_text()
    elif path == paths[1]:
        new=old.replace('const refresh = useCallback(async () => {', 'const refresh = useCallback(async (options?: { throwOnError?: boolean }) => {')
        new=new.replace("    setLoading(false);\n  }, [table", "    setLoading(false);\n    if (failure && options?.throwOnError) throw new Error(failure.message);\n  }, [table")
    elif path.endswith('checklist-for-ready-job.ts'):
        new=(root/path).read_text()
    elif path.endswith('kamar.tsx'):
        new="import { checklistForReadyJob } from '@/lib/checklist-for-ready-job';\n"+old
        new=new.replace('    checklist.issue_note.trim(),\n','')
        a=new.index('  const latestChecklist = useMemo('); b=new.index('  const { bagian',a)
        new=new[:a]+new[b:]
        new=new.replace('const checklist = latestChecklist.get(room.id);','const checklist = checklistForReadyJob(housekeepingJob, historyRows, checklistRows);')
    else:
        new=old.replace('''          onSaved={async () => {
            await refreshAll();
          }}''','''          onSaved={async () => {
            await Promise.all([
              rooms.refresh({ throwOnError: true }),
              history.refresh({ throwOnError: true }),
              checklists.refresh({ throwOnError: true }),
            ]);
          }}''')
        marker='      {message && <p role="status"'
        nav='''      <nav aria-label="Bagian Housekeeping" className="hk-tabs">
        {bagianHk.map((b) => (
          <Link key={b.kode} to="/housekeeping" search={{ bagian: b.kode }}
            aria-current={bagian === b.kode ? 'page' : undefined} className="hk-tab">
            <b.ikon aria-hidden="true" /><span>{b.label}</span>
          </Link>
        ))}
      </nav>
'''
        assert marker in new
        new=new.replace(marker,nav+marker,1)
    assert new!=old,path
    changes.append(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+path if old else '/dev/null',tofile='b/'+path)))
(root/'patches/housekeeping-operational-lovable-3218bd2.patch').write_text(''.join(changes))
print('Prepared exact-source five-file offline patch; no remote changes.')

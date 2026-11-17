"""Run native concurrency tests in a new disposable LOCAL cluster; never Cloud."""
import argparse,pathlib,subprocess,tempfile,socket,time,shutil,os
parser=argparse.ArgumentParser();parser.add_argument('--pg-bin',type=pathlib.Path,required=True);parser.add_argument('--test-script',choices=['scripts/overtime-native-concurrency.test.mjs','scripts/housekeeping-native-readiness.test.mjs'],default='scripts/overtime-native-concurrency.test.mjs');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
cluster=pathlib.Path(tempfile.mkdtemp(prefix='b25-native-concurrency-'))
with socket.socket() as reservation:
 reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
server=None
try:
 subprocess.run([str(args.pg_bin/'initdb'),'-D',str(cluster),'--auth=trust','--no-locale','--encoding=UTF8'],check=True,capture_output=True)
 with (cluster/'server.log').open('w') as log:
  server=subprocess.Popen([str(args.pg_bin/'postgres'),'-D',str(cluster),'-h','127.0.0.1','-p',str(port),'-c','unix_socket_directories='],stdout=log,stderr=subprocess.STDOUT)
  for attempt in range(100):
   if server.poll() is not None:raise RuntimeError((cluster/'server.log').read_text())
   try:
    with socket.create_connection(('127.0.0.1',port),timeout=.1):break
   except OSError:time.sleep(.05)
  else:raise RuntimeError('Local fixture failed to start')
  result=subprocess.run(['node',args.test_script],cwd=root,env={**os.environ,'B25_TEST_PORT':str(port),'B25_EXPECTED_DATA_DIRECTORY':str(cluster)})
  raise SystemExit(result.returncode)
finally:
 if server and server.poll() is None:server.terminate();server.wait(timeout=10)
 shutil.rmtree(cluster)

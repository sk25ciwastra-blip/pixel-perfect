// Own disposable native cluster, or explicitly opted-in ephemeral Actions service.
// Never consumes DATABASE_URL, SUPABASE_* or application configuration.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),cp=require('node:child_process'),crypto=require('node:crypto');
const postgres=require('postgres');
const exec=(file,args,options={})=>new Promise((resolve,reject)=>cp.execFile(file,args,{windowsHide:true,timeout:60000,maxBuffer:8*1024*1024,...options},(error,stdout)=>error?reject(Object.assign(Error('NATIVE_TOOL_FAILED'),{code:error.code,tool:path.basename(file)})):resolve(stdout)));
// pg_ctl's server child can retain captured pipes on Windows. Ignore its stdio
// and await the controller exit, while postgres writes only to its own logfile.
const control=(file,args)=>new Promise((resolve,reject)=>{const child=cp.spawn(file,args,{windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Object.assign(Error('NATIVE_CONTROL_FAILED'),{code,tool:path.basename(file)})));});
async function availablePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});});}
async function run(work){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'b25-employee-native-'));
 const bin=process.env.B25_NATIVE_BIN;
 const ci=!bin&&process.env.GITHUB_ACTIONS==='true'&&process.env.B25_NATIVE_DISPOSABLE==='YES';
 if(!bin&&!ci){console.log('NOT REACHED native PostgreSQL: set B25_NATIVE_BIN to existing portable bin, or use scoped disposable Actions service');process.exitCode=2;return;}
 const tool=n=>bin?path.join(bin,n+(process.platform==='win32'?'.exe':'')):n;
 let started=false,admin;const clients=[],created=[];const cluster=path.join(root,'cluster');
 const port=bin?await availablePort():Number(process.env.B25_NATIVE_PORT);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('UNSAFE_TEST_PORT');
 const options={host:'127.0.0.1',port,username:'postgres',password:ci?process.env.B25_NATIVE_PASSWORD:'',ssl:false,max:1,connect_timeout:5,prepare:false,onnotice:()=>{},connection:{application_name:'b25_employee_native_rehearsal'}};
 const open=database=>{const sql=postgres({...options,database});clients.push(sql);return sql;};
 const dbName=()=>`b25_employee_native_${crypto.randomBytes(8).toString('hex')}`;
 try{
  if(bin){
   const version=await exec(tool('postgres'),['--version']);if(!/PostgreSQL\) 17\./.test(version))throw Error('EXPECTED_POSTGRESQL_17');
   await exec(tool('initdb'),['-D',cluster,'-U','postgres','--auth-local=trust','--auth-host=trust','--no-locale','--encoding=UTF8']);
   await control(tool('pg_ctl'),['-D',cluster,'-l',path.join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c max_connections=20 -c shared_buffers=32MB -c log_statement=none -c log_min_error_statement=panic`,'-w','start']);started=true;
  }
  const container=ci?process.env.B25_NATIVE_CONTAINER:undefined;
  let expectedHosts=['127.0.0.1'];
  if(container){
   if(!/^[a-f0-9]{12,64}$/.test(container))throw Error('INVALID_EPHEMERAL_CONTAINER');
   // Docker NAT exposes loopback to the client but inet_server_addr() is the
   // container bridge IP. Verify both against this job's exact service object.
   const network=JSON.parse(await exec('docker',['inspect','--format','{{json .NetworkSettings}}',container]));
   if(!network.Ports?.['5432/tcp']?.some(p=>p.HostIp==='127.0.0.1'&&p.HostPort===String(port)))throw Error('UNSAFE_CONTAINER_PORT_BINDING');
   expectedHosts=Object.values(network.Networks??{}).map(n=>n.IPAddress);
   if(!expectedHosts.length||expectedHosts.some(h=>!net.isIPv4(h)||!(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h))))throw Error('UNSAFE_CONTAINER_NETWORK');
  }
  admin=open('postgres');const info=(await admin.unsafe("SELECT current_setting('server_version_num')::int version,host(inet_server_addr()) host,current_user actor"))[0];
  if(info.version<170000||info.version>=180000||!expectedHosts.includes(info.host)||info.actor!=='postgres')throw Error('UNSAFE_NATIVE_SERVER');
  // The service/cluster must start empty, not a pre-existing application DB.
  if((await admin.unsafe("SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1')")).length)throw Error('SERVER_NOT_DISPOSABLE_EMPTY');
  await admin.unsafe('CREATE ROLE authenticated NOLOGIN;CREATE ROLE anon NOLOGIN;');
  async function database(){const name=dbName();await admin.unsafe(`CREATE DATABASE ${name}`);created.push(name);return {name,sql:open(name)};}
  const childEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG')));
  const artifact={root,tool,exec,open,database,port,env:{...childEnv,PGHOST:'127.0.0.1',PGHOSTADDR:'127.0.0.1',PGPORT:String(port),PGUSER:'postgres',PGPASSWORD:options.password??'',PGPASSFILE:path.join(root,'no-password-file')},version:info.version};
  const inside='/tmp/'+path.basename(root)+'.dump';
  artifact.backup=async(name,file)=>{
   if(container){
    await exec('docker',['exec','-e','PGPASSWORD',container,'pg_dump','-h','127.0.0.1','-U','postgres','-d',name,'-Fc','-f',inside],{env:artifact.env});
    await exec('docker',['cp',container+':'+inside,file],{env:artifact.env});
   }else await exec(tool('pg_dump'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-d',name,'-Fc','-f',file],{env:artifact.env});
  };
  artifact.restore=async(name,file)=>{
   if(container){
    await exec('docker',['cp',file,container+':'+inside],{env:artifact.env});
    await exec('docker',['exec','-e','PGPASSWORD',container,'pg_restore','-h','127.0.0.1','-U','postgres','-d',name,'--exit-on-error',inside],{env:artifact.env});
   }
   else await exec(tool('pg_restore'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-d',name,'--exit-on-error',file],{env:artifact.env});
  };
  await work(artifact);
 }finally{
  let cleanupError,dropped=0;
  await Promise.allSettled(clients.filter(c=>c!==admin).map(c=>c.end({timeout:3})));
  if(admin){
   for(const name of created){try{if(!/^b25_employee_native_[a-f0-9]{16}$/.test(name))throw Error('UNSAFE_CLEANUP');await admin.unsafe(`DROP DATABASE ${name}`);dropped++;}catch(e){cleanupError??=e;}}
   await admin.end({timeout:3}).catch(e=>{cleanupError??=e;});
  }
  if(started)await control(tool('pg_ctl'),['-D',cluster,'-m','fast','-w','stop']).catch(e=>{cleanupError??=e;});
  fs.writeFileSync(path.join(root,'cleanup.json'),JSON.stringify({created:created.length,dropped,ownedClusterStopped:started&&!fs.existsSync(path.join(cluster,'postmaster.pid')),result:cleanupError?'FAIL':'PASS'},null,2));
  console.log('Native artifact directory: '+root);
  if(cleanupError)throw cleanupError;
  console.log('PASS disposable database cleanup'+(started?' and owned cluster shutdown':''));
 }
}
module.exports={run};

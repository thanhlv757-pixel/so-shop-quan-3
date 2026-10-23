import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
const dir=mkdtempSync(join(tmpdir(),'so-shop-test-'));
process.env.DATA_DIR=dir;process.env.SHOP_TEST='1';process.env.SHOP_USERNAME='test';
process.env.NODE_ENV='test';delete process.env.APP_ORIGIN;
const salt='0'.repeat(32);process.env.SHOP_PASSWORD_HASH=salt+':'+scryptSync('test-password-123',salt,64).toString('hex');
const {server}=await import('../server.mjs');
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const {emptyData}=await import('../dist/server/model.mjs');
test('authentication, state CAS, validation, evidence bytes and logout',async()=>{
 try{
  assert.equal((await fetch(url+'/api/state')).status,401);
  assert.equal((await fetch(url+'/',{redirect:'manual'})).status,303);
  assert.equal((await fetch(url+'/login',{method:'POST',headers:{origin:'https://evil.test'},body:''})).status,403);
  const login=await fetch(url+'/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'username=test&password=test-password-123',redirect:'manual'});
  assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];const headers={cookie};
  assert.equal((await fetch(url+'/',{headers})).status,200);
  assert.equal((await (await fetch(url+'/api/state',{headers})).json()).revision,0);
  const data=emptyData();const put=(revision,d=data)=>fetch(url+'/api/state',{method:'PUT',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({revision,data:d})});
  assert.equal((await put(0)).status,200);assert.equal((await put(0)).status,409);
  assert.equal((await put(1,{schemaVersion:8})).status,400);
  const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
  const form=new FormData();form.set('file',new File([png],'proof.png',{type:'image/png'}));
  const upload=await fetch(url+'/api/evidence',{method:'POST',headers,body:form});assert.equal(upload.status,201);const photo=await upload.json();
  const read=await fetch(url+'/api/evidence/'+photo.id,{headers});assert.equal(read.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await read.arrayBuffer()),png);
  assert.equal((await fetch(url+'/api/evidence/'+photo.id)).status,401);
  const invalid=new FormData();invalid.set('file',new File(['hello'],'bad.jpg'));assert.equal((await fetch(url+'/api/evidence',{method:'POST',headers,body:invalid})).status,400);
  assert.equal((await put(1)).status,200);assert.equal((await put(1)).status,409);
  await fetch(url+'/logout',{method:'POST',headers,redirect:'manual'});assert.equal((await fetch(url+'/api/state',{headers})).status,401);
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true})}
});

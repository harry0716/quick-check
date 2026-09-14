import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../collector/cloudflare/worker.mjs';
function harness(){
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../collector/cloudflare/schema.sql',import.meta.url),'utf8'));
  const env={TEACHER_KEY:'test-only',ALLOWED_ORIGINS:'https://harry0716.github.io',DB:{prepare(sql){
    return {bind(...args){ const s=db.prepare(sql);return {
      async run(){return {meta:s.run(...args)};},async first(){return s.get(...args);},async all(){return {results:s.all(...args)};}
    };}};
  }}};
  const post=(p,key='',origin=env.ALLOWED_ORIGINS)=>worker.fetch(new Request('https://test.invalid/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:key},body:JSON.stringify(p)}),env);
  return {db,post};
}
const sample={bank:'cchs-ipas-2026',bankTitle:'Course',set:'w01',setLabel:'W01',mode:'practice',assessment:'class',attempt:'test-attempt-001',cls:'TEST',seat:'00',name:'測試',total:2,score:1,sec:30,pattern:'10',ids:'1,2'};
test('persists valid attempts, recomputes scores, deduplicates and rejects conflicting retries',async()=>{
  const {db,post}=harness();
  assert.equal((await post(sample)).status,200);
  assert.equal((await (await post(sample)).json()).duplicate,true);
  assert.equal((await post({...sample,score:2,pattern:'11'})).status,409);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM attempts').get().n,1);
  const r=await (await post({action:'grades',bank:sample.bank},'Bearer test-only')).json();
  assert.equal(r.rows[0][11],50);assert.equal(r.rows[0][14],'2');
  db.close();
});
test('rejects unauthorized reads, wrong origins, malformed attempts and oversized bodies',async()=>{
  const {db,post}=harness();
  assert.equal((await post({action:'grades',bank:sample.bank})).status,401);
  assert.equal((await post(sample,'','https://other.invalid')).status,403);
  for(const patch of [{pattern:'11'},{ids:'1,1'},{mode:'preview'},{assessment:'review'},{set:'w19'},{name:''},{total:151},{attempt:'x'}])assert.equal((await post({...sample,...patch})).status,400);
  assert.equal((await post({...sample,name:'x'.repeat(17000)})).status,400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
  db.close();
});
test('teacher pagination holds a snapshot while new results arrive',async()=>{
  const {db,post}=harness();
  for(let i=0;i<501;i++)await post({...sample,attempt:'test-attempt-'+i});
  const first=await (await post({action:'grades',bank:sample.bank},'Bearer test-only')).json();
  assert.equal(first.rows.length,500);assert.ok(first.next);
  await post({...sample,attempt:'test-later-attempt'});
  const last=await (await post({action:'grades',bank:sample.bank,after:first.next,snapshot:first.snapshot},'Bearer test-only')).json();
  assert.equal(last.rows.length,1);assert.equal(last.next,null);db.close();
});

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  const rows=[Array(19).fill('header')];
  let releases=0, stats=0;
  const log={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),getDataRange:()=>({getValues:()=>rows}),getRange:()=>({createTextFinder:needle=>({matchEntireCell:()=>({findNext:()=>rows.slice(1).some(r=>r[18]===needle)?{}:null})})})};
  const ctx=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'teacher-secret'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){releases++;}})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:body=>({body,setMimeType(){return this;}})}});
  vm.runInContext(fs.readFileSync('collector/Code.gs','utf8'),ctx);
  ctx._sheet=()=>({getSheetByName:()=>log});ctx._updateItemStats=()=>{stats++;};
  return {ctx,rows,call:p=>JSON.parse(ctx.doGet({parameter:p}).body),releases:()=>releases,stats:()=>stats};
}
const valid={bank:'course',set:'w01',bankTitle:'Course',setLabel:'Week 1',mode:'practice',cls:'A',seat:'01',name:'Student',score:'1',total:'2',pct:'999',sec:'12',pattern:'10',ids:'1,2',assessment:'class',attempt:'attempt-1'};
test('practice submissions store computed score and retry once only',()=>{
  const h=harness(); assert.equal(h.call(valid).ok,true);assert.equal(h.rows[1][11],50);assert.equal(h.rows[1][17],'class');
  assert.equal(h.call(valid).duplicate,true);assert.equal(h.rows.length,2);assert.equal(h.stats(),1);assert.equal(h.releases(),2);
});
test('teacher read requires key and filters course without writing',()=>{
  const h=harness();h.call(valid);h.call({...valid,bank:'other',attempt:'attempt-2'});
  assert.equal(h.call({action:'grades',bank:'course'}).ok,false);
  assert.equal(h.call({action:'grades',key:'wrong'}).ok,false);
  assert.equal(h.call({action:'grades',key:'teacher-secret',bank:'course'}).rows.length,1);
  assert.equal(h.rows.length,3);
});
test('invalid payload does not write, legacy records remain classified separately',()=>{
  const h=harness();for(const patch of [{score:'3'},{pattern:'11'},{ids:'1'},{total:'NaN'},{sec:'-1'},{assessment:'made-up'}])assert.equal(h.call({...valid,...patch}).ok,false);
  assert.equal(h.rows.length,1);h.call({...valid,assessment:undefined});assert.equal(h.rows[1][17],'legacy');
});
test('student text cannot become a spreadsheet formula and JSONP validates callback',()=>{
  const h=harness();h.call({...valid,name:'=1+1'});assert.equal(h.rows[1][8],"'=1+1");
  assert.match(h.ctx._reply({ok:true},'safe_cb').body,/^safe_cb\(/);
  assert.equal(h.ctx._reply({ok:true},'alert(1)').body,'{"ok":true}');
});

const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
function harness(request){
  const elements=new Map(), scripts=[];
  function el(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false});return elements.get(id);}
  const document={getElementById:el,createElement:()=>({remove(){}}),body:{appendChild:s=>scripts.push(s)}};
  const window={QUIZ_CONFIG:{endpoint:'https://example.test/exec'}};
  if(request){window.QUIZ_CONFIG.transport='json';window.quizCollectorRequest=request;}
  let timer=0;
  const ctx=vm.createContext({window,document,navigator:{},setTimeout:()=>++timer,clearTimeout(){},console,URL,Blob,Map,Set});
  // The first lookup tests whether the dashboard markup has been created.
  const lookup=document.getElementById;let first=true;
  document.getElementById=id=>{if(id==='grade-load' && first){first=false;return null;}return lookup(id);};
  vm.runInContext(fs.readFileSync('docs/assets/teacher.js','utf8'),ctx);
  el('grade-policy').value='all';el('link-assessment').value='class';
  window.renderTeacherLinks({id:'course',units:[{id:'w01',label:'W01'}]},()=> 'https://example.test/?s=w01');
  function load(rows){el('grade-key').value='secret';el('grade-load').onclick();const s=scripts.at(-1);window[new URL(s.src).searchParams.get('callback')]({ok:true,rows});}
  return {el,load,window,scripts};
}
function row(day,score,type='class',mode='practice',name='Amy',seat='01'){
  return [`2026-09-${day}T01:00:00Z`,'course','Course','w01','Week 1',mode,'A',seat,name,score/10,10,score,30,'','','','',type,'id'];
}
test('grade policies preserve assessment and mode boundaries',()=>{
  const h=harness();h.load([row('01',40),row('02',80),row('03',60),row('04',90,'midterm','exam')]);
  assert.match(h.el('grade-summary').textContent,/4 筆成績/);
  for(const [policy,avg] of [['first','65.0'],['latest','75.0'],['best','85.0']]){
    h.el('grade-policy').value=policy;h.el('grade-policy').oninput();assert.match(h.el('grade-summary').textContent,new RegExp('2 筆成績，平均 '+avg));
  }
  h.el('grade-type').value='class';h.el('grade-type').oninput();assert.match(h.el('grade-summary').textContent,/1 筆成績，平均 80.0/);
  h.el('grade-student').value='absent';h.el('grade-student').oninput();assert.equal(h.el('grade-export').disabled,true);
});
test('JSON transport combines pages without putting the teacher key in a URL',async()=>{
  const calls=[];
  const h=harness(async(p,key)=>{calls.push({p,key});return calls.length===1?{ok:true,rows:[row('01',40)],next:500,snapshot:501}:{ok:true,rows:[row('02',80)],next:null,snapshot:501};});
  h.el('grade-key').value='secret';h.el('grade-load').onclick();
  await new Promise(setImmediate);
  assert.match(h.el('grade-summary').textContent,/2 筆成績/);assert.equal(h.scripts.length,0);
  assert.equal(calls[1].p.after,500);assert.equal(calls[1].p.snapshot,501);assert.equal(calls[0].key,'secret');
});
test('clearing pending JSON results keeps them cleared and enables another load',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>resolve=r));
  h.el('grade-key').value='secret';h.el('grade-load').onclick();h.el('grade-clear').onclick();
  resolve({ok:true,rows:[row('01',100)],next:null});await new Promise(setImmediate);
  assert.match(h.el('grade-summary').textContent,/0 筆成績/);assert.equal(h.el('grade-load').disabled,false);
});
test('untrusted names are escaped and clear discards pending responses',()=>{
  const h=harness();h.load([row('01',40,'class','practice','<img src=x>')]);assert.match(h.el('grade-rows').innerHTML,/&lt;img src=x&gt;/);
  h.el('grade-load').onclick();const cb=new URL(h.scripts.at(-1).src).searchParams.get('callback');
  h.el('grade-clear').onclick();h.window[cb]({ok:true,rows:[row('01',100)]});
  assert.match(h.el('grade-summary').textContent,/0 筆成績/);assert.equal(h.el('grade-key').value,'');
});

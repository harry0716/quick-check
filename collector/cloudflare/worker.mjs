const BANK = 'cchs-ipas-2026';
const SETS = new Set([...Array.from({length:18}, (_, i) => 'w' + String(i+1).padStart(2,'0')), 'k1','k2','mix20']);
const encoder = new TextEncoder();
async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2,'0')).join('');
}
function text(value, max=100) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error('文字欄位格式不正確');
  return value.trim();
}
export function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('資料格式不正確');
  if (p.bank !== BANK || !SETS.has(p.set)) throw new Error('課程或測驗代號不正確');
  if (!['practice','exam'].includes(p.mode) || !['class','midterm','final'].includes(p.assessment)) throw new Error('作答模式或評量類別不正確');
  if (typeof p.attempt !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(p.attempt)) throw new Error('作答識別碼不正確');
  const total=Number(p.total), score=Number(p.score), sec=Number(p.sec);
  if (!Number.isInteger(total) || total<1 || total>150 || !Number.isInteger(score) || score<0 || score>total || !Number.isFinite(sec) || sec<0 || sec>86400) throw new Error('成績格式不正確');
  if (typeof p.pattern!=='string' || !/^[01]+$/.test(p.pattern) || p.pattern.length!==total || [...p.pattern].filter(v=>v==='1').length!==score) throw new Error('逐題成績格式不正確');
  if (typeof p.ids!=='string') throw new Error('題號格式不正確');
  const ids=p.ids.split(',');
  if (ids.length!==total || new Set(ids).size!==total || ids.some(id=>!/^\d+$/.test(id) || +id<1 || +id>150 || String(+id)!==id)) throw new Error('題號格式不正確');
  const cls=text(p.cls), seat=text(p.seat,30), name=text(p.name);
  if (!cls || !seat || !name) throw new Error('請填寫班級、座號及姓名');
  return [null,p.bank,text(p.bankTitle,200),p.set,text(p.setLabel,200),p.mode,cls,seat,name,score,total,Math.round(score/total*100),sec,String(p.timedOut)==='1'?'逾時':'',ids.filter((id,i)=>p.pattern[i]==='0').join(','),p.pattern,p.ids,p.assessment,p.attempt];
}
async function readBody(request) {
  const reader=request.body?.getReader();
  if (!reader) throw new Error('缺少資料');
  const chunks=[]; let size=0;
  while (true) {
    const {done,value}=await reader.read(); if(done)break;
    size+=value.length; if(size>16384){await reader.cancel();throw new Error('資料過大');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size); let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin') || '';
    const allowed=(env.ALLOWED_ORIGINS || '').split(',').includes(origin) && !!origin;
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/health')return reply({ok:true,service:'quick-check-grades',version:1,configured:!!env.DB && !!env.TEACHER_KEY});
    if(!allowed)return reply({ok:false,error:'不允許的網站來源'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST' || url.pathname!=='/')return reply({ok:false,error:'不支援的操作'},405);
    if(!env.DB || !env.TEACHER_KEY)return reply({ok:false,error:'成績接收端尚未完成設定'},503);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({ok:false,error:'需要 JSON 格式'},415);
    let p;
    try {p=await readBody(request);} catch {return reply({ok:false,error:'資料格式不正確或資料過大'},400);}
    try {
      if(p?.action==='grades') {
        const key=request.headers.get('Authorization') || '';
        if(await digest(key)!==await digest('Bearer '+env.TEACHER_KEY))return reply({ok:false,error:'教師檢視碼不正確'},401);
        if(p.bank!==BANK)return reply({ok:false,error:'課程代號不正確'},400);
        const after=p.after ?? 0;
        if(!Number.isSafeInteger(after) || after<0)return reply({ok:false,error:'分頁格式不正確'},400);
        const snapshot=p.snapshot ?? (await env.DB.prepare('SELECT COALESCE(MAX(id),0) AS last FROM attempts WHERE bank=?').bind(p.bank).first()).last;
        if(!Number.isSafeInteger(snapshot) || snapshot<0)return reply({ok:false,error:'分頁格式不正確'},400);
        const {results}=await env.DB.prepare('SELECT id,row_json FROM attempts WHERE bank=? AND id>? AND id<=? ORDER BY id LIMIT 501').bind(p.bank,after,snapshot).all();
        const page=results.slice(0,500);
        return reply({ok:true,rows:page.map(r=>JSON.parse(r.row_json)),next:results.length>500?page.at(-1).id:null,snapshot});
      }
      if(p?.action)return reply({ok:false,error:'未知操作'},400);
      let row; try {row=validate(p);}catch(e){return reply({ok:false,error:e.message},400);}
      const hash=await digest(JSON.stringify(row)); row[0]=new Date().toISOString();
      const result=await env.DB.prepare('INSERT INTO attempts (bank,attempt,received_at,payload_hash,row_json) VALUES (?,?,?,?,?) ON CONFLICT(bank,attempt) DO NOTHING').bind(p.bank,p.attempt,row[0],hash,JSON.stringify(row)).run();
      if(result.meta.changes===0){
        const old=await env.DB.prepare('SELECT payload_hash FROM attempts WHERE bank=? AND attempt=?').bind(p.bank,p.attempt).first();
        if(old?.payload_hash!==hash)return reply({ok:false,error:'同一作答識別碼的內容不一致，請保留回報碼交給老師'},409);
        return reply({ok:true,duplicate:true});
      }
      return reply({ok:true});
    } catch {return reply({ok:false,error:'暫時無法存取成績，請稍後重試'},500);}
  }
};

(function () {
  'use strict';
  var rows = [], filtered = [], bank, link, generation = 0;
  var $ = function(id) { return document.getElementById(id); };
  var types = {class:'課堂練習', midterm:'期中考', final:'期末考', legacy:'舊紀錄（未分類）'};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  window.renderTeacherLinks = function(b, makeLink) {
    bank = b; link = makeLink;
    if (!$('grade-load')) {
      $('teacher-dashboard').innerHTML = '<h2 class="sec">學生成績總覽</h2><p class="sec-note">查看全班每次作答，或依學生與測驗選取首次、最新、最高分。錯題重練與教師預覽不列入。檢視碼只在本次輸入時使用，不存入瀏覽器。</p>' +
        '<div class="acts"><label>教師檢視碼 <input id="grade-key" type="password" autocomplete="off"></label><button class="btn" id="grade-load">載入／重新整理</button><button class="btn ghost" id="grade-clear">清除畫面</button></div>' +
        '<p id="grade-status" role="status"></p><div class="grade-filters"><label>班級 <select id="grade-class"><option value="">全部班級</option></select></label>' +
        '<label>學生 <input id="grade-student" placeholder="姓名或座號"></label><label>測驗 <select id="grade-set"><option value="">全部測驗</option></select></label>' +
        '<label>評量 <select id="grade-type"><option value="">全部類別</option><option value="class">課堂練習</option><option value="midterm">期中考</option><option value="final">期末考</option><option value="legacy">舊紀錄（未分類）</option></select></label>' +
        '<label>模式 <select id="grade-mode"><option value="">全部模式</option><option value="practice">練習</option><option value="exam">測驗</option></select></label>' +
        '<label>採計方式 <select id="grade-policy"><option value="all">每次作答</option><option value="first">首次成績</option><option value="latest">最新成績</option><option value="best">最高成績</option></select></label></div>' +
        '<p id="grade-summary"></p><button class="btn ghost" id="grade-export" disabled>匯出目前成績 CSV</button><div class="grade-scroll"><table><thead><tr><th>時間</th><th>班級</th><th>座號</th><th>姓名</th><th>測驗</th><th>評量</th><th>模式</th><th>答對／題數</th><th>分數</th><th>秒數</th></tr></thead><tbody id="grade-rows"></tbody></table></div>';
      $('grade-status').textContent = window.QUIZ_CONFIG.endpoint ? '請輸入教師檢視碼載入成績。' : '尚未連接成績接收端，目前無法集中收集或查詢成績。請依 README 完成成績服務部署。';
      $('grade-load').disabled = !window.QUIZ_CONFIG.endpoint;
      $('grade-load').onclick = load;
      $('grade-clear').onclick = function(){ generation++; rows=[]; $('grade-load').disabled=!window.QUIZ_CONFIG.endpoint; $('grade-key').value=''; options(); render(); $('grade-status').textContent='已清除成績畫面。'; };
      ['grade-class','grade-student','grade-set','grade-type','grade-mode','grade-policy'].forEach(function(id){ $(id).oninput=render; });
      $('grade-export').onclick = exportCSV;
      $('link-assessment').onchange = renderLinks;
    }
    generation++; rows=[]; options(); render(); renderLinks();
  };
  function renderLinks() {
    $('deeplinks').innerHTML = (bank.units || []).concat(bank.mixes || []).map(function(s) {
      return '<div class="teacher-link"><b>'+esc((s.label || '')+' '+(s.title || ''))+'</b>'+['practice','exam'].map(function(m){
        var url = link(s.id,m)+'&a='+$('link-assessment').value;
        return '<label>'+(m==='practice'?'練習連結':'測驗連結')+'<input readonly value="'+esc(url)+'" aria-label="'+esc(s.label)+' '+m+' 連結"></label><button class="btn ghost" data-copy-link="'+esc(url)+'">複製</button>';
      }).join('')+'</div>';
    }).join('');
    $('deeplinks').onclick = async function(e) {
      var button = e.target.closest('[data-copy-link]'); if (!button) return;
      try { await navigator.clipboard.writeText(button.dataset.copyLink); button.textContent='已複製'; }
      catch(err) { button.textContent='請選取網址複製'; }
    };
  }
  function options() {
    [['grade-class',6,'全部班級'],['grade-set',3,'全部測驗']].forEach(function(o){
      var values=Array.from(new Set(rows.map(function(r){return String(r[o[1]]);}))).sort();
      $(o[0]).innerHTML='<option value="">'+o[2]+'</option>'+values.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
    });
  }
  function load() {
    var key=$('grade-key').value.trim(); if(!key){ $('grade-status').textContent='請先輸入教師檢視碼。'; return; }
    rows=[]; render(); $('grade-load').disabled=true; $('grade-status').textContent='載入中…';
    var requestGeneration=++generation;
    if(window.QUIZ_CONFIG.transport==='json'){
      (async function(){
        var collected=[], after=0, snapshot;
        try {
          do {
            var res=await window.quizCollectorRequest({action:'grades',bank:bank.id,after:after,snapshot:snapshot},key);
            if(requestGeneration!==generation)return;
            if(!res || !res.ok)throw new Error((res && res.error)||'無法載入成績。');
            collected=collected.concat(res.rows || []);
            snapshot=res.snapshot;
            if(res.next!=null && (!Number.isSafeInteger(res.next) || res.next<=after))throw new Error('成績分頁格式不正確。');
            after=res.next;
          } while(after!=null);
          rows=collected; options(); render(); $('grade-status').textContent='已載入 '+rows.length+' 筆紀錄；更新時間 '+new Date().toLocaleString('zh-TW')+'。';
        } catch(e){if(requestGeneration===generation)$('grade-status').textContent=e.message;}
        finally {if(requestGeneration===generation)$('grade-load').disabled=false;}
      })();
      return;
    }
    var cb='qc_grades_'+Date.now(), script=document.createElement('script'), done=false;
    var timer=setTimeout(function(){finish({ok:false,error:'連線逾時，請重試。'});},20000);
    function finish(res){
      if(done)return; done=true; clearTimeout(timer); script.remove(); delete window[cb]; $('grade-load').disabled=false;
      if (requestGeneration !== generation) return;
      if(!res || !res.ok){ $('grade-status').textContent=(res && res.error)||'無法載入成績。'; return; }
      rows=res.rows || []; options(); render(); $('grade-status').textContent='已載入 '+rows.length+' 筆紀錄；更新時間 '+new Date().toLocaleString('zh-TW')+'。';
    }
    window[cb]=finish; script.onerror=function(){finish({ok:false,error:'連線失敗，請確認部署網址與版本。'});};
    var endpoint=window.QUIZ_CONFIG.endpoint;
    script.src=endpoint+(endpoint.indexOf('?')<0?'?':'&')+'action=grades&bank='+encodeURIComponent(bank.id)+'&key='+encodeURIComponent(key)+'&callback='+cb;
    document.body.appendChild(script);
  }
  function render() {
    if (!$('grade-rows')) return;
    var search=$('grade-student').value.trim().toLowerCase();
    filtered=rows.filter(function(r){return (!$('grade-class').value || String(r[6])===$('grade-class').value) && (!$('grade-set').value || r[3]===$('grade-set').value) && (!$('grade-type').value || (r[17]||'legacy')===$('grade-type').value) && (!$('grade-mode').value || r[5]===$('grade-mode').value) && (!search || (String(r[8])+' '+String(r[7])).toLowerCase().includes(search));});
    var policy=$('grade-policy').value, groups=new Map();
    if(policy!=='all') {
      filtered.forEach(function(r){
        var id=JSON.stringify([r[1],r[3],r[5],r[6],r[7],r[8],r[17]||'legacy']), old=groups.get(id);
        if(!old || (policy==='best' && Number(r[11])>Number(old[11])) || (policy==='first' && new Date(r[0])<new Date(old[0])) || (policy==='latest' && new Date(r[0])>=new Date(old[0]))) groups.set(id,r);
      }); filtered=Array.from(groups.values());
    }
    filtered.sort(function(a,b){return String(a[6]).localeCompare(String(b[6]),'zh-TW') || String(a[7]).localeCompare(String(b[7]),undefined,{numeric:true}) || new Date(a[0])-new Date(b[0]);});
    $('grade-rows').innerHTML=filtered.length?filtered.map(function(r){return '<tr>'+display(r).map(function(v){return '<td>'+esc(v)+'</td>';}).join('')+'</tr>';}).join(''):'<tr><td colspan="10">沒有符合條件的成績紀錄</td></tr>';
    var avg=filtered.length?filtered.reduce(function(n,r){return n+Number(r[11]);},0)/filtered.length:0;
    $('grade-summary').textContent=filtered.length+' 筆成績，平均 '+avg.toFixed(1)+' 分。未交卷學生不會自動出現在紀錄中；缺交需另與班級名冊核對。';
    $('grade-export').disabled=!filtered.length;
  }
  function display(r){ return [new Date(r[0]).toLocaleString('zh-TW'),r[6],r[7],r[8],r[4]||r[3],types[r[17]]||types.legacy,r[5]==='exam'?'測驗':'練習',r[9]+'/'+r[10],r[11],r[12]]; }
  function exportCSV(){
    function cell(v){ var s=String(v==null?'':v); if(/^[=+@\-\t\r\n]/.test(s))s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }
    var data=[['時間','班級','座號','姓名','測驗','評量','模式','答對／題數','分數','秒數']].concat(filtered.map(display));
    var url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(function(r){return r.map(cell).join(',');}).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    var a=document.createElement('a'); a.href=url; a.download='學生成績-'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
})();

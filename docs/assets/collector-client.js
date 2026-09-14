(function(){
  'use strict';
  window.quizCollectorRequest = async function(payload, key) {
    var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},20000);
    try {
      var headers={'Content-Type':'application/json'};
      if(key)headers.Authorization='Bearer '+key;
      var res=await fetch(window.QUIZ_CONFIG.endpoint,{method:'POST',headers:headers,body:JSON.stringify(payload),signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      var body=await res.json();
      if(!res.ok && !body.error)throw new Error('成績服務暫時無法使用');
      return body;
    } catch(e) {return {ok:false,error:e.name==='AbortError'?'連線逾時，請重試。':'無法連接成績服務，請檢查網路後重試。'};}
    finally {clearTimeout(timer);}
  };
})();

/* 學後即測 — 多題庫線上測驗（純靜態，可放 GitHub Pages） */
(function () {
  'use strict';

  var CFG = window.QUIZ_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function shuffled(a) {
    var b = a.slice(), i, j, t;
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
  }

  /* ---------------- 本機儲存（每個題庫獨立） ---------------- */
  var LSKEY = 'quickcheck.v1';
  var store = { banks: {}, mode: 'practice', shuffle: true, id: {} };
  try { var raw = localStorage.getItem(LSKEY); if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') store = Object.assign(store, p); } } catch (e) {}
  function save() { try { localStorage.setItem(LSKEY, JSON.stringify(store)); } catch (e) {} }
  function bankState(id) {
    if (!store.banks[id]) store.banks[id] = { best: {}, wrong: [] };
    var s = store.banks[id];
    if (!s.best) s.best = {};
    if (!Array.isArray(s.wrong)) s.wrong = [];
    return s;
  }

  /* ---------------- 狀態 ---------------- */
  var MANIFEST = null;   // 課程清單
  var BANK = null;       // 目前題庫
  var BS = null;         // 目前題庫的本機紀錄
  var S = null;          // 目前作答階段
  var pendingSet = null; // 等待填身分的測驗
  var tick = null;
  var route = new URLSearchParams(location.search);
  var student = route.has('s') || route.has('b');
  var assessment = /^(class|midterm|final)$/.test(route.get('a')) ? route.get('a') : 'class';

  /* ---------------- 畫面切換 ---------------- */
  var VIEWS = ['courses', 'home', 'identify', 'quiz', 'result', 'browse', 'error'];
  function view(name) {
    VIEWS.forEach(function (v) { $('v-' + v).classList.toggle('hidden', v !== name); });
    var inQuiz = name === 'quiz';
    $('quitbtn').classList.toggle('hidden', !inQuiz);
    if (!inQuiz) { $('progbar').style.width = '0'; $('barinfo').textContent = ''; stopTimer(); }
    window.scrollTo(0, 0);
  }
  function fail(msg) { $('errmsg').textContent = msg; view('error'); }

  /* ---------------- 網址參數 ---------------- */
  function params() {
    var q = {};
    (location.search.replace(/^\?/, '').split('&')).forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      q[k] = v;
    });
    return q;
  }
  function deepLink(setId, mode) {
    var base = location.origin + location.pathname;
    return base + '?b=' + encodeURIComponent(BANK.id) + '&s=' + encodeURIComponent(setId) + '&m=' + (mode || 'exam');
  }

  /* ---------------- 載入 ---------------- */
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
      return r.json();
    });
  }

  function boot() {
    if (student) {
      ['homebtn', 'idbackbtn', 'errhome'].forEach(function(id) { $(id).classList.add('hidden'); });
      $('brand').disabled = true;
      $('v-courses').classList.add('hidden');
    }
    $('brand').textContent = '';
    $('brand').appendChild(document.createTextNode((CFG.siteTitle || '學後即測') + '　'));
    var sp = document.createElement('span');
    sp.textContent = CFG.siteSub || '';
    $('brand').appendChild(sp);
    $('foot-c').textContent = CFG.footer || '';
    $('foot-h').textContent = CFG.footer || '';

    getJSON('banks/manifest.json').then(function (m) {
      MANIFEST = m;
      var q = params();
      if (q.b) {
        loadBank(q.b).then(function () {
          if (q.s && findSet(q.s)) startOrIdentify(q.s, q.m === 'practice' ? 'practice' : 'exam');
          else fail('連結不完整或測驗不存在，請向老師索取本週連結。');
        }).catch(function (e) { fail('找不到這門課的題庫（' + q.b + '）。' + e.message); });
      } else if (student) {
        fail('連結不完整，請向老師索取本週連結。');
      } else if (m.banks && m.banks.length === 1) {
        loadBank(m.banks[0].id).then(renderHome).catch(function (e) { fail(e.message); });
      } else {
        renderCourses();
      }
    }).catch(function (e) {
      fail('無法載入課程清單 banks/manifest.json。如果你是用檔案總管直接打開 index.html，瀏覽器會擋掉讀取；請改用網址開啟（GitHub Pages 或本機伺服器）。原始錯誤：' + e.message);
    });
  }

  function loadBank(id) {
    var entry = (MANIFEST.banks || []).filter(function (b) { return b.id === id; })[0];
    if (!entry) return Promise.reject(new Error('manifest 裡沒有 ' + id));
    return getJSON('banks/' + entry.file).then(function (b) {
      BANK = b;
      BANK.id = b.id || id;
      BS = bankState(BANK.id);
      save();
      document.title = (b.title || '學後即測') + '｜' + (CFG.siteTitle || '學後即測');
      return b;
    });
  }

  /* ---------------- 課程選擇 ---------------- */
  function renderCourses() {
    if (student) return;
    $('courselist').innerHTML = (MANIFEST.banks || []).map(function (b) {
      return '<button class="card" data-bank="' + esc(b.id) + '"><b>' + esc(b.title) + '</b>' +
        '<span>' + esc(b.subtitle || '') + '</span></button>';
    }).join('');
    view('courses');
  }

  /* ---------------- 題目挑選 ---------------- */
  function findSet(id) {
    var all = (BANK.units || []).concat(BANK.mixes || []);
    return all.filter(function (s) { return s.id === id; })[0] ||
      (id === 'wrong' ? { id: 'wrong', label: '錯題複習', wrongOnly: true } : null);
  }
  function poolOf(set) {
    var qs = BANK.questions;
    if (set.reviewIds) return shuffled(qs.filter(function(q) { return set.reviewIds.indexOf(String(q.id)) >= 0; }));
    if (set.wrongOnly) {
      var w = {};
      BS.wrong.forEach(function (i) { w[i] = 1; });
      return qs.filter(function (q) { return w[q.id]; });
    }
    if (set.field) qs = qs.filter(function (q) { return String(q[set.field]) === String(set.value); });
    qs = shuffled(qs);
    if (set.limit) qs = qs.slice(0, set.limit);
    return qs;
  }

  /* ---------------- 測驗選單 ---------------- */
  function renderHome() {
    if (student) return fail('本次作答已結束，請等待老師提供下一份連結。');
    $('h-eyebrow').textContent = '教師後台 · ' + (BANK.subtitle || '');
    $('h-title').textContent = BANK.title || '';
    $('h-lede').textContent = '選擇本週測驗、複製學生連結，並集中檢視課堂與考試成績。';
    $('b-title').textContent = (BANK.title || '') + '　全部題目與解析';

    var qs = BANK.questions;
    $('s-total').innerHTML = qs.length + '<small>題</small>';
    var fa = (BANK.facets || [])[0], fb = (BANK.facets || [])[1];
    if (fa) {
      $('s-a-lbl').textContent = fa.short || fa.label;
      $('s-a').innerHTML = qs.filter(function (q) { return String(q[fa.field]) === String(fa.value); }).length + '<small>題</small>';
    }
    if (fb) {
      $('s-b-lbl').textContent = fb.short || fb.label;
      $('s-b').innerHTML = qs.filter(function (q) { return String(q[fb.field]) === String(fb.value); }).length + '<small>題</small>';
    }
    $('s-wrong').innerHTML = BS.wrong.length + '<small>題</small>';
    $('unit-note').textContent = BANK.unitNote || '上完課當天寫一次，考前再寫一次。';

    $('unitlist').innerHTML = (BANK.units || []).map(function (u) {
      var n = poolCount(u);
      var best = BS.best[u.id];
      return '<button class="tile" data-go="' + esc(u.id) + '">' +
        '<span class="n">' + esc(u.label) + '</span>' +
        '<span class="t">' + esc(u.title || '') + '</span>' +
        '<span class="m">' + n + ' 題' + (best != null ? '　最佳 ' + best + ' 分' : '') + '</span>' +
        (best != null ? '<i class="rail" style="width:' + best + '%"></i>' : '') +
        '</button>';
    }).join('');

    var mixes = (BANK.mixes || []).slice();
    var html = mixes.map(function (m) {
      return '<button class="card" data-go="' + esc(m.id) + '"><b>' + esc(m.label) + '</b>' +
        '<span>' + esc(m.note || '') + '</span></button>';
    }).join('');
    html += '<button class="card" id="wrongbtn" data-go="wrong"' + (BS.wrong.length ? '' : ' disabled') + '>' +
      '<b>錯題複習</b><span>' + (BS.wrong.length ? '錯題本裡有 ' + BS.wrong.length + ' 題待複習' : '目前沒有錯題') + '</span></button>';
    $('mixlist').innerHTML = html;

    document.querySelectorAll('[data-set]').forEach(function (b) {
      var k = b.dataset.set;
      b.setAttribute('aria-pressed', (k === 'mode' ? store.mode === b.dataset.val : !!store.shuffle) ? 'true' : 'false');
    });

    window.renderTeacherLinks(BANK, deepLink);

    view('home');
  }
  function poolCount(set) {
    if (set.wrongOnly) return BS.wrong.length;
    var n = set.field
      ? BANK.questions.filter(function (q) { return String(q[set.field]) === String(set.value); }).length
      : BANK.questions.length;
    return set.limit ? Math.min(n, set.limit) : n;
  }

  /* ---------------- 身分 ---------------- */
  function needIdentity(mode) {
    var r = CFG.requireIdentity || 'always';
    if (r === 'never') return false;
    if (!student) return false;
    return r === 'always' || mode === 'exam';
  }
  function startOrIdentify(setId, mode) {
    var set = findSet(setId);
    if (!set) return fail('找不到指定測驗，請向老師索取連結。');
    if (poolCount(set) === 0) return renderHome();
    mode = mode || store.mode;
    if (needIdentity(mode)) {
      pendingSet = { set: set, mode: mode };
      $('id-title').textContent = set.title || set.label;
      $('f-class').value = (store.id && store.id.cls) || '';
      $('f-seat').value = (store.id && store.id.seat) || '';
      $('f-name').value = (store.id && store.id.name) || '';
      $('id-lede').textContent = CFG.endpoint ? '請填寫班級、座號與姓名，作答成績將回報給老師。' : '請填寫班級、座號與姓名。老師尚未啟用線上收件，完成後請保留回報碼。';
      $('id-hint').textContent = mode === 'exam' && set.timeSec ? ('本測驗限時 ' + Math.round(set.timeSec / 60) + ' 分鐘，開始後計時。') : '';
      view('identify');
      setTimeout(function () { $('f-class').focus(); }, 60);
    } else {
      begin(set, mode);
    }
  }

  /* ---------------- 開始作答 ---------------- */
  function begin(set, mode) {
    var qs = poolOf(set);
    if (!qs.length) return renderHome();
    S = {
      set: set, mode: mode, i: 0, answers: [], startedAt: Date.now(),
      attempt: crypto.randomUUID(), assessment: assessment, review: !!set.reviewIds,
      items: qs.map(function (q) {
        var order = store.shuffle ? shuffled([0, 1, 2, 3]) : [0, 1, 2, 3];
        order = order.filter(function (k) { return k < q.o.length; });
        return { q: q, order: order, ans: order.indexOf(q.a) };
      })
    };
    view('quiz');
    if (mode === 'exam' && set.timeSec) startTimer(set.timeSec);
    renderQ();
  }

  function startTimer(sec) {
    var end = Date.now() + sec * 1000;
    $('timer').classList.remove('hidden', 'warn', 'crit');
    tick = setInterval(function () {
      var left = (end - Date.now()) / 1000;
      $('timer').textContent = mmss(left);
      $('timer').classList.toggle('warn', left <= 300 && left > 60);
      $('timer').classList.toggle('crit', left <= 60);
      if (left <= 0) { stopTimer(); finish(true); }
    }, 500);
    $('timer').textContent = mmss(sec);
  }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } $('timer').classList.add('hidden'); }

  function renderQ() {
    var it = S.items[S.i], q = it.q;
    $('q-no').textContent = pad2(S.i + 1);
    $('q-tags').innerHTML = (BANK.tagFields || []).map(function (f) {
      var v = q[f];
      return v == null || v === '' ? '' : '<span class="tg">' + esc(f === 'w' ? 'W' + pad2(v) : v) + '</span>';
    }).join('');
    $('q-stem').textContent = q.q;
    $('q-choices').innerHTML = it.order.map(function (oi, k) {
      return '<button class="ch" data-k="' + k + '"><span class="k">' + KEYS[k] + '</span><span>' + esc(q.o[oi]) + '</span></button>';
    }).join('');

    var given = S.answers[S.i];
    var btns = document.querySelectorAll('#q-choices .ch');
    $('q-fb').classList.add('hidden');
    if (given != null) {
      btns.forEach(function (b) { b.disabled = true; });
      if (S.mode === 'practice') { paintPractice(btns, it, given); }
      else { btns[given].classList.add('sel'); }
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { choose(+b.dataset.k); }); });

    $('nextbtn').disabled = given == null;
    $('nextbtn').textContent = (S.i === S.items.length - 1) ? '看結果' : '下一題';
    $('prevbtn').disabled = S.i === 0;
    $('prevbtn').classList.toggle('ghost', true);
    $('barinfo').innerHTML = esc(S.set.title || S.set.label) + '　<b>' + (S.i + 1) + ' / ' + S.items.length + '</b>';
    $('progbar').style.width = (S.i / S.items.length * 100) + '%';
  }

  function paintPractice(btns, it, given) {
    btns[it.ans].classList.add('ok');
    if (given !== it.ans) btns[given].classList.add('no');
    var right = given === it.ans;
    $('q-fb').classList.remove('hidden');
    $('q-fb').classList.toggle('wrong', !right);
    $('fb-v').textContent = right ? '答對了' : '答錯了　正解 ' + KEYS[it.ans];
    $('fb-e').textContent = it.q.e || '';
  }

  function choose(k) {
    var it = S.items[S.i];
    if (S.mode === 'practice' && S.answers[S.i] != null) return;
    S.answers[S.i] = k;
    var btns = document.querySelectorAll('#q-choices .ch');
    if (S.mode === 'practice') {
      btns.forEach(function (b) { b.disabled = true; });
      paintPractice(btns, it, k);
    } else {
      btns.forEach(function (b) { b.classList.remove('sel'); });
      btns[k].classList.add('sel');
    }
    $('nextbtn').disabled = false;
    $('nextbtn').focus();
  }

  function next() {
    if (S.answers[S.i] == null) return;
    if (S.i < S.items.length - 1) { S.i++; renderQ(); } else finish(false);
  }
  function prev() { if (S.i > 0) { S.i--; renderQ(); } }

  /* ---------------- 結果 ---------------- */
  function finish(timedOut) {
    if (!S || S.result) return;
    stopTimer();
    var ok = 0, missed = [], byTopic = {};
    var wrongSet = {};
    BS.wrong.forEach(function (i) { wrongSet[i] = 1; });

    S.items.forEach(function (it, i) {
      var right = S.answers[i] === it.ans;
      if (right) { ok++; delete wrongSet[it.q.id]; }
      else {
        wrongSet[it.q.id] = 1;
        missed.push(it.q.id);
        var key = it.q.t || it.q.lc || '未分類';
        if (!byTopic[key]) byTopic[key] = { n: 0, lc: it.q.lc || '' };
        byTopic[key].n++;
      }
    });
    BS.wrong = Object.keys(wrongSet).map(Number);
    var pct = Math.round(ok / S.items.length * 100);
    if (BS.best[S.set.id] == null || pct > BS.best[S.set.id]) BS.best[S.set.id] = pct;
    save();

    var elapsed = Math.round((Date.now() - S.startedAt) / 1000);
    S.result = { ok: ok, total: S.items.length, pct: pct, missed: missed, elapsed: elapsed, timedOut: !!timedOut };

    $('r-label').textContent = (BANK.title || '') + '　' + (S.set.title || S.set.label);
    $('r-title').textContent = timedOut ? '時間到，自動交卷' : ((S.mode === 'exam' ? '測驗' : '練習') + '完成');
    $('r-pct').textContent = pct;
    $('r-verdict').textContent =
      pct >= 90 ? '很穩，這個範圍可以先放著' :
      pct >= 80 ? '掌握得不錯，把錯的幾題看懂就好' :
      pct >= 70 ? '及格線之上，錯的地方要補' :
      pct >= 60 ? '勉強守住 60，還不夠安全' : '這個範圍要重看一次';
    $('r-sub').textContent = '答對 ' + ok + ' / ' + S.items.length + ' 題，用時 ' + mmss(elapsed) + '。' + (BANK.goalNote || '');

    var topics = Object.keys(byTopic).map(function (k) { return { k: k, n: byTopic[k].n, lc: byTopic[k].lc }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 3);
    if (topics.length) {
      $('r-diag').classList.remove('hidden');
      $('r-diaglist').innerHTML = topics.map(function (t) {
        return '<li><b>' + esc(t.k) + '</b>' + (t.lc ? '（' + esc(t.lc) + '）' : '') + '　錯 ' + t.n + ' 題　—　先把下面這幾題的解析看懂，再回頭練同一單元</li>';
      }).join('');
    } else {
      $('r-diag').classList.add('hidden');
    }

    $('r-code').value = '[' + BANK.id + '/' + S.set.id + '] ' +
      (store.id && store.id.name ? store.id.cls + ' ' + store.id.seat + ' ' + store.id.name + ' ' : '') +
      ok + '/' + S.items.length + ' (' + pct + '%) 錯題:' + (missed.length ? missed.join(',') : '無');

    $('r-rev').innerHTML = S.items.map(function (it, i) {
      var right = S.answers[i] === it.ans;
      var yourIdx = S.answers[i];
      var your = yourIdx == null ? '未作答' : KEYS[yourIdx] + '　' + it.q.o[it.order[yourIdx]];
      var tags = (BANK.tagFields || []).map(function (f) {
        var v = it.q[f];
        return v == null || v === '' ? '' : '<span>' + esc(f === 'w' ? 'W' + pad2(v) : v) + '</span>';
      }).join('');
      return '<div class="rvi' + (right ? '' : ' miss') + '">' +
        '<div class="h"><span>' + pad2(i + 1) + '</span>' + tags + '</div>' +
        '<div class="st">' + esc(it.q.q) + '</div>' +
        (right ? '' : '<p class="ln y">你選的：<b>' + esc(your) + '</b></p>') +
        '<p class="ln a">正　解：<b>' + KEYS[it.ans] + '　' + esc(it.q.o[it.q.a]) + '</b></p>' +
        '<p class="ex">' + esc(it.q.e || '') + '</p></div>';
    }).join('');

    var canSend = !!CFG.endpoint && student && !S.review;
    $('r-sendbox').classList.toggle('hidden', !canSend);
    $('sendmsg').textContent = '';
    $('sendmsg').className = 'sendmsg';
    $('sendbtn').disabled = false;
    $('wrongbtn2').disabled = missed.length === 0;

    view('result');
    if (canSend) sendResult();
    $('r-status').textContent = S.review ? '錯題重練不列入評分。' : (!student ? '教師預覽不回報成績。' : (CFG.endpoint ? '完成後請確認成績已回報，再關閉頁面，等待老師提供下一份連結。' : '尚未啟用線上收件，請複製回報碼交給老師。'));
  }

  /* ---------------- 回報成績（JSONP，避開 CORS） ---------------- */
  var jsonpSeq = 0;
  function sendResult() {
    if (!CFG.endpoint || !S || !S.result || !student || S.review || S.sending || S.sent) return;
    S.sending = true;
    var session = S;
    $('againbtn').disabled = true;
    $('wrongbtn2').disabled = true;
    $('sendbtn').disabled = true;
    $('sendmsg').className = 'sendmsg';
    $('sendmsg').textContent = '回報中…';

    var pattern = S.items.map(function (it, i) { return S.answers[i] === it.ans ? '1' : '0'; }).join('');
    var cb = 'qc_cb_' + (++jsonpSeq) + '_' + Date.now();
    var q = {
      callback: cb,
      attempt: S.attempt,
      assessment: S.assessment,
      bank: BANK.id,
      bankTitle: BANK.title || '',
      set: S.set.id,
      setLabel: S.set.title || S.set.label,
      mode: S.mode,
      cls: (store.id && store.id.cls) || '',
      seat: (store.id && store.id.seat) || '',
      name: (store.id && store.id.name) || '',
      score: S.result.ok,
      total: S.result.total,
      pct: S.result.pct,
      sec: S.result.elapsed,
      timedOut: S.result.timedOut ? 1 : 0,
      wrong: S.result.missed.join(','),
      pattern: pattern,
      ids: S.items.map(function (it) { return it.q.id; }).join(',')
    };
    var url = CFG.endpoint + (CFG.endpoint.indexOf('?') < 0 ? '?' : '&') +
      Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');

    var done = false;
    var script = document.createElement('script');
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      cleanup();
      $('sendmsg').className = 'sendmsg err';
      $('sendmsg').textContent = '回報逾時，請把下面的回報碼複製給老師。';
      $('sendbtn').disabled = false;
      $('sendbtn').textContent = '再試一次';
    }, 12000);

    function cleanup() {
      session.sending = false;
      if (S === session) {
        $('againbtn').disabled = false;
        $('wrongbtn2').disabled = session.result.missed.length === 0;
      }
      clearTimeout(timer);
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cb] = function (res) {
      if (done) return;
      done = true;
      cleanup();
      if (S !== session) return;
      if (res && res.ok) {
        session.sent = true;
        $('sendmsg').className = 'sendmsg ok';
        $('sendmsg').textContent = '已回報給老師。';
        $('sendbtn').textContent = '已回報';
        $('sendbtn').disabled = true;
      } else {
        $('sendmsg').className = 'sendmsg err';
        $('sendmsg').textContent = '回報失敗' + (res && res.error ? '：' + res.error : '') + '，請複製回報碼給老師。';
        $('sendbtn').disabled = false;
      }
    };
    script.onerror = function () {
      if (done) return;
      done = true;
      cleanup();
      $('sendmsg').className = 'sendmsg err';
      $('sendmsg').textContent = '連不上回報伺服器，請把回報碼複製給老師。';
      $('sendbtn').disabled = false;
      $('sendbtn').textContent = '再試一次';
    };
    script.src = url;
    document.body.appendChild(script);
  }

  /* ---------------- 題庫瀏覽 ---------------- */
  var bf = 'all';
  function renderBrowse() {
    if (student) return;
    var units = BANK.units || [];
    $('browsefilter').innerHTML =
      '<button class="pill" data-bf="all" aria-pressed="' + (bf === 'all') + '">全部</button>' +
      units.map(function (u) {
        return '<button class="pill" data-bf="' + esc(u.id) + '" aria-pressed="' + (bf === u.id) + '">' + esc(u.label) + '</button>';
      }).join('');
    var list = BANK.questions;
    if (bf !== 'all') {
      var u = findSet(bf);
      if (u && u.field) list = list.filter(function (q) { return String(q[u.field]) === String(u.value); });
    }
    $('browselist').innerHTML = list.map(function (q) {
      var tags = (BANK.tagFields || []).map(function (f) {
        var v = q[f];
        return v == null || v === '' ? '' : '<span>' + esc(f === 'w' ? 'W' + pad2(v) : v) + '</span>';
      }).join('');
      return '<div class="bq"><div class="h"><span>#' + q.id + '</span>' + tags + '</div>' +
        '<div class="s">' + esc(q.q) + '</div><ol type="A">' +
        q.o.map(function (o, i) { return '<li' + (i === q.a ? ' class="a"' : '') + '>' + esc(o) + '</li>'; }).join('') +
        '</ol><p class="e">' + esc(q.e || '') + '</p></div>';
    }).join('');
    view('browse');
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    if (student) return;
    var bankBtn = e.target.closest('[data-bank]');
    if (bankBtn) { loadBank(bankBtn.dataset.bank).then(renderHome).catch(function (err) { fail(err.message); }); return; }

    var go = e.target.closest('[data-go]');
    if (go && !go.disabled) {
      if (go.dataset.go === 'browse') { bf = 'all'; renderBrowse(); }
      else startOrIdentify(go.dataset.go, store.mode);
      return;
    }
    var st = e.target.closest('[data-set]');
    if (st) {
      if (st.dataset.set === 'mode') store.mode = st.dataset.val; else store.shuffle = !store.shuffle;
      save(); renderHome(); return;
    }
    var b = e.target.closest('[data-bf]');
    if (b) { bf = b.dataset.bf; renderBrowse(); return; }
  });

  $('startbtn').addEventListener('click', function () {
    var cls = $('f-class').value.trim(), seat = $('f-seat').value.trim(), name = $('f-name').value.trim();
    if (!cls || !seat || !name) { $('id-hint').textContent = '班級、座號與姓名為必填。'; return; }
    store.id = { cls: cls, seat: seat, name: name };
    save();
    begin(pendingSet.set, pendingSet.mode);
  });
  $('idbackbtn').addEventListener('click', renderHome);
  $('nextbtn').addEventListener('click', next);
  $('prevbtn').addEventListener('click', prev);
  $('againbtn').addEventListener('click', function () { if (S.review) begin(S.set, 'practice'); else startOrIdentify(S.set.id, S.mode); });
  $('wrongbtn2').addEventListener('click', function () {
    var ids = {};
    S.result.missed.forEach(function (i) { ids[i] = 1; });
    var set = { id: S.set.id + '-miss', label: '本次錯題', title: '本次錯題重練', reviewIds: Object.keys(ids) };
    var qs = BANK.questions.filter(function (q) { return ids[q.id]; });
    S = {
      set: set, review: true, mode: 'practice', i: 0, answers: [], startedAt: Date.now(),
      items: shuffled(qs).map(function (q) {
        var order = store.shuffle ? shuffled([0, 1, 2, 3]) : [0, 1, 2, 3];
        return { q: q, order: order, ans: order.indexOf(q.a) };
      })
    };
    view('quiz'); renderQ();
  });
  $('homebtn').addEventListener('click', renderHome);
  $('bbackbtn').addEventListener('click', renderHome);
  $('errhome').addEventListener('click', function () { location.href = location.pathname; });
  $('brand').addEventListener('click', function () {
    if (student) return;
    if (MANIFEST && (MANIFEST.banks || []).length > 1) renderCourses(); else if (BANK) renderHome();
  });
  $('quitbtn').addEventListener('click', function () {
    if (S && S.mode === 'exam' && !confirm('現在結束會直接計算目前的成績，未作答的題目算錯。確定要交卷嗎？')) return;
    if (S) finish(false); else renderHome();
  });
  $('sendbtn').addEventListener('click', sendResult);
  $('copybtn').addEventListener('click', function () {
    var el = $('r-code');
    el.select(); el.setSelectionRange(0, 99999);
    var done = false;
    try { done = document.execCommand('copy'); } catch (e) {}
    if (!done && navigator.clipboard) { navigator.clipboard.writeText(el.value); done = true; }
    if (done) { $('copybtn').textContent = '已複製'; setTimeout(function () { $('copybtn').textContent = '複製回報碼'; }, 1600); }
  });
  document.addEventListener('keydown', function (e) {
    if ($('v-quiz').classList.contains('hidden')) return;
    if (e.key >= '1' && e.key <= '4') {
      var b = document.querySelectorAll('#q-choices .ch')[+e.key - 1];
      if (b && !b.disabled) b.click();
    }
    if (e.key === 'Enter' && !$('nextbtn').disabled) next();
  });
  window.addEventListener('beforeunload', function (e) {
    if (S && S.mode === 'exam' && !S.result) { e.preventDefault(); e.returnValue = ''; }
  });

  boot();
})();

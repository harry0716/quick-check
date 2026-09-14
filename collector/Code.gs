/**
 * 「學後即測」成績接收端
 * ------------------------------------------------------------------
 * 部署一次，之後所有課程、所有班級共用。學生不需要登入。
 *
 * 【部署步驟】
 *  1. 開啟 https://script.google.com → 新增專案，把這個檔案的內容整段貼上
 *  2. 上方函式選單選 setup，按執行。第一次會要求授權：
 *       檢閱權限 → 選自己的帳號 → 進階 → 前往「專案名稱」（不安全）→ 允許
 *     （這個「不安全」警告是因為指令碼未經 Google 審查，是你自己寫的，可以放行）
 *     執行紀錄（Ctrl+Enter）會印出成績試算表的網址，先存起來。
 *  3. 右上「部署」→ 新增部署作業 → 類型選「網頁應用程式」
 *       執行身分：我
 *       誰可以存取：**所有人**   ← 這一項一定要選這個，學生才不用登入
 *     按「部署」，複製那串 .../exec 結尾的網址。
 *  4. 把網址貼進網站的 docs/assets/config.js 的 endpoint 欄位，推上 GitHub 即可。
 *
 * 【之後改了程式碼要記得】
 *  「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新增版本」→ 部署」
 *  否則線上跑的還是舊版。網址不會變。
 *
 * 【資料放在哪】
 *  你自己 Google 雲端硬碟裡的一份試算表「學後即測　成績紀錄」，
 *  兩個工作表：作答紀錄（每人每次一列）、逐題統計（每題答對率，用來檢討教學）。
 */

var SHEET_NAME = '學後即測　成績紀錄';
var PROP_KEY = 'QUICKCHECK_SHEET_ID';

var HEADERS = ['時間戳記', '課程代號', '課程名稱', '測驗代號', '測驗名稱', '模式',
  '班級', '座號', '姓名', '得分', '題數', '百分比', '作答秒數', '是否逾時',
  '答錯題號', '作答對錯序列', '本次出題題號', '評量類別', '作答識別碼'];

/** 步驟 2：建立試算表並授權 */
function setup() {
  var ss = _sheet();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('QUICKCHECK_TEACHER_KEY')) {
    props.setProperty('QUICKCHECK_TEACHER_KEY', Utilities.getUuid());
  }
  Logger.log('教師檢視碼（請保密，不要貼進公開設定檔）：' + props.getProperty('QUICKCHECK_TEACHER_KEY'));
  Logger.log('成績試算表已就緒：');
  Logger.log(ss.getUrl());
  Logger.log('接著回到「部署 → 新增部署作業 → 網頁應用程式」，存取權限選「所有人」。');
  return ss.getUrl();
}

function _sheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_KEY);
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty(PROP_KEY, ss.getId());
  }
  var log = ss.getSheetByName('作答紀錄');
  if (!log) {
    log = ss.getSheets()[0];
    log.setName('作答紀錄');
  }
  if (log.getLastRow() === 0) {
    log.appendRow(HEADERS);
    log.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#E4EAE5');
    log.setFrozenRows(1);
  }
  log.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (!ss.getSheetByName('逐題統計')) {
    var st = ss.insertSheet('逐題統計');
    st.appendRow(['題號', '出現次數', '答錯次數', '答錯率']);
    st.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#E4EAE5');
    st.setFrozenRows(1);
  }
  return ss;
}

function _reply(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = p.callback;
  try {
    if (p.action === 'grades') {
      var expected = PropertiesService.getScriptProperties().getProperty('QUICKCHECK_TEACHER_KEY');
      if (!expected || p.key !== expected) return _reply({ok:false,error:'教師檢視碼不正確，或尚未執行 setup。'}, cb);
      var records = _sheet().getSheetByName('作答紀錄').getDataRange().getValues().slice(1);
      return _reply({ok:true, rows:records.filter(function(r) {return !p.bank || r[1] === p.bank;})}, cb);
    }
    if (p.action) return _reply({ok:false,error:'未知操作'}, cb);
    if (!p.bank || !p.set) return _reply({ ok: false, error: '缺少必要參數' }, cb);
    var total = Number(p.total), score = Number(p.score), sec = Number(p.sec);
    if (!Number.isInteger(total) || total < 1 || total > 1000 || !Number.isInteger(score) || score < 0 || score > total || !Number.isFinite(sec) || sec < 0 || !/^[01]+$/.test(p.pattern || '') || p.pattern.length !== total || String(p.ids || '').split(',').length !== total || (p.pattern.match(/1/g) || []).length !== score) {
      return _reply({ok:false,error:'成績格式不正確'}, cb);
    }
    if (p.mode !== 'exam' && p.mode !== 'practice') return _reply({ok:false,error:'作答模式不正確'}, cb);
    if (p.assessment && !/^(class|midterm|final)$/.test(p.assessment)) return _reply({ok:false,error:'評量類別不正確'}, cb);

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = _sheet();
      var log = ss.getSheetByName('作答紀錄');
      if (p.attempt && log.getLastRow() > 1) {
        var found = log.getRange(2, 19, log.getLastRow()-1, 1).createTextFinder(String(p.attempt)).matchEntireCell(true).findNext();
        if (found) return _reply({ok:true,duplicate:true}, cb);
      }
      ss.getSheetByName('作答紀錄').appendRow([
        new Date(), _text(p.bank), _text(p.bankTitle), _text(p.set), _text(p.setLabel), p.mode,
        _text(p.cls), _text(p.seat), _text(p.name),
        score, total, Math.round(score / total * 100),
        sec, p.timedOut === '1' ? '逾時' : '',
        _text(p.wrong), _text(p.pattern), _text(p.ids), p.assessment || 'legacy', _text(p.attempt)
      ]);
      // 作答紀錄是成績依據；統計更新失敗不要求學生再次交卷。
      try { _updateItemStats(ss, p.ids, p.pattern); } catch (statsError) { console.error(statsError); }
    } finally {
      lock.releaseLock();
    }
    return _reply({ ok: true }, cb);
  } catch (err) {
    return _reply({ ok: false, error: String(err) }, cb);
  }
}

function _text(value) {
  var s = String(value == null ? '' : value).slice(0, 10000);
  return /^[=+@\-\t\r\n]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { p = (e && e.parameter) || {}; }
  return doGet({ parameter: p });
}

/** 累計每一題的出現與答錯次數，作為教學檢討依據 */
function _updateItemStats(ss, idsStr, pattern) {
  if (!idsStr || !pattern) return;
  var ids = String(idsStr).split(',');
  if (ids.length !== String(pattern).length) return;

  var st = ss.getSheetByName('逐題統計');
  var last = st.getLastRow();
  var map = {};
  if (last > 1) {
    var vals = st.getRange(2, 1, last - 1, 3).getValues();
    for (var i = 0; i < vals.length; i++) map[String(vals[i][0])] = { row: i + 2, seen: vals[i][1], wrong: vals[i][2] };
  }
  var appends = [];
  for (var k = 0; k < ids.length; k++) {
    var id = ids[k].trim();
    if (!id) continue;
    var wrong = pattern.charAt(k) === '0' ? 1 : 0;
    if (map[id]) {
      map[id].seen += 1;
      map[id].wrong += wrong;
      st.getRange(map[id].row, 2, 1, 2).setValues([[map[id].seen, map[id].wrong]]);
      st.getRange(map[id].row, 4).setFormula('=IF(B' + map[id].row + '=0,"",C' + map[id].row + '/B' + map[id].row + ')');
    } else {
      appends.push([Number(id) || id, 1, wrong, '']);
      map[id] = { row: -1, seen: 1, wrong: wrong };
    }
  }
  if (appends.length) {
    var start = st.getLastRow() + 1;
    st.getRange(start, 1, appends.length, 4).setValues(appends);
    for (var r = start; r < start + appends.length; r++) {
      st.getRange(r, 4).setFormula('=IF(B' + r + '=0,"",C' + r + '/B' + r + ')');
    }
  }
  st.getRange(2, 4, Math.max(1, st.getLastRow() - 1), 1).setNumberFormat('0.0%');
}

/** 需要時可手動執行：把逐題統計依答錯率由高到低排序 */
function sortItemStats() {
  var st = _sheet().getSheetByName('逐題統計');
  var last = st.getLastRow();
  if (last > 2) st.getRange(2, 1, last - 1, 4).sort({ column: 4, ascending: false });
}

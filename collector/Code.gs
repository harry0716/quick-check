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
  '答錯題號', '作答對錯序列', '本次出題題號'];

/** 步驟 2：建立試算表並授權 */
function setup() {
  var ss = _sheet();
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
    if (!p.bank || !p.set) return _reply({ ok: false, error: '缺少必要參數' }, cb);

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = _sheet();
      ss.getSheetByName('作答紀錄').appendRow([
        new Date(), p.bank, p.bankTitle || '', p.set, p.setLabel || '', p.mode || '',
        p.cls || '', p.seat || '', p.name || '',
        Number(p.score || 0), Number(p.total || 0), Number(p.pct || 0),
        Number(p.sec || 0), p.timedOut === '1' ? '逾時' : '',
        p.wrong || '', p.pattern || '', p.ids || ''
      ]);
      _updateItemStats(ss, p.ids, p.pattern);
    } finally {
      lock.releaseLock();
    }
    return _reply({ ok: true }, cb);
  } catch (err) {
    return _reply({ ok: false, error: String(err) }, cb);
  }
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

/**
 * Code.gs  ―  メイン処理
 * ------------------------------------------------------------------
 * 定期トリガー（setupTrigger）で processInbox が動き、
 *   1. 「自動転記」ラベルが付いた未処理スレッドを検索
 *   2. 各メールの差出人・件名・受信日時・抽出項目をシートへ追記
 *   3. 「転記済み」ラベルへ付け替え（二重転記を防止）
 *   4. （任意）Slackへ「○件転記しました」を通知
 * を行います。
 * ------------------------------------------------------------------
 */

/**
 * 【初回のみ実行】定期トリガー（10分おき）を登録します。
 */
function setupTrigger() {
  // 二重登録を防ぐため既存を削除
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInbox') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('processInbox')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('定期トリガーを登録しました（10分おき）。');
}

/**
 * メイン：未処理メールを拾ってシートへ転記します。
 */
function processInbox() {
  try {
    const targetLabel = GmailApp.getUserLabelByName(CONFIG.TARGET_LABEL);
    if (!targetLabel) {
      throw new Error('ラベル「' + CONFIG.TARGET_LABEL + '」が見つかりません。Gmailで作成してください。');
    }
    const doneLabel = getOrCreateLabel_(CONFIG.DONE_LABEL);

    // 「対象ラベルが付き、かつ処理済みでない」スレッドを検索
    const query = 'label:' + CONFIG.TARGET_LABEL + ' -label:' + CONFIG.DONE_LABEL;
    const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS_PER_RUN);
    if (threads.length === 0) {
      Logger.log('未処理メールはありません。');
      return;
    }

    const sheet = getOrCreateSheet_();
    let count = 0;

    threads.forEach(function (thread) {
      // スレッド内の各メッセージを転記（通常は最新1通でも可）
      thread.getMessages().forEach(function (msg) {
        appendMessageToSheet_(sheet, msg);
        count += 1;
      });
      // 処理済みラベルへ付け替え
      thread.addLabel(doneLabel);
      thread.removeLabel(targetLabel);
    });

    if (CONFIG.SLACK.ENABLED && CONFIG.SLACK.NOTIFY_SUMMARY && count > 0) {
      notifySlackSummary_(count);
    }

    Logger.log(count + ' 通を転記しました。');
  } catch (err) {
    handleError_('processInbox', err);
  }
}

/**
 * 1通のメールを1行としてシートに追記します。
 */
function appendMessageToSheet_(sheet, msg) {
  const body = msg.getPlainBody();
  const base = {
    '受信日時': Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
    '差出人': msg.getFrom(),
    '件名': msg.getSubject(),
  };

  // 抽出ルールを適用（Parser.gs）
  const extracted = extractFields_(body);

  // 本文抜粋
  if (CONFIG.BODY_SNIPPET_LENGTH > 0) {
    base['本文抜粋'] = body.replace(/\s+/g, ' ').slice(0, CONFIG.BODY_SNIPPET_LENGTH);
  }

  // ヘッダー順に1行を組み立て（ヘッダーは初回作成時に確定）
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const merged = Object.assign({}, base, extracted);
  const row = headers.map(function (h) { return merged[h] != null ? merged[h] : ''; });
  sheet.appendRow(row);
}

/* ── シート／ラベルの用意 ──────────────────────────────── */

/** 転記先シートを取得（無ければヘッダー付きで作成）。 */
function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    // 固定列 ＋ 抽出ルールの見出し ＋（任意で）本文抜粋
    const headers = ['受信日時', '差出人', '件名']
      .concat(CONFIG.PARSE_RULES.map(function (r) { return r.header; }));
    if (CONFIG.BODY_SNIPPET_LENGTH > 0) headers.push('本文抜粋');
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 指定名のラベルを取得（無ければ作成）。 */
function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/* ── Slack ──────────────────────────────────────────────── */

function notifySlackSummary_(count) {
  const url = getSlackWebhookUrl_();
  if (!url) return;
  const payload = { text: ':email: 受信メールを ' + count + ' 件、スプレッドシートへ転記しました。' };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

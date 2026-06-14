/**
 * Parser.gs  ―  本文からの項目抽出
 * ------------------------------------------------------------------
 * Config.gs の PARSE_RULES に従い、メール本文から値を取り出します。
 * 正規表現の最初のキャプチャ ( ) を抽出値とし、見つからなければ空欄。
 * ------------------------------------------------------------------
 */

/**
 * 本文に全ルールを適用し、{見出し: 抽出値} を返します。
 * @param {string} body メール本文（プレーンテキスト）
 * @return {Object}
 */
function extractFields_(body) {
  const out = {};
  CONFIG.PARSE_RULES.forEach(function (rule) {
    out[rule.header] = extractOne_(body, rule.pattern);
  });
  return out;
}

/**
 * 1つの正規表現を適用してキャプチャ値を返します。
 * 不正な正規表現や未マッチのときは空文字（処理は止めない）。
 */
function extractOne_(body, pattern) {
  try {
    const re = new RegExp(pattern);
    const m = re.exec(body);
    if (!m) return '';
    // キャプチャグループがあればその1番目、無ければマッチ全体
    return (m[1] != null ? m[1] : m[0]).trim();
  } catch (e) {
    Logger.log('抽出ルールの正規表現が不正です: ' + pattern + ' / ' + e);
    return '';
  }
}

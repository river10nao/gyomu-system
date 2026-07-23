// 口座請求元(S0014)経由の請求想定単価 = 定価×(マスタ率−2%)切捨 が全ブランドに効くかの回帰テスト。
// 2026-07-21: 特定ブランド限定(41.9%→39.9%)だった分解を全ブランド(48%→46%等)へ一般化した。
// 固有名詞は公開リポに書かない（ブランド名・仕入先名はダミー）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const element = () => ({
  style: {}, dataset: {}, classList: {contains() { return false; }},
  addEventListener() {}, appendChild() {}, remove() {}
});
const ctx = {
  console,
  Date,
  URLSearchParams,
  setTimeout() {},
  clearTimeout() {},
  localStorage: {getItem() { return ''; }, setItem() {}, removeItem() {}},
  document: {
    documentElement: {dataset: {}},
    activeElement: null,
    body: element(),
    addEventListener() {},
    getElementById() { return element(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return element(); }
  },
  window: {scrollTo() {}, open() { return null; }},
  location: {reload() {}}
};
vm.createContext(ctx);
vm.runInContext(script, ctx);

const fixtures = {
  salons: {rows: [
    {'サロンID': 'S0014', '種別': 'ディーラー', 'サロン名(ディーラー含む)': '口座請求元', 'ブランドA(41.9%)': 0.419, 'ブランドB(%)': 0.48},
    {'サロンID': 'S0015', '種別': 'ディーラー', 'サロン名(ディーラー含む)': 'カード請求元', 'ブランドB(%)': 0.49}
  ]},
  products: {rows: [
    {'商品ID': 'P1', 'カテゴリー': 'ブランドA', '定価（税抜）': 1000, 'サロン仕入価格（税抜）': 700},
    {'商品ID': 'P2', 'カテゴリー': 'ブランドB', '定価（税抜）': 1000, 'サロン仕入価格（税抜）': 650}
  ]},
  orderLedger: {rows: []},
  collectionLedger: {rows: [
    {'回収ID': 'K1', '商品ID': 'P1', '個数': 1, '仕入先ID': 'S0014', '発注日': '2026/07/21', '区分': '卸', '削除': ''},
    {'回収ID': 'K2', '商品ID': 'P2', '個数': 1, '仕入先ID': 'S0014', '発注日': '2026/07/21', '区分': '卸', '削除': ''},
    {'回収ID': 'K3', '商品ID': 'P2', '個数': 1, '仕入先ID': 'S0015', '発注日': '2026/07/21', '区分': '卸', '削除': ''}
  ]}
};
vm.runInContext('Object.assign(DB, ' + JSON.stringify(fixtures) + '); NM = NM || {};', ctx);

const units = vm.runInContext(`(()=>{
  const bySup = collectSupplierLines(null).bySup;
  const u = {};
  Object.keys(bySup).forEach(sid => bySup[sid].forEach(l => { u[sid + ':' + l.brand] = l.unit; }));
  return u;
})()`, ctx);

// 仲介手数料の基準額 = 定価×数量（listAmt）。2026-07-23 実請求書で「手数料=定価×2%」と確定
const listAmts = vm.runInContext(`(()=>{
  const bySup = collectSupplierLines(null).bySup;
  return (bySup['S0014']||[]).map(l => l.listAmt);
})()`, ctx);
if (!(listAmts.length === 2 && listAmts.every(v => v === 1000))) {
  throw new Error('listAmt(定価×数量) mismatch: ' + JSON.stringify(listAmts));
}

// 口座請求元の単価 = サロン仕入価格×57%切捨（2026-07-23 実請求書で確定）
const expect = {
  'S0014:ブランドA': 399,  // サロン価700×57% = 399（サロン価70%商品 = 旧39.9%と同値）
  'S0014:ブランドB': 370,  // サロン価650×57% = 370.5 → 370（サロン価65%商品）
  'S0015:ブランドB': 490   // 口座請求元以外は従来通り: 定価×率 round
};
const errors = Object.keys(expect).filter(k => units[k] !== expect[k])
  .map(k => `${k}: expected ${expect[k]}, got ${units[k]}`);
if (errors.length) throw new Error('unit mismatch\n' + errors.join('\n'));
console.log('pure broker rate split OK:', JSON.stringify(units));

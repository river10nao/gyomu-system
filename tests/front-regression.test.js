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
  localStorage: {
    getItem() { return ''; }, setItem() {}, removeItem() {}
  },
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

const monthCases = [
  ['2026/07/20', '2026/07'],
  ['2026/7/2', '2026/07'],
  ['2026-07-20T12:00:00', '2026/07'],
  ['未定', ''],
  ['5月', ''],
  ['2026/13/01', ''],
  ['2026/02/30', '']
];
for (const [value, expected] of monthCases) {
  const actual = vm.runInContext(`monthOf(${JSON.stringify(value)})`, ctx);
  if (actual !== expected) throw new Error(`monthOf ${value}: ${actual}`);
}

vm.runInContext(`
  render=()=>{};
  ALLOC={sel:{O0001:true},brand:null,conf:{},salons:{},result:{x:1},q:'',addOut:true,lastCommit:null};
  allocToggleOrder('O0001',false);
  if(ALLOC.addOut!==false) throw new Error('addOut remained on after selection change');
  if(Object.keys(ALLOC.result).length) throw new Error('stale allocation result remained');
`, ctx);

vm.runInContext(`NM={co:'自社',via:'経由先',spay:'',boxBrand:'',credit:''}`, ctx);
const label = vm.runInContext(`docDisplayLabel('経由先請求書①（前金）')`, ctx);
if (label !== '🔁 請求書①（自社→経由先・前金・97%）') {
  throw new Error(`document display label mismatch: ${label}`);
}

const stockHtml = vm.runInContext(`stockTable([
  {'商品ID':'','商品名':'','容量':'','残数':1,'在庫金額（税抜）':100},
  {'商品ID':'','商品名':'','容量':'','残数':2,'在庫金額（税抜）':200}
], 'empty')`, ctx);
if ((stockHtml.match(/rowspan="1"/g) || []).length !== 2 ||
    stockHtml.includes('rowspan="2"')) {
  throw new Error('empty stock rows were merged');
}

const warning = vm.runInContext(`allocFormUpdateWarning({
  formUpdateError:'更新失敗',formUpdateSkippedOrderIds:['O0002']
})`, ctx);
if (!warning.includes('更新失敗') || !warning.includes('O0002')) {
  throw new Error('allocation warning was not surfaced');
}

if (html.indexOf('if(!selIds.length) return html;') <
    html.indexOf('if(ALLOC.lastCommit)')) {
  throw new Error('completion card is placed after the early return');
}

console.log('front regression checks OK');

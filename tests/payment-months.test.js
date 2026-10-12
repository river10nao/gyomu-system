const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let raw = '';
process.stdin.on('data', chunk => raw += chunk);
process.stdin.on('end', () => {
  const response = JSON.parse(raw);
  if (!response.ok) throw new Error(response.error);
  const payload = response.data || {};
  const names = (payload.whoami && payload.whoami.names) || {};
  delete payload.whoami;

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
    location: {reload() {}},
    inputData: payload,
    inputNames: names
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  vm.runInContext('Object.assign(DB,inputData); NM=inputNames;', ctx);

  const result = vm.runInContext(`(()=>{
    const lines=Object.values(collectSupplierLines(null).bySup).flat();
    const make=monthFn=>{
      const out={};
      lines.forEach(line=>{
        const month=monthFn(line.date);
        const key=month||'（月なし）';
        out[key]=(out[key]||0)+num(line.amt);
      });
      return out;
    };
    const oldMonth=value=>String(value||'').replace(/-/g,'/').slice(0,7);
    return {lineCount:lines.length,oldTotals:make(oldMonth),newTotals:make(monthOf)};
  })()`, ctx);
  const same = JSON.stringify(result.oldTotals) === JSON.stringify(result.newTotals);
  console.log(JSON.stringify({...result, totalsUnchanged: same}, null, 2));
  if (!same) process.exitCode = 3;
});

import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
const root=process.cwd(),out=path.join(root,'.sites-runtime/shop-tests');
await fs.mkdir(out,{recursive:true});
for(const name of ['model','excel','validation']){
 const src=await fs.readFile(path.join(root,'app',name+'.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '\.\/model'/g,"from './model.mjs'");
 await fs.writeFile(path.join(out,name+'.mjs'),js);
}
const sql=new DatabaseSync(':memory:');
const migrations=(await fs.readdir(path.join(root,'drizzle'))).filter(s=>s.endsWith('.sql')).sort();
for(const file of migrations)sql.exec(await fs.readFile(path.join(root,'drizzle',file),'utf8'));
globalThis.__shopTestDb={
 prepare(query){
  return {bind(...values){
   return {
    async first(){return sql.prepare(query).get(...values)||null},
    async run(){return {meta:{changes:sql.prepare(query).run(...values).changes}}}
   };
  }};
 }
};
await fs.writeFile(path.join(out,'mock-env.mjs'),'export const env={DB:globalThis.__shopTestDb};');
const route=await fs.readFile(path.join(root,'app/api/state/route.ts'),'utf8');
await fs.writeFile(path.join(out,'route.mjs'),ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from 'cloudflare:workers'/g,"from './mock-env.mjs'").replace(/from '\.\.\/\.\.\/validation'/g,"from './validation.mjs'"));
const {emptyData,metrics,daysInMonth,sum}=await import(path.join(out,'model.mjs'));
const {dataSchema}=await import(path.join(out,'validation.mjs'));
const {reportSheets,createWorkbook}=await import(path.join(out,'excel.mjs'));
const {GET,PUT}=await import(path.join(out,'route.mjs'));
// Synthetic test records only; uploaded customer and transaction data are not bundled.
const month='2026-09',data=emptyData();
assert.deepEqual(data.employees,[]);assert.equal(data.expenses.length+data.strings.length+data.deposits.length,0);
assert(dataSchema.safeParse(data).success);
data.employees=['Nhân viên A','Nhân viên B'];
data.expenses=[{id:'expense-1',date:'2026-09-01',invoice:'',purpose:'Chi kiểm thử',detail:'',amount:20000},{id:'expense-2',date:'2026-09-01',invoice:'TEST-2',purpose:'Chi kiểm thử',detail:'',amount:30000}];
data.strings=[{date:'2026-09-01',counts:{'Nhân viên A':200,'Nhân viên B':249}}];
data.deposits=[100000,200000,300000].map((amount,i)=>({id:'test-deposit-'+i,customer:'Khách kiểm thử '+i,phone:'',product:'Sản phẩm kiểm thử',variant:'',quantity:1,date:'2026-08-10',amount,status:'Đang chờ',note:'',closedDate:''}));
data.budgets[month]=100000;
assert(dataSchema.safeParse(data).success);
let m=metrics(data,month);
assert.equal(m.spent,50000);assert.equal(m.expenses.length,2);assert.equal(m.racks,449);assert.equal(m.remaining,50000);assert.equal(m.held,600000);
assert.equal(m.rate,5000);assert.equal(m.totalPay,2245000);assert.equal(m.kpiRemaining,1);assert(!m.achieved);
assert.deepEqual(m.payroll.map(x=>x.amount),[1000000,1245000]);
assert.equal(daysInMonth('2026-09'),30);assert.equal(daysInMonth('2024-02'),29);assert.equal(daysInMonth('2026-02'),28);
const atKpi=structuredClone(data);atKpi.strings[0].counts['Nhân viên B']=250;
let k=metrics(atKpi,month);assert.equal(k.racks,450);assert.equal(k.rate,10000);assert.equal(k.totalPay,4500000);assert.equal(k.kpiRemaining,0);assert(k.achieved);assert.deepEqual(k.payroll.map(x=>x.amount),[2000000,2500000]);
const overKpi=structuredClone(atKpi);overKpi.strings.push({date:'2026-09-02',counts:{'Nhân viên A':1}});assert.equal(metrics(overKpi,month).totalPay,4510000);
const revised=structuredClone(atKpi);revised.strings[0].counts['Nhân viên B']=249;assert.equal(metrics(revised,month).rate,5000);
atKpi.strings.push({date:'2026-10-01',counts:{'Nhân viên A':1}});assert.equal(metrics(atKpi,'2026-10').rate,5000);assert.equal(metrics(atKpi,'2026-10').totalPay,5000);assert.equal(metrics(atKpi,month).rate,10000);
const zero=metrics(emptyData(),month);assert.equal(zero.rate,5000);assert.equal(zero.totalPay,0);assert.equal(zero.racks,0);
const changed=structuredClone(data);changed.expenses.push({id:'no-invoice',date:'2026-09-01',amount:60000,invoice:'',purpose:'Test',detail:''});
changed.deposits[0].status='Đã giao';changed.deposits[0].closedDate='2026-09-10';
changed.deposits[1].status='Đã hoàn cọc';changed.deposits[1].closedDate='2026-09-11';
let c=metrics(changed,month);assert.equal(c.spent,110000);assert.equal(c.remaining,-10000);assert.equal(c.held,300000);assert.equal(c.pending.length,1);
assert.equal(metrics(data,'2026-10').racks,0);assert.equal(metrics(data,'2026-10').held,600000);
const req=(method,body,user='owner-a',headers={})=>new Request('https://test.invalid/api/state',{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
assert.equal((await GET(req('GET',null,''))).status,401);
assert.equal((await PUT(req('PUT',{data,revision:0},''))).status,401);
assert.equal((await GET(req('GET'))).status,200);
assert.equal((await PUT(req('PUT',{data,revision:0}))).status,200);
assert.equal((await PUT(req('PUT',{data,revision:0}))).status,409);
assert.equal((await PUT(req('PUT',{data:changed,revision:1}))).status,200);
const loaded=await (await GET(req('GET'))).json();assert.equal(loaded.revision,2);assert.equal(metrics(loaded.data,month).remaining,-10000);
assert.equal((await (await GET(req('GET',null,'owner-b'))).json()).data,null);
assert.equal((await PUT(req('PUT',{data,revision:1}))).status,409);
assert.equal((await PUT(req('PUT',{data,revision:2},'owner-a',{'sec-fetch-site':'cross-site'}))).status,403);
const bad=structuredClone(data);bad.strings[0].date='2026-09-31';assert.equal((await PUT(req('PUT',{data:bad,revision:2}))).status,400);
const bad2=structuredClone(data);bad2.deposits[0].status='Đã giao';assert.equal((await PUT(req('PUT',{data:bad2,revision:2}))).status,400);
const bad3=structuredClone(data);bad3.expenses[0].amount=-1;assert(!dataSchema.safeParse(bad3).success);
// Internal receipts may have document codes but never count as customer-order invoices.
const classified=structuredClone(data);
classified.expenses[0].category='Chi theo đơn hàng';
classified.expenses[1].category='Mua dụng cụ';
classified.expenses.push({id:'gas',date:'2026-09-02',category:'Hỗ trợ tiền xăng',invoice:'GAS-RECEIPT',transferCode:'',salesOrderCode:'',purpose:'Test',detail:'',amount:15000,evidence:[]});
classified.expenses.push({id:'internal-other',date:'2026-09-02',category:'Chi nội bộ khác',invoice:'',transferCode:'',salesOrderCode:'',purpose:'Test',detail:'',amount:10000,evidence:[]});
classified.expenses.push({id:'unknown',date:'2026-09-02',invoice:'UNKNOWN-CODE',purpose:'Test',detail:'',amount:5000});
const classifiedNormalized=dataSchema.parse(classified),cm=metrics(classifiedNormalized,month);
assert.equal(cm.spent,80000);assert.equal(cm.remaining,20000);assert.equal(cm.invoiceCount,1);assert.equal(cm.orderSpent,20000);assert.equal(cm.internalSpent,55000);assert.equal(cm.internalExpenses.length,3);assert.equal(cm.unclassifiedSpent,5000);assert.equal(cm.unclassifiedExpenses.length,1);assert.equal(cm.spent,cm.orderSpent+cm.internalSpent+cm.unclassifiedSpent);
assert.equal(classifiedNormalized.expenses[4].category,'Chưa phân loại');assert.equal(metrics(classifiedNormalized,'2026-10').invoiceCount,0);
const recategorized=structuredClone(classifiedNormalized);recategorized.expenses[2].category='Chi theo đơn hàng';assert.equal(metrics(recategorized,month).invoiceCount,2);assert.equal(metrics(recategorized,month).spent,80000);
const invalidCategory=structuredClone(classifiedNormalized);invalidCategory.expenses[0].category='Invalid';assert(!dataSchema.safeParse(invalidCategory).success);
assert.equal((await PUT(req('PUT',{data:classifiedNormalized,revision:2}))).status,200);
const restored=await (await GET(req('GET'))).json();assert.equal(metrics(restored.data,month).invoiceCount,1);assert.equal(restored.data.expenses[1].category,'Mua dụng cụ');
const classifiedSheets=reportSheets(classifiedNormalized,month),classifiedExpense=classifiedSheets.find(x=>x.name==='Quỹ chi');
const invSummary=classifiedExpense.rows.find(r=>r[5]==='Số hóa đơn đã chi');assert.equal(invSummary[6].v,1);assert.equal(invSummary[6].f,'COUNTIF(H5:H9,"Chi theo đơn hàng")');assert.equal(invSummary[6].s,0);
assert.equal(classifiedExpense.rows.find(r=>r[5]==='Tổng chi nội bộ')[6].v,55000);assert.equal(classifiedExpense.rows.find(r=>r[5]==='Tổng tiền đã chi')[6].v,80000);assert.equal(classifiedExpense.rows[3][7],'Phân loại khoản chi');assert.equal(classifiedExpense.rows[3][8],'Ảnh bằng chứng');
await fs.writeFile(path.join(out,'category-test.xlsx'),new Uint8Array(await createWorkbook(classifiedSheets).arrayBuffer()));
const sheets=reportSheets(data,month);assert.equal(sheets.length,4);
const salarySheet=sheets.find(s=>s.name==='Đan vợt');
assert.equal(salarySheet.rows.find(r=>r[0]==='Đơn giá (VNĐ/cây)')[1].v,5000);
assert.equal(salarySheet.rows.find(r=>r[0]==='Tổng tiền công')[3].v,2245000);
assert.equal(salarySheet.rows.find(r=>r[0]==='Tổng tiền công')[3].f,'SUM(D41:D42)');
assert.equal(salarySheet.rows.find(r=>r[0]==='Đơn giá (VNĐ/cây)')[1].f,'IF(B38>=B37,10000,5000)');
assert.equal(reportSheets(atKpi,month,'stringing')[0].rows.find(r=>r[0]==='Tổng tiền công')[3].v,4500000);
assert.equal(reportSheets(data,'2026-10','deposits')[0].rows.filter(r=>typeof r[0]==='number').length,3);
assert.equal(reportSheets(changed,'2026-10','deposits')[0].rows.filter(r=>typeof r[0]==='number').length,1);
assert(!JSON.stringify(reportSheets(emptyData(),'2026-02')).includes('SUM(B5:A5)'));
await fs.writeFile(path.join(out,'report-test.xlsx'),new Uint8Array(await createWorkbook(sheets).arrayBuffer()));
for(const scope of ['expenses','stringing','deposits'])await fs.writeFile(path.join(out,scope+'-test.xlsx'),new Uint8Array(await createWorkbook(reportSheets(data,month,scope)).arrayBuffer()));
for(const [key,d]of [['empty',emptyData()],['kpi450',atKpi],['kpi451',overKpi]])await fs.writeFile(path.join(out,key+'-test.xlsx'),new Uint8Array(await createWorkbook(reportSheets(d,key==='empty'?'2026-02':month)).arrayBuffer()));
const source=await fs.readFile(path.join(root,'app/page.tsx'),'utf8');assert(!source.includes('seed.json'));assert(!source.includes('fromSeed'));assert(!source.includes('Huy Anh'));assert(source.includes('useState<ShopData>(emptyData)'));
console.log('PASS: blank initialization, KPI 0/449/450/451, per-employee payroll, whole-month rate, edits below threshold, month isolation, cash/deposit separation, server validation, account isolation, conflicts, XLSX payroll formulas, expense categories, invoice count exclusion, legacy unclassified data and category roundtrip.');

import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=process.cwd(),out=path.join(root,'.sites-runtime/shop-tests');
await fs.mkdir(out,{recursive:true});
// The same handlers run against a private in-memory object store; no real customer photos.
const objects=new Map();
globalThis.__evidenceTestEnv={BUCKET:{
 async put(key,bytes,metadata){objects.set(key,{bytes,metadata})},
 async get(key){const v=objects.get(key);return v?{body:v.bytes,httpMetadata:v.metadata.httpMetadata}:null}
}};
await fs.writeFile(path.join(out,'evidence-env.mjs'),'export const env=globalThis.__evidenceTestEnv;');
for(const [source,target]of [['app/api/evidence/shared.ts','evidence-shared'],['app/api/evidence/route.ts','evidence-upload'],['app/api/evidence/[id]/route.ts','evidence-read']]){
 const src=await fs.readFile(path.join(root,source),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from 'cloudflare:workers'/g,"from './evidence-env.mjs'").replace(/from '(?:\.\.\/|\.\/)shared'/g,"from './evidence-shared.mjs'");
 await fs.writeFile(path.join(out,target+'.mjs'),js);
}
const {POST}=await import(path.join(out,'evidence-upload.mjs'));
const {GET}=await import(path.join(out,'evidence-read.mjs'));
const {imageType,evidenceKey}=await import(path.join(out,'evidence-shared.mjs'));
const pixel=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5r8AAAAASUVORK5CYII=','base64'));
assert.equal(imageType(pixel),'image/png');assert.equal(imageType(new TextEncoder().encode('<svg/>')),null);
assert.equal(imageType(Uint8Array.of(255,216,255,240)),'image/jpeg');
assert.notEqual(await evidenceKey('a','file'),await evidenceKey('b','file'));
const upload=(user,bytes=pixel,headers={})=>{const body=new FormData();body.set('file',new Blob([bytes],{type:'image/png'}),'receipt.png');return POST(new Request('https://test.invalid/api/evidence',{method:'POST',headers:{...(user?{'oai-authenticated-user-id':user}:{}),...headers},body}))};
assert.equal((await upload('')).status,401);
assert.equal((await upload('a',pixel,{'sec-fetch-site':'cross-site'})).status,403);
assert.equal((await upload('a',new TextEncoder().encode('<svg/>'))).status,400);
assert.equal((await upload('a',new Uint8Array(2*1024*1024+1))).status,413);
const result=await upload('a');assert.equal(result.status,201);const photo=await result.json();assert.equal(photo.type,'image/png');assert.equal(photo.size,pixel.length);
const context={params:Promise.resolve({id:photo.id})};
const request=user=>new Request('https://test.invalid/api/evidence/'+photo.id,{headers:user?{'oai-authenticated-user-id':user}:{}});
assert.equal((await GET(request(''),context)).status,401);
assert.equal((await GET(request('b'),context)).status,404);
const visible=await GET(request('a'),context);assert.equal(visible.status,200);assert.equal(visible.headers.get('Cache-Control'),'private, no-store');assert.equal(visible.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await visible.arrayBuffer()),pixel);
assert.equal((await GET(request('a'),{params:Promise.resolve({id:'../other'})})).status,404);
// Validate old records are upgraded with empty optional fields and no invented category.
const {dataSchema}=await import(path.join(out,'validation.mjs'));
const old={schemaVersion:1,employees:[],expenses:[{id:'old-expense',date:'2026-09-01',invoice:'OLD-SHIP',purpose:'Test',detail:'',amount:10000}],strings:[],deposits:[{id:'old-deposit',customer:'Test',phone:'',product:'Test',variant:'',quantity:1,date:'2026-09-01',amount:10000,status:'Đang chờ',note:'',closedDate:''}],budgets:{}};
const normalized=dataSchema.parse(old);assert.deepEqual(normalized.expenses[0].evidence,[]);assert.equal(normalized.expenses[0].transferCode,'');assert.equal(normalized.deposits[0].category,'Khác');assert.equal(normalized.deposits[0].contactPlatform,'');
const newer=structuredClone(normalized);newer.expenses[0].evidence=[photo];newer.expenses[0].transferCode='TRANSFER-1';newer.expenses[0].salesOrderCode='SALE-1';newer.deposits[0].category='Giày';newer.deposits[0].contactPlatform='Zalo';newer.deposits[0].contactHandle='Tài khoản kiểm thử';assert(dataSchema.safeParse(newer).success);
for(const category of ['Vợt','Giày','Balo','Phụ kiện','Quần áo']){newer.deposits[0].category=category;assert(dataSchema.safeParse(newer).success)}
const tooMany=structuredClone(newer);tooMany.expenses[0].evidence=Array.from({length:4},()=>({...photo,id:crypto.randomUUID()}));assert(!dataSchema.safeParse(tooMany).success);
const {reportSheets,createWorkbook}=await import(path.join(out,'excel.mjs'));
const sheets=reportSheets(newer,'2026-09'),expense=sheets.find(s=>s.name==='Quỹ chi'),deposit=sheets.find(s=>s.name==='Khách cọc');
assert.equal(expense.rows[4][1],'OLD-SHIP');assert.equal(expense.rows[4][2],'TRANSFER-1');assert.equal(expense.rows[4][3],'SALE-1');assert.equal(deposit.rows[4][3],'Zalo');assert.equal(deposit.rows[4][5],'Quần áo');
expense.images=[{row:4,col:8,offsetX:5,width:76,height:76,bytes:pixel,format:'png'}];
await fs.writeFile(path.join(out,'evidence-test.xlsx'),new Uint8Array(await createWorkbook(sheets).arrayBuffer()));
console.log('PASS: image upload/type/size validation, private storage/read, account isolation, old backup compatibility, categories/contact fields, 3 order codes, attachment limit, XLSX image drawing.');

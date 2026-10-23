import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {dataSchema} from './dist/server/validation.mjs';

const directory=resolve(process.env.DATA_DIR||'data');mkdirSync(directory,{recursive:true});
const db=new DatabaseSync(resolve(directory,'shop.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL); CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL)');
mkdirSync(resolve(directory,'photos'),{recursive:true});
const username=process.env.SHOP_USERNAME||'thanh';
const hash=process.env.SHOP_PASSWORD_HASH||'';
if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash))throw Error('Cần SHOP_PASSWORD_HASH hợp lệ. Chạy npm run password.');
const production=process.env.NODE_ENV==='production';
const origin=process.env.APP_ORIGIN;
if(production&&(!origin||!origin.startsWith('https://')))throw Error('APP_ORIGIN phải là địa chỉ HTTPS chính thức.');
const digest=s=>createHash('sha256').update(s).digest('hex');
const cookie=(v,age)=>`shop_session=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${production?'; Secure':''}`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
function reply(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY',...headers});res.end(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value))}
async function body(req,max){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>max){const e=Error('Dữ liệu quá lớn');e.status=413;throw e}chunks.push(c)}return Buffer.concat(chunks)}
function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('shop_session='))?.slice(13);return token&&db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(digest(token),Date.now())?.token}
function sameOrigin(req){const requestOrigin=req.headers.origin;return req.headers['sec-fetch-site']!=='cross-site'&&(!requestOrigin||requestOrigin===(origin||`http://${req.headers.host}`))}
function loginPage(message=''){return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập · Sổ Shop</title><style>body{font:16px Arial;background:#f7f8f5;color:#273c32;display:grid;place-items:center;min-height:95vh}form{background:white;padding:36px;border:1px solid #e7ebe3;border-radius:16px;width:min(340px,80vw)}input,button{box-sizing:border-box;width:100%;padding:13px;margin:8px 0 18px;border:1px solid #ccd6cc;border-radius:8px;font:inherit}button{background:#28634c;color:white;cursor:pointer}p{line-height:1.6}small{color:#9d342d}</style><form method="post" action="/login"><h1>Sổ Shop</h1><p>Quản lý quỹ chi, đan vợt và khách đặt cọc.</p><label>Tài khoản<input name="username" autocomplete="username" required maxlength="100"></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><small>${message}</small><button>Đăng nhập</button></form></html>`}
export const server=http.createServer(async(req,res)=>{
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&path==='/health')return reply(res,200,{ok:true});
 if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req))return reply(res,403,{error:'Yêu cầu không hợp lệ.'});
 if(path==='/login'&&req.method==='GET')return reply(res,200,loginPage(),{'Content-Type':'text/html; charset=utf-8'});
 if(path==='/login'&&req.method==='POST'){
  // Global and per-address limits are persistent; untrusted forwarded headers are ignored.
  const keys=['global',req.socket.remoteAddress||'unknown'];const now=Date.now();
  for(const key of keys){const a=db.prepare('SELECT count,until_at FROM attempts WHERE key=?').get(key);if(a&&a.until_at>now&&a.count>=(key==='global'?100:10))return reply(res,429,loginPage('Thử lại sau 15 phút.'),{'Content-Type':'text/html; charset=utf-8'});}
  const form=new URLSearchParams((await body(req,4096)).toString());const [salt,expected]=hash.split(':');
  const pass=form.get('password')||'';const valid=pass.length<=256&&timingSafeEqual(scryptSync(pass,salt,64),Buffer.from(expected,'hex'))&&(form.get('username')===username);
  if(!valid){for(const key of keys)db.prepare('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until_at<? THEN 1 ELSE count+1 END, until_at=CASE WHEN until_at<? THEN excluded.until_at ELSE until_at END').run(key,now+900000,now,now);return reply(res,401,loginPage('Tài khoản hoặc mật khẩu chưa đúng.'),{'Content-Type':'text/html; charset=utf-8'});}
  db.prepare('DELETE FROM sessions WHERE expires<?').run(now);const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?)').run(digest(token),now+43200000);return reply(res,303,'',{'Location':'/','Set-Cookie':cookie(token,43200)});
 }
 const auth=session(req);
 if(!auth){if(path.startsWith('/api/'))return reply(res,401,{error:'Vui lòng đăng nhập để mở sổ.'});return reply(res,303,'',{'Location':'/login'});}
 if(path==='/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(auth);return reply(res,303,'',{'Location':'/login','Set-Cookie':cookie('',0)});}
 if(path==='/api/state'&&req.method==='GET'){const row=db.prepare('SELECT * FROM state WHERE id=1').get();return reply(res,200,row?{data:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated}:{data:null,revision:0});}
 if(path==='/api/state'&&req.method==='PUT'){
  let input;try{input=JSON.parse((await body(req,4_000_000)).toString())}catch(e){if(e.status)throw e;return reply(res,400,{error:'JSON không hợp lệ.'})}
  const parsed=dataSchema.safeParse(input.data);if(!parsed.success||!Number.isInteger(input.revision)||input.revision<0)return reply(res,400,{error:'Dữ liệu không hợp lệ.'});
  for(const expense of parsed.data.expenses)for(const photo of expense.evidence)if(!db.prepare('SELECT id FROM photos WHERE id=?').get(photo.id))return reply(res,400,{error:'Ảnh chứng từ chưa có trên máy chủ này. Nhập bản sao lưu kèm ảnh đầy đủ trước.'});
  const updatedAt=new Date().toISOString();const payload=JSON.stringify(parsed.data);
  const result=input.revision===0?db.prepare('INSERT INTO state VALUES (1,1,?,?) ON CONFLICT(id) DO NOTHING').run(payload,updatedAt):db.prepare('UPDATE state SET revision=revision+1,payload=?,updated=? WHERE id=1 AND revision=?').run(payload,updatedAt,input.revision);
  if(!result.changes)return reply(res,409,{error:'Dữ liệu đã đổi ở tab hoặc thiết bị khác. Tải lại trước khi sửa tiếp.'});return reply(res,200,{revision:input.revision+1,updatedAt});
 }
 if(path==='/api/evidence'&&req.method==='POST'){
  const bytes=await body(req,2*1024*1024+8192);let form;try{form=await new Request('http://local',{method:'POST',headers:{'content-type':req.headers['content-type']||''},body:bytes}).formData()}catch{return reply(res,400,{error:'Tệp tải lên không hợp lệ.'})}
  const file=form.get('file');if(!(file instanceof File)||file.size<1||file.size>2*1024*1024)return reply(res,400,{error:'Ảnh phải từ 1 byte đến 2 MB.'});
  const b=Buffer.from(await file.arrayBuffer());const type=b.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!type)return reply(res,400,{error:'Chỉ nhận JPG, PNG hoặc WebP.'});const id=randomUUID(),name=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,120)||'anh.jpg';
  writeFileSync(resolve(directory,'photos',id),b,{flag:'wx'});db.prepare('INSERT INTO photos VALUES (?,?,?)').run(id,name,type);return reply(res,201,{id,name,type,size:b.length});
 }
 if(path.startsWith('/api/evidence/')&&req.method==='GET'){const id=path.slice(14);if(!/^[a-f0-9-]{36}$/i.test(id))return reply(res,404,{error:'Không tìm thấy ảnh.'});const photo=db.prepare('SELECT * FROM photos WHERE id=?').get(id);if(!photo)return reply(res,404,{error:'Không tìm thấy ảnh.'});return reply(res,200,readFileSync(resolve(directory,'photos',id)),{'Content-Type':photo.type});}
 if(path.startsWith('/api/'))return reply(res,404,{error:'Không tìm thấy chức năng.'});
 if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Phương thức không được hỗ trợ.'});
 const root=resolve('dist/client'),file=resolve(root,'.'+decodeURIComponent(path));if(file!==root&&!file.startsWith(root+'/'))return reply(res,404,{error:'Không tìm thấy trang.'});
 const target=path==='/'?resolve(root,'index.html'):file;if(!existsSync(target))return reply(res,404,{error:'Không tìm thấy trang.'});
 res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(req.method==='HEAD'?undefined:readFileSync(target));
 }catch(e){if(!res.headersSent)reply(res,e.status||500,{error:e.status===413?'Dữ liệu quá lớn.':'Không thực hiện được. Vui lòng thử lại.'});else res.end();}
});
if(process.env.SHOP_TEST!=='1')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Sổ Shop đã sẵn sàng.'));

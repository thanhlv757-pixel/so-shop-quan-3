import { env } from 'cloudflare:workers';
import { dataSchema } from '../../validation';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function owner(request:Request){return request.headers.get('oai-authenticated-user-id')}
export async function GET(request:Request){
 const user=owner(request); if(!user)return reply({error:'Vui lòng đăng nhập ChatGPT để mở dữ liệu của bạn.'},401);
 try{const row=await env.DB!.prepare('SELECT revision, payload, updated_at FROM shop_state WHERE owner = ?').bind(user).first<{revision:number,payload:string,updated_at:string}>();
 return reply(row?{data:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at}:{data:null,revision:0});
 }catch{return reply({error:'Chưa kết nối được kho dữ liệu. Thử lại sau.'},503)}
}
export async function PUT(request:Request){
 const user=owner(request);if(!user)return reply({error:'Phiên đăng nhập đã hết. Hãy đăng nhập lại trước khi lưu.'},401);
 if(request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Yêu cầu không hợp lệ.'},403);
 try{
  const raw=await request.text();if(raw.length>4_000_000)return reply({error:'Dữ liệu quá lớn. Vui lòng chia nhỏ bản nhập.'},413);
  const body=JSON.parse(raw), parsed=dataSchema.safeParse(body.data);
  if(!parsed.success)return reply({error:parsed.error.issues[0]?.message||'Dữ liệu không hợp lệ.'},400);
  if(!Number.isInteger(body.revision)||body.revision<0)return reply({error:'Phiên bản dữ liệu không hợp lệ.'},400);
  const updatedAt=new Date().toISOString(),payload=JSON.stringify(parsed.data);
  const result=body.revision===0
   ?await env.DB!.prepare('INSERT INTO shop_state (owner, revision, payload, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(owner) DO NOTHING').bind(user,payload,updatedAt).run()
   :await env.DB!.prepare('UPDATE shop_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE owner = ? AND revision = ?').bind(payload,updatedAt,user,body.revision).run();
  if(!result.meta.changes)return reply({error:'Dữ liệu đã đổi ở tab hoặc thiết bị khác. Tải lại dữ liệu trước khi chỉnh sửa tiếp.'},409);
  return reply({revision:body.revision+1,updatedAt});
 }catch{return reply({error:'Không lưu được dữ liệu. Thay đổi chưa được ghi nhận; hãy thử lại.'},503)}
}

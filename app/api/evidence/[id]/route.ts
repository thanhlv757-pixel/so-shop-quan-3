import { env } from 'cloudflare:workers';
import { evidenceKey,json } from '../shared';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
async function identity(request:Request,context:Context){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return {error:json({error:'Đăng nhập để xem ảnh.'},401)};
 const {id}=await context.params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return {error:json({error:'Ảnh không tồn tại.'},404)};
 return {user,id,key:await evidenceKey(user,id)};
}
export async function GET(request:Request,context:Context){
 const identityResult=await identity(request,context);if(identityResult.error)return identityResult.error;
 try{const object=await env.BUCKET!.get(identityResult.key!);if(!object)return json({error:'Không tìm thấy ảnh bằng chứng.'},404);
  return new Response(object.body as BodyInit,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
 }catch{return json({error:'Chưa tải được ảnh.'},503)}
}
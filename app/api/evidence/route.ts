import { env } from 'cloudflare:workers';
import { evidenceKey,imageType,json,maxImageSize } from './shared';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Đăng nhập để thêm ảnh.'},401);
 if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Yêu cầu không hợp lệ.'},403);
 if(Number(request.headers.get('content-length')||0)>maxImageSize+8192)return json({error:'Ảnh tối đa 2 MB sau tối ưu.'},413);
 try{
  if(!env.BUCKET)return json({error:'Kho ảnh chưa sẵn sàng. Thử lại sau.'},503);
  // Bound the stream before parsing multipart data to avoid unbounded request buffering.
  const reader=request.body?.getReader();if(!reader)return json({error:'Chưa chọn ảnh.'},400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>maxImageSize+8192){await reader.cancel();return json({error:'Ảnh tối đa 2 MB sau tối ưu.'},413)}chunks.push(r.value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const multipart=new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes});
  const form=await multipart.formData(),file=form.get('file');
  if(!(file instanceof File)||file.size<1)return json({error:'Chọn một tệp ảnh hợp lệ.'},400);
  if(file.size>maxImageSize)return json({error:'Ảnh tối đa 2 MB sau tối ưu.'},413);
  const content=new Uint8Array(await file.arrayBuffer()),type=imageType(content);
  if(!type)return json({error:'Chỉ nhận ảnh JPG, PNG hoặc WebP.'},400);
  const id=crypto.randomUUID(),name=(file.name.replace(/[\x00-\x1f\/\\]/g,'_').slice(0,120)||'bang-chung.jpg');
  await env.BUCKET.put(await evidenceKey(user,id),content,{httpMetadata:{contentType:type},customMetadata:{name}});
  return json({id,name,type,size:content.length},201);
 }catch{return json({error:'Không tải được ảnh. Hãy chọn lại hoặc thử lại.'},503)}
}

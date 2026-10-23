import type { Evidence } from './model';
export async function resizeImage(source:Blob,maxWidth=1600,maxHeight=1600,quality=.86):Promise<{blob:Blob,width:number,height:number}>{
 const bitmap=await createImageBitmap(source);
 try{const scale=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh.');
  context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Không xử lý được ảnh.')),'image/jpeg',quality));
  return {blob,width,height};
 }finally{bitmap.close()}
}
export async function uploadEvidence(file:File):Promise<Evidence>{
 if(file.size>12*1024*1024)throw new Error('Ảnh gốc tối đa 12 MB.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Chọn ảnh JPG, PNG hoặc WebP.');
 const {blob}=await resizeImage(file);if(blob.size>2*1024*1024)throw new Error('Ảnh vẫn quá lớn. Vui lòng chọn ảnh nhỏ hơn.');
 const body=new FormData();body.set('file',blob,file.name.replace(/\.[^.]*$/,'').slice(0,100)+'.jpg');
 const response=await fetch('/api/evidence',{method:'POST',body});const result:any=await response.json();if(!response.ok)throw new Error(result.error||'Không tải được ảnh.');return result;
}

export const MAX_PHOTO_LENGTH=180000;
export async function preparePhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw new Error('Chọn ảnh JPG, PNG hoặc WebP. Nếu ảnh là HEIC, hãy xuất thành JPG trước.');
 if(file.size>8*1024*1024)throw new Error('Ảnh gốc cần nhỏ hơn 8 MB.');
 const url=URL.createObjectURL(file);
 try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Không đọc được ảnh trên trình duyệt này. Nếu là HEIC/HEIF, hãy xuất thành JPG rồi chọn lại.'));img.src=url});
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Trình duyệt không xử lý được ảnh.');const side=Math.min(img.naturalWidth,img.naturalHeight);if(side<=0)throw new Error('Ảnh không hợp lệ.');ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);const data=canvas.toDataURL('image/jpeg',.82);if(data.length>MAX_PHOTO_LENGTH)throw new Error('Ảnh sau xử lý vẫn quá lớn. Hãy chọn ảnh đơn giản hơn.');return data;
 }finally{URL.revokeObjectURL(url)}
}

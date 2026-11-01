export function selectReport(sessions:any[],reportId:string){const sorted=[...sessions].sort((a,b)=>String(b.data.date).localeCompare(String(a.data.date)));return sorted.find(s=>s.id===reportId)||sorted.find(s=>s.data.status==='final')||sorted[0]}
export async function createReportPdf(rows:any[],render:(rows:any[],label:string,offset:number)=>HTMLCanvasElement){
 const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.create();const count=Math.max(1,Math.ceil(rows.length/25));
 for(let i=0;i<count;i++){const canvas=render(rows.slice(i*25,(i+1)*25),`· Trang ${i+1}/${count}`,i*25);const image=await pdf.embedJpg(canvas.toDataURL('image/jpeg',.95));const page=pdf.addPage([595.28,841.89]);const width=555.28,height=image.height*width/image.width;page.drawImage(image,{x:20,y:821.89-height,width,height})}
 return new Uint8Array(await pdf.save());
}

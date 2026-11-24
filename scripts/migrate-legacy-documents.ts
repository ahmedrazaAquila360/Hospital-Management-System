import "dotenv/config";
import path from "node:path";
import {readFile} from "node:fs/promises";
import {basePrisma as prisma} from "../src/lib/prisma-base";
import {saveUploadedFile, MAX_UPLOAD_BYTES} from "../src/lib/storage";
async function main() {
 const rows=await prisma.document.findMany({where:{NOT:{OR:[{fileUrl:{startsWith:'private:'}},{fileUrl:{startsWith:'r2:'}}]}},select:{id:true,fileUrl:true,mimeType:true,branchId:true}});
 console.log(`${rows.length} legacy document(s) need migration.`);
 if(process.env.RUN_LEGACY_DOCUMENT_MIGRATION!=='1') {console.log('Dry run only. Set RUN_LEGACY_DOCUMENT_MIGRATION=1 after reviewing source ownership.');return;}
 const allowed=new Set((process.env.HOSPITAL_LEGACY_DOCUMENT_HOSTS??'').split(',').filter(Boolean));
 for(const row of rows) {
  let bytes:Buffer;
  if(row.fileUrl.startsWith('/uploads/')) {
   const root=path.resolve('public/uploads');const file=path.resolve('public','.'+row.fileUrl);
   if(!file.startsWith(root+path.sep))throw Error('Invalid local document path');bytes=await readFile(file);
  } else {
   const url=new URL(row.fileUrl);
   if(url.protocol!=='https:'||url.username||url.password||!allowed.has(url.hostname))throw Error('Legacy source hostname is not explicitly allowed');
   const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok||!response.body)throw Error('Legacy file unavailable');
   const chunks:Uint8Array[]=[];let size=0;
   const reader=response.body.getReader();
   try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_UPLOAD_BYTES)throw Error('Legacy document exceeds size limit');chunks.push(value);} }
   finally {await reader.cancel();reader.releaseLock();}
   bytes=Buffer.concat(chunks);
  }
  const saved=await saveUploadedFile(new File([new Uint8Array(bytes)],'legacy',{type:row.mimeType}),'documents');
  await prisma.$transaction(async tx=>{
   await tx.document.update({where:{id:row.id,fileUrl:row.fileUrl},data:{fileUrl:saved,fileSize:bytes.length}});
   await tx.activityLog.create({data:{branchId:row.branchId,action:'MIGRATE_PRIVATE_STORAGE',entityType:'Document',entityId:row.id}});
  });
  console.log('Migrated one document to private storage.');
 }
 console.log('Verify private access and arrange revocation of legacy public copies with their storage owner. Original DentalHub files were not changed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());

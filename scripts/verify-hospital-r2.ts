import "dotenv/config";
import assert from "node:assert/strict";
import { createDocumentUpload, finalizeDocumentUpload, documentDownloadUrl, deleteDocumentObject, isR2Configured } from "../src/lib/r2";
async function main() {
 if(!isR2Configured()) throw new Error('Configure hospital R2 credentials in the secure environment before running this check.');
 const origin=process.env.HOSPITAL_APP_ORIGIN;
 if(!origin || new URL(origin).origin!==origin) throw new Error('Set HOSPITAL_APP_ORIGIN to the exact deployed application origin.');
 const upload=await createDocumentUpload('synthetic-storage-check.pdf','application/pdf','storage-verification');
 let finalKey: string|undefined;
 try {
  const preflight=await fetch(upload.url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type'}});
  assert(preflight.ok,'Upload CORS preflight failed');
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin,'CORS must allow the configured application origin explicitly');
  const bytes=Buffer.from('%PDF-1.4\n% Synthetic storage verification only\n%%EOF');
  const put=await fetch(upload.url,{method:'PUT',headers:{'Content-Type':'application/pdf',Origin:origin},body:bytes});assert(put.ok,'Signed upload failed');
  const saved=await finalizeDocumentUpload(upload.key,'storage-verification');finalKey=saved.key;
  const url=await documentDownloadUrl(saved.key,'synthetic-storage-check.pdf',true);
  const downloaded=await fetch(url);assert(downloaded.ok,'Signed download failed');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
  const unsigned=new URL(url);unsigned.search='';assert([401,403].includes((await fetch(unsigned)).status),'Unsigned object unexpectedly accessible');
  await assert.rejects(finalizeDocumentUpload(upload.key,'other-user'));
  console.log('R2 signed upload, CORS, finalization, signed download, unsigned denial and ownership rejection passed.');
 } finally {await deleteDocumentObject(upload.key);if(finalKey)await deleteDocumentObject(finalKey);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

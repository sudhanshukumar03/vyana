import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'crypto';
import type {Pool} from 'pg';
import type {z} from 'zod';
import type {reportResponseSchema,reportSchema} from './schemas';
import {HttpError} from './auth';
import {transaction} from './db';

type Document=z.infer<typeof reportSchema>;
type ReportResponse=z.infer<typeof reportResponseSchema>;
export function reportStorage(pool:Pool,secret:string) {
  const key=createHash('sha256').update('vyana-saved-reports:'+secret).digest();
  const seal=(owner:number,id:string,purpose:string,value:unknown)=>{
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from(`${owner}:${id}:${purpose}`));
    return Buffer.concat([iv,cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
  };
  const open=<T>(owner:number,id:string,purpose:string,value:string):T=>{
    const bytes=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    cipher.setAAD(Buffer.from(`${owner}:${id}:${purpose}`));cipher.setAuthTag(bytes.subarray(-16));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString('utf8')) as T;
  };
  async function row(owner:number,id:string) {
    const found=(await pool.query('SELECT * FROM saved_reports WHERE id=$1 AND user_id=$2',[id,owner])).rows[0];
    if(!found)throw new HttpError(404,'Report not found');return found;
  }
  return {
    async ensureCapacity(owner:number,bytes:number) {
      const quota=(await pool.query('SELECT COUNT(*)::int AS count,COALESCE(SUM(size_bytes),0)::int AS bytes FROM saved_reports WHERE user_id=$1',[owner])).rows[0];
      if(quota.count>=20||quota.bytes+bytes>80*1048576)throw new HttpError(409,'Report storage is full (20 files or 80 MiB). Remove a saved report before uploading.');
    },
    async list(owner:number) {
      const {rows}=await pool.query('SELECT id,encrypted_metadata FROM saved_reports WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[owner]);
      return rows.map(r=>open<Record<string,unknown>>(owner,r.id,'metadata',r.encrypted_metadata));
    },
    async get(owner:number,id:string,includeFile=false) {
      const r=await row(owner,id),metadata=open<Record<string,unknown>>(owner,id,'metadata',r.encrypted_metadata);
      return includeFile?{...metadata,base64:open<Document>(owner,id,'document',r.encrypted_document).data_base64}:metadata;
    },
    async document(owner:number,id:string) {const r=await row(owner,id);return open<Document>(owner,id,'document',r.encrypted_document);},
    async save(owner:number,input:Document,analysis:ReportResponse,existingId?:string) {
      const id=existingId??randomUUID();
      const size=Buffer.from(input.data_base64,'base64').length;
      const metadata={id,filename:input.filename,mimeType:input.mime_type,uploadedAt:new Date().toISOString().slice(0,10),
        size:`${(size/1048576).toFixed(1)} MB`,status:analysis.source==='gemini'&&!analysis.offline&&analysis.document_status==='readable'?'reviewed':'pending',
        summary:analysis.summary,doctorQuestions:analysis.discussion_points,sections:analysis.sections,documentStatus:analysis.document_status,analysis};
      await transaction(pool,async client=>{
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner]);
        if(existingId) {
          const previous=(await client.query('SELECT created_at FROM saved_reports WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,owner])).rows[0];
          if(!previous)throw new HttpError(404,'Report was deleted while review was running.');
          metadata.uploadedAt=previous.created_at.toISOString().slice(0,10);
        }
        const quota=(await client.query('SELECT COUNT(*)::int AS count,COALESCE(SUM(size_bytes),0)::int AS bytes FROM saved_reports WHERE user_id=$1 AND id!=$2',[owner,id])).rows[0];
        if(quota.count>=20||quota.bytes+size>80*1048576)throw new HttpError(409,'Report storage is full (20 files or 80 MiB). Remove a saved report before uploading.');
        await client.query(`INSERT INTO saved_reports(id,user_id,encrypted_metadata,encrypted_document,size_bytes) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(id) DO UPDATE SET encrypted_metadata=EXCLUDED.encrypted_metadata WHERE saved_reports.user_id=EXCLUDED.user_id`,
          [id,owner,seal(owner,id,'metadata',metadata),seal(owner,id,'document',input),size]);
      });return metadata;
    },
    async remove(owner:number,id:string) {
      const r=await pool.query('DELETE FROM saved_reports WHERE user_id=$1 AND id=$2',[owner,id]);
      if(!r.rowCount)throw new HttpError(404,'Report not found');
    },
  };
}

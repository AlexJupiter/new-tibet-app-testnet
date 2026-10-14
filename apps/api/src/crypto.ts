import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
export const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export function vault(key:string){
 const k=Buffer.from(key,'base64');if(k.length!==32)throw new Error('Invalid encryption key');
 return {encrypt(data:Buffer|string,context:string){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',k,iv);c.setAAD(Buffer.from(context));const body=Buffer.concat([c.update(data),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');},decrypt(value:string,context:string){const b=Buffer.from(value,'base64');const d=createDecipheriv('aes-256-gcm',k,b.subarray(0,12));d.setAAD(Buffer.from(context));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]);}};
}

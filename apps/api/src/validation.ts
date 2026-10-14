import {z} from 'zod';
export const profileInput=z.object({displayName:z.string().trim().min(1).max(80),country:z.string().trim().max(80),book:z.enum(['green','blue'])});
export const hex32=z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const uuid=z.string().uuid();
export const submissionInput=z.object({consent:z.literal(true),challenge:z.string().length(8),evidence:z.array(z.object({kind:z.enum(['front','back','identity','challenge','video']),mime:z.enum(['image/jpeg','image/png','video/mp4','video/quicktime']),base64:z.string().max(14_000_000)})).length(5)});
export function validateEvidence(items:z.infer<typeof submissionInput>['evidence']){
 if(new Set(items.map(x=>x.kind)).size!==5)throw new Error('Provide all four book photos and one challenge video');
 return items.map(item=>{
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(item.base64))throw new Error('Invalid evidence encoding');
  const bytes=Buffer.from(item.base64,'base64');
  if(bytes.length<16||bytes.length>(item.kind==='video'?10_000_000:2_000_000))throw new Error('Each photo must be under 2 MB; video under 10 MB');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const video=bytes.subarray(4,8).toString()==='ftyp';
  if(item.kind==='video'?(!item.mime.startsWith('video/')||!video):(!(item.mime==='image/png'?png:item.mime==='image/jpeg'&&jpeg)))throw new Error('Evidence format does not match its content');
  return {...item,bytes};
 });
}

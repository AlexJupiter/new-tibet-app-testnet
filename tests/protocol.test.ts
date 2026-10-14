import {describe,it,expect} from 'vitest';
import {ADMIN_ADDRESS,ZERO_UID,encodeIdentity,decodeIdentity,validIdentity,type Attestation,type Hex,type Address} from '../packages/protocol';
import {vault} from '../apps/api/src/crypto';
import {validateAdminMessage} from '../apps/api/src/auth';
import {SiweMessage} from 'siwe';
import {getAddress} from 'viem';
const uid=('0x'+'1'.repeat(64)) as Hex,schema=('0x'+'2'.repeat(64)) as Hex,reference=('0x'+'3'.repeat(64)) as Hex,wallet=('0x'+'4'.repeat(40)) as Address;
const a:Attestation={uid,schema,expirationTime:2000n,revocationTime:0n,recipient:wallet,attester:ADMIN_ADDRESS,revocable:true,data:encodeIdentity(reference)};
describe('Identity trust rules',()=>{
 it('accepts only the expected schema, issuer, recipient, reference and version',()=>{expect(validIdentity(a,schema,wallet,reference,1000n)).toBe(true);expect(decodeIdentity(a.data)).toEqual({reference,verified:true,version:1});});
 it.each([{attester:wallet},{recipient:ADMIN_ADDRESS},{schema:uid},{uid:ZERO_UID},{revocationTime:1n},{expirationTime:1000n},{revocable:false},{data:'0x'}])('rejects invalid attestation %#',change=>{expect(validIdentity({...a,...change} as Attestation,schema,wallet,reference,1000n)).toBe(false);});
 it('rejects a different application reference',()=>expect(validIdentity(a,schema,wallet,uid,1000n)).toBe(false));
});
describe('Evidence encryption',()=>{
 const key=Buffer.alloc(32,9).toString('base64'),crypt=vault(key);
 it('authenticates encryption and binds evidence to its record',()=>{const encrypted=crypt.encrypt('private identity','evidence-1');expect(encrypted).not.toContain('private identity');expect(crypt.decrypt(encrypted,'evidence-1').toString()).toBe('private identity');expect(()=>crypt.decrypt(encrypted,'evidence-2')).toThrow();const bytes=Buffer.from(encrypted,'base64');bytes[31]^=1;expect(()=>crypt.decrypt(bytes.toString('base64'),'evidence-1')).toThrow();});
 it('uses a fresh encryption nonce',()=>expect(crypt.encrypt('same','id')).not.toBe(crypt.encrypt('same','id')));
});
describe('SIWE boundaries',()=>{
 const origin='https://verify.newtibet.example';
 const message=(changes={})=>new SiweMessage({domain:new URL(origin).host,address:getAddress(ADMIN_ADDRESS),uri:origin,version:'1',chainId:11155111,nonce:'12345678',issuedAt:new Date().toISOString(),expirationTime:new Date(Date.now()+300000).toISOString(),...changes}).prepareMessage();
 it('accepts a current administrator message for the configured origin',()=>expect(validateAdminMessage(message(),origin).chainId).toBe(11155111));
 it.each([{chainId:1},{domain:'evil.example'},{uri:'https://evil.example'},{address:getAddress(wallet)},{expirationTime:new Date(Date.now()-1000).toISOString()},{issuedAt:new Date(Date.now()+60000).toISOString()},{issuedAt:new Date(Date.now()-600000).toISOString()}])('rejects altered login context %j',change=>expect(()=>validateAdminMessage(message(change),origin)).toThrow());
});

import {describe,it,expect,beforeAll,beforeEach,afterAll,vi} from 'vitest';
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {Wallet} from 'ethers';
import {SiweMessage} from 'siwe';
import {getAddress} from 'viem';
import {buildServer} from '../apps/api/src/server';
import {loadConfig} from '../apps/api/src/config';
import {hash,vault} from '../apps/api/src/crypto';
import {prune} from '../apps/api/src/retention';
import {ADMIN_ADDRESS} from '../packages/protocol';
const state=vi.hoisted(()=>({jwks:null as any}));
vi.mock('jose',async original=>{const actual=await original<typeof import('jose')>();return {...actual,createRemoteJWKSet:()=>actual.createLocalJWKSet(state.jwks)};});
const url=process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('API with PostgreSQL and signed access tokens',()=>{
 let pool:Pool,app:Awaited<ReturnType<typeof buildServer>>,key:any;
 const memberWallet='0x4444444444444444444444444444444444444444';
 const origin='https://verify.newtibet.example',token='test-session',csrf='test-csrf',user='did:privy:test-user';
 const config=loadConfig({NODE_ENV:'test',DATABASE_URL:url,ADMIN_ORIGIN:origin,SEPOLIA_RPC_URL:'https://ethereum-sepolia-rpc.publicnode.com',PRIVY_APP_ID:'app-test',PRIVY_APP_SECRET:'not-a-real-secret',DATA_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')});
 const headers={cookie:`nt_admin=${token}`,origin,'x-csrf-token':csrf};
 const accessToken=(changes:any={})=>new SignJWT({}).setProtectedHeader({alg:'ES256',kid:'test'}).setIssuer(changes.issuer??'privy.io').setAudience(changes.audience??'app-test').setSubject(user).setExpirationTime(changes.exp??'5m').sign(key);
 const memberHeaders=async()=>({authorization:`Bearer ${await accessToken()}`});
 beforeAll(async()=>{
  if(!new URL(url!).pathname.endsWith('_test'))throw new Error('Use a dedicated database ending in _test');
  pool=new Pool({connectionString:url});await pool.query(await readFile('apps/api/migrations/001_initial.sql','utf8'));
  const pair=await generateKeyPair('ES256');key=pair.privateKey;state.jwks={keys:[{...await exportJWK(pair.publicKey),kid:'test'}]};
  vi.stubGlobal('fetch',async(input:any)=>{if(String(input).startsWith('https://auth.privy.io/api/v1/users/'))return new Response(JSON.stringify({linked_accounts:[{type:'passkey'},{type:'wallet',chain_type:'ethereum',wallet_client_type:'privy',address:memberWallet}]}),{status:200,headers:{'Content-Type':'application/json'}});throw new Error(`Unexpected remote call ${input}`);});
  app=await buildServer(config,pool);
 });
 beforeEach(async()=>{await pool.query('TRUNCATE members,verification_requests,evidence,challenges,announcements,announcement_reads,admin_nonces,admin_sessions,settings,audit_log CASCADE');await pool.query("INSERT INTO admin_sessions VALUES($1,$2,now()+interval '1 hour')",[hash(token),csrf]);await pool.query("INSERT INTO settings VALUES('identity_schema',$1)",['0x'+'2'.repeat(64)]);});
 afterAll(async()=>{await app?.close();await pool?.end();vi.unstubAllGlobals();});
 it('protects admin APIs and blocks cross-origin challenges',async()=>{expect((await app.inject({url:'/api/admin/requests'})).statusCode).toBe(401);expect((await app.inject({method:'POST',url:'/api/admin/nonce',headers:{origin:'https://evil.example'},payload:{}})).statusCode).toBe(403);});
 it('checks CSRF on admin mutations',async()=>{expect((await app.inject({method:'POST',url:'/api/admin/announcements',headers:{cookie:headers.cookie,origin},payload:{title:'Hello',body:'World'}})).statusCode).toBe(403);});
 it('rejects a forged admin signature and consumes its nonce',async()=>{
  const n=await app.inject({method:'POST',url:'/api/admin/nonce',headers:{origin},payload:{}});const nonce=n.json().nonce;
  const message=new SiweMessage({domain:new URL(origin).host,address:getAddress(ADMIN_ADDRESS),uri:origin,chainId:11155111,version:'1',nonce,issuedAt:new Date().toISOString(),expirationTime:new Date(Date.now()+300000).toISOString()}).prepareMessage();
  const signature=await Wallet.createRandom().signMessage(message);
  const input={method:'POST' as const,url:'/api/admin/login',headers:{origin},payload:{message,signature}};
  expect((await app.inject(input)).statusCode).toBe(401);expect((await app.inject(input)).statusCode).toBe(401);expect((await pool.query('SELECT * FROM admin_nonces')).rowCount).toBe(0);
 });
 it('rejects unsigned, expired and wrong-audience member tokens',async()=>{
  for(const authorization of ['Bearer forged',`Bearer ${await accessToken({exp:1})}`,`Bearer ${await accessToken({audience:'other-app'})}`,`Bearer ${await accessToken({issuer:'other-issuer'})}`])expect((await app.inject({url:'/api/me',headers:{authorization}})).statusCode).toBe(401);
 });
 it('requires a linked passkey even with a valid provider token',async()=>{
  const original=globalThis.fetch;try{vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({linked_accounts:[{type:'wallet',chain_type:'ethereum',wallet_client_type:'privy',address:memberWallet}]}),{status:200}));expect((await app.inject({url:'/api/me',headers:await memberHeaders()})).statusCode).toBe(403);}finally{vi.stubGlobal('fetch',original);}
 });
 it('uses the provider-owned wallet and encrypts profile data',async()=>{
  const h=await memberHeaders();expect((await app.inject({url:'/api/me',headers:h})).json().wallet).toBe(memberWallet);
  const saved=await app.inject({method:'PUT',url:'/api/me/profile',headers:h,payload:{displayName:'Private member',country:'France',book:'green',wallet:ADMIN_ADDRESS}});expect(saved.statusCode).toBe(200);
  const row=(await pool.query('SELECT * FROM members')).rows[0];expect(row.wallet).toBe(memberWallet);expect(row.profile).not.toContain('Private member');
 });
 it('persists announcements and read receipts',async()=>{
  const h=await memberHeaders();await app.inject({url:'/api/me',headers:h});const published=await app.inject({method:'POST',url:'/api/admin/announcements',headers,payload:{title:'Community update',body:'New Tibet is ready.'}});expect(published.statusCode).toBe(200);const id=published.json().id;
  expect((await app.inject({url:'/api/announcements',headers:h})).json().announcements[0].read).toBe(false);
  expect((await app.inject({method:'POST',url:`/api/announcements/${id}/read`,headers:h,payload:{}})).statusCode).toBe(200);
  expect((await app.inject({url:'/api/announcements',headers:h})).json().announcements[0].read).toBe(true);
 });
 it('submits encrypted evidence, prevents duplicate submissions and prunes expired evidence',async()=>{
  const h=await memberHeaders();await app.inject({url:'/api/me',headers:h});await app.inject({method:'PUT',url:'/api/me/profile',headers:h,payload:{displayName:'Tenzin',country:'',book:'green'}});
  const challenge=(await app.inject({method:'POST',url:'/api/me/challenge',headers:h,payload:{}})).json().code;
  const image=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(30)]).toString('base64');const video=Buffer.concat([Buffer.alloc(4),Buffer.from('ftyp'),Buffer.alloc(30)]).toString('base64');
  const evidence=['front','back','identity','challenge'].map(kind=>({kind,mime:'image/jpeg',base64:image}));evidence.push({kind:'video',mime:'video/mp4',base64:video});
  const payload={consent:true,challenge,evidence,wallet:ADMIN_ADDRESS};const submitted=await app.inject({method:'POST',url:'/api/me/verification',headers:h,payload});expect(submitted.statusCode).toBe(200);const id=submitted.json().id;
  const row=(await pool.query('SELECT * FROM verification_requests WHERE id=$1',[id])).rows[0];expect(row.wallet).toBe(memberWallet);expect(row.profile).not.toContain('Tenzin');
  const stored=(await pool.query('SELECT * FROM evidence WHERE request_id=$1',[id])).rows[0];expect(vault(config.DATA_ENCRYPTION_KEY).decrypt(stored.encrypted,stored.id).length).toBeGreaterThan(16);
  expect((await app.inject({method:'POST',url:'/api/me/verification',headers:h,payload})).statusCode).toBe(400);
  expect((await app.inject({url:`/api/admin/evidence/${stored.id}`})).statusCode).toBe(401);
  expect((await app.inject({url:`/api/admin/evidence/${stored.id}`,headers})).statusCode).toBe(200);
  await pool.query("UPDATE verification_requests SET evidence_expires_at=now()-interval '1 day' WHERE id=$1",[id]);await prune(pool);
  expect((await pool.query('SELECT * FROM evidence')).rowCount).toBe(0);const pruned=(await pool.query('SELECT * FROM verification_requests WHERE id=$1',[id])).rows[0];expect(pruned.status).toBe('expired');expect(pruned.profile).toBeNull();
 });
 it('deletes the member profile and private evidence',async()=>{const h=await memberHeaders();await app.inject({url:'/api/me',headers:h});expect((await app.inject({method:'DELETE',url:'/api/me',headers:h})).statusCode).toBe(200);expect((await pool.query('SELECT * FROM members')).rowCount).toBe(0);});
});

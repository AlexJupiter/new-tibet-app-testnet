import {createPublicClient,http,parseAbi,type Address,type Hex} from 'viem';
import {sepolia} from 'viem/chains';
import {ADMIN_ADDRESS,EAS_ADDRESS,REGISTRY_ADDRESS,IDENTITY_SCHEMA,easAbi,registryAbi,validIdentity} from '../../../packages/protocol/index.js';
import {expectedResolverRuntime} from '../../../packages/protocol/resolver.js';
export function chain(rpc:string){
 const client=createPublicClient({chain:sepolia,transport:http(rpc,{timeout:15000,retryCount:2})});
 return {client,async validateSchema(uid:Hex){
  const s=await client.readContract({address:REGISTRY_ADDRESS,abi:registryAbi,functionName:'getSchema',args:[uid]});
  if(s.schema!==IDENTITY_SCHEMA||!s.revocable||s.resolver==='0x0000000000000000000000000000000000000000')throw new Error('An admin-restricted revocable identity schema is required');
  const code=await client.getBytecode({address:s.resolver});
  if(code?.toLowerCase()!==expectedResolverRuntime().toLowerCase())throw new Error('Resolver bytecode does not match the application contract');
  const abi=parseAbi(['function admin() view returns(address)','function eas() view returns(address)']);
  const [admin,eas]=await Promise.all([client.readContract({address:s.resolver,abi,functionName:'admin'}),client.readContract({address:s.resolver,abi,functionName:'eas'})]);
  if(admin.toLowerCase()!==ADMIN_ADDRESS||eas.toLowerCase()!==EAS_ADDRESS.toLowerCase())throw new Error('Resolver is configured for a different admin or EAS deployment');
  return s;
 },async verify(uid:Hex,schema:Hex,wallet:Address,reference:Hex){
  const a=await client.readContract({address:EAS_ADDRESS,abi:easAbi,functionName:'getAttestation',args:[uid]});
  const block=await client.getBlock();
  return {valid:validIdentity(a,schema,wallet,reference,block.timestamp),attestation:a};
 }};
}

import {createWalletClient,createPublicClient,custom,http,decodeEventLog,type EIP1193Provider,type Hex} from 'viem';
import {sepolia} from 'viem/chains';
import {createSiweMessage} from 'viem/siwe';
import {ADMIN_ADDRESS,CHAIN_ID,EAS_ADDRESS,REGISTRY_ADDRESS,IDENTITY_SCHEMA,ZERO_UID,easAbi,registryAbi} from '../../../packages/protocol/index';
import artifact from '../../../packages/protocol/generated/resolver.json';
import {api,setCsrf} from './api';
declare global{interface Window{ethereum?:EIP1193Provider;}}
export async function wallet(){
 if(!window.ethereum)throw new Error('Install an Ethereum wallet browser extension to sign in.');
 const client=createWalletClient({chain:sepolia,transport:custom(window.ethereum)});
 const [account]=await client.requestAddresses();if(account.toLowerCase()!==ADMIN_ADDRESS)throw new Error('Select the authorized New Tibet administrator wallet.');
 if(await client.getChainId()!==CHAIN_ID)await client.switchChain({id:CHAIN_ID});
 const publicClient=createPublicClient({chain:sepolia,transport:http(import.meta.env.VITE_SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com')});
 return {client,account,publicClient};
}
export async function login(){
 const {client,account}=await wallet();const {nonce}=await api('/admin/nonce','POST',{});
 const now=Date.now();const message=createSiweMessage({domain:location.host,address:account,statement:'Sign in to the New Tibet verification desk.',uri:location.origin,version:'1',chainId:CHAIN_ID,nonce,issuedAt:new Date(now),expirationTime:new Date(now+5*60*1000)});
 const signature=await client.signMessage({account,message});const session=await api('/admin/login','POST',{message,signature});setCsrf(session.csrf);return session;
}
export async function initializeSchema(progress:(message:string)=>void){
 const {client,account,publicClient}=await wallet();
 let resolver=localStorage.getItem('nt_resolver') as Hex|null;
 // Persist addresses/hashes only; never persist identity evidence or wallet credentials.
 const previousDeployment=localStorage.getItem('nt_resolver_tx') as Hex|null;
 if(!resolver&&previousDeployment){progress('Recovering resolver deployment…');const receipt=await publicClient.waitForTransactionReceipt({hash:previousDeployment,confirmations:3});if(receipt.status==='success'&&receipt.contractAddress){resolver=receipt.contractAddress;localStorage.setItem('nt_resolver',resolver);}else{localStorage.removeItem('nt_resolver_tx');throw new Error('The previous resolver deployment failed. Retry initialization.');}}
 if(!resolver){progress('Deploying the administrator resolver…');const hash=await client.deployContract({account,abi:artifact.abi,bytecode:artifact.bytecode as Hex,args:[EAS_ADDRESS,ADMIN_ADDRESS]});localStorage.setItem('nt_resolver_tx',hash);const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:3});if(receipt.status!=='success'||!receipt.contractAddress)throw new Error('Resolver deployment failed');resolver=receipt.contractAddress;localStorage.setItem('nt_resolver',resolver);}
 const {keccak256,encodePacked}=await import('viem');
 const uid=keccak256(encodePacked(['string','address','bool'],[IDENTITY_SCHEMA,resolver,true]));
 const record=await publicClient.readContract({address:REGISTRY_ADDRESS,abi:registryAbi,functionName:'getSchema',args:[uid]});
 if(record.uid===ZERO_UID){progress('Registering the identity schema…');const hash=await client.writeContract({account,address:REGISTRY_ADDRESS,abi:registryAbi,functionName:'register',args:[IDENTITY_SCHEMA,resolver,true]});const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:3});if(receipt.status!=='success')throw new Error('Schema registration failed');}
 progress('Saving the confirmed schema…');await api('/admin/schema','POST',{uid});return uid;
}
export async function attest(id:string,onHash:(hash:Hex)=>void){
 const {client,account,publicClient}=await wallet();const input=await api(`/admin/requests/${id}/attest`);
 const hash=await client.writeContract({account,address:EAS_ADDRESS,abi:easAbi,functionName:'attest',args:[{schema:input.schema,data:{recipient:input.recipient,expirationTime:BigInt(input.expirationTime),revocable:true,refUID:ZERO_UID,data:input.data,value:0n}}]});
 onHash(hash);const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:3});if(receipt.status!=='success')throw new Error('The attestation transaction failed.');
 return api(`/admin/requests/${id}/approve`,'POST',{transactionHash:hash});
}
export async function recoverAttestation(id:string,hash:Hex){
 const {publicClient}=await wallet();const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:3});if(receipt.status!=='success')throw new Error('Transaction reverted');return api(`/admin/requests/${id}/approve`,'POST',{transactionHash:hash});
}
export async function revoke(uid:Hex,schema:Hex){
 const {client,account,publicClient}=await wallet();const hash=await client.writeContract({account,address:EAS_ADDRESS,abi:easAbi,functionName:'revoke',args:[{schema,data:{uid,value:0n}}]});
 const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:3});if(receipt.status!=='success')throw new Error('Revocation failed');return hash;
}

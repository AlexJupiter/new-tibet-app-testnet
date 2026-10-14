import {createContext,useContext,useState,useCallback,useEffect,type ReactNode} from 'react';
import {AppState} from 'react-native';
import {useApi} from './api';
import type {Member} from '../../../packages/protocol';
const Context=createContext<{member:Member|null;error:string;loading:boolean;refresh:()=>Promise<void>}>({member:null,error:'',loading:false,refresh:async()=>{}});
export function MemberProvider({children}:{children:ReactNode}){
 const api=useApi();
 const [member,setMember]=useState<Member|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{setMember(await api<Member>('/me'));}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[api]);
 useEffect(()=>{void refresh();const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});return()=>listener.remove();},[refresh]);
 return <Context.Provider value={{member,error,loading,refresh}}>{children}</Context.Provider>;
}
export const useMember=()=>useContext(Context);

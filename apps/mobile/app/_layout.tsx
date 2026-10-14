import {Stack} from 'expo-router';
import {PrivyProvider} from '@privy-io/expo';
import {PrivyElements} from '@privy-io/expo/ui';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {sepolia} from 'viem/chains';
import {Screen,Card,s} from '../src/ui';
import {Text} from 'react-native';
export default function RootLayout(){
 const appId=process.env.EXPO_PUBLIC_PRIVY_APP_ID,clientId=process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,domain=process.env.EXPO_PUBLIC_PASSKEY_DOMAIN;
 if(!appId||!clientId||!domain||!process.env.EXPO_PUBLIC_API_URL)return <SafeAreaProvider><Screen title="New Tibet"><Card><Text style={s.h2}>Setup required</Text><Text style={s.body}>This build needs the New Tibet service and passkey configuration. Ask the app administrator for a configured testnet build.</Text></Card></Screen></SafeAreaProvider>;
 return <SafeAreaProvider><PrivyProvider appId={appId} clientId={clientId} supportedChains={[sepolia]} config={{embedded:{ethereum:{createOnLogin:'users-without-wallets'}}}}><StatusBar style="dark"/><Stack screenOptions={{headerShown:false}}/><PrivyElements/></PrivyProvider></SafeAreaProvider>;
}

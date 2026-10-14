import { Redirect } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { Loading } from "../src/ui";
export default function Index() {
  const { isReady, user } = usePrivy();
  if (!isReady) return <Loading />;
  return <Redirect href={user ? "/(tabs)/profile" : "/sign-in"} />;
}

import { Alert } from "react-native";
export type DialogButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};
export function showDialog(
  title: string,
  message?: string,
  buttons?: DialogButton[],
) {
  Alert.alert(title, message, buttons);
}

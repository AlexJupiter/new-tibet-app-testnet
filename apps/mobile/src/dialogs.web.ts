import type { DialogButton } from "./dialogs";
export function showDialog(
  title: string,
  message?: string,
  buttons?: DialogButton[],
) {
  const text = [title, message].filter(Boolean).join("\n\n");
  const action = buttons?.find(
    (button) => button.style !== "cancel" && button.onPress,
  );
  if (action) {
    if (window.confirm(text)) action.onPress?.();
  } else window.alert(text);
}

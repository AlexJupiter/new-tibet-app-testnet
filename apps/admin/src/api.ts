export let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "GET" ? {} : { "X-CSRF-Token": csrf }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (response.status === 401 && path !== "/admin/login")
    window.dispatchEvent(new Event("nt-session-expired"));
  if (!response.ok) throw new Error(data.error ?? "Unable to complete request");
  return data;
}

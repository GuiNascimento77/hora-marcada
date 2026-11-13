import { createAuthClient } from "better-auth/react";
import { managedAuthClient } from "@runablehq/managed-auth/client";

const EMAIL_TOKEN_KEY = "hora-marcada.email-session";
export const googleEnabled = Boolean(
  import.meta.env.VITE_APPLICATION_ID && import.meta.env.VITE_RUNABLE_AUTH_ISSUER,
);
let emailToken = "";
function readEmailToken() {
  try {
    return localStorage.getItem(EMAIL_TOKEN_KEY) ?? emailToken;
  } catch {
    return emailToken;
  }
}
export function clearEmailToken() {
  emailToken = "";
  try {
    localStorage.removeItem(EMAIL_TOKEN_KEY);
  } catch {
    /* Cookie continua disponível fora do iframe. */
  }
}
export function captureEmailToken(context: { response: Response }) {
  const token = context.response.headers.get("set-auth-token");
  if (!token) return;
  emailToken = token;
  try {
    localStorage.setItem(EMAIL_TOKEN_KEY, token);
  } catch {
    /* Fallback em memória. */
  }
}

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
  fetchOptions: { auth: { type: "Bearer", token: () => getAuthToken() } },
  plugins: [
    managedAuthClient({
      applicationId: import.meta.env.VITE_APPLICATION_ID ?? "",
      issuer: import.meta.env.VITE_RUNABLE_AUTH_ISSUER ?? "",
    }),
  ],
});

export function getAuthToken(): string {
  try {
    return authClient.managedAuth.getToken() || readEmailToken();
  } catch {
    return readEmailToken();
  }
}

let redirectPromise: ReturnType<typeof authClient.managedAuth.handleRedirect> | undefined;
// StrictMode chama effects duas vezes: troca do token de redirecionamento só uma vez.
export function completeAuthRedirect() {
  return (redirectPromise ??= authClient.managedAuth.handleRedirect());
}

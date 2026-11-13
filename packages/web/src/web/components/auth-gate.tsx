import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { authClient, clearEmailToken, completeAuthRedirect } from "../lib/auth";
import { useProfile } from "../queries/profile";
import { AccessProvider } from "./access-provider";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    completeAuthRedirect()
      .then((result) => {
        if (alive && result?.error)
          setError("O login com Google não foi concluído. Tente novamente.");
      })
      .catch(() => {
        if (alive) setError("Não foi possível concluir o login. Tente novamente.");
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!ready)
    return (
      <div className="loading-panel">
        <span className="spinner" /> Preparando seu acesso…
      </div>
    );
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {children}
    </>
  );
}

export function PrivateAgenda({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const profile = useProfile(session?.user.id ?? "");
  if (isPending || (session && profile.isLoading))
    return (
      <div className="loading-panel">
        <span className="spinner" /> Verificando sua conta…
      </div>
    );
  if (sessionError)
    return (
      <div className="error-panel">
        <h2>Não foi possível verificar seu acesso.</h2>
        <button className="button outline" onClick={() => authClient.getSession()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!session) return <Redirect to="/entrar" />;
  if (profile.isError)
    return (
      <div className="error-panel">
        <h2>Sua sessão precisa ser verificada.</h2>
        <button className="button outline" onClick={() => profile.refetch()}>
          Tentar novamente
        </button>
        <SignOutButton />
      </div>
    );
  if (!profile.data) return null;
  return (
    <AccessProvider demo={false} profile={profile.data}>
      {children}
    </AccessProvider>
  );
}

export function SignOutButton() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Não foi possível sair. Tente novamente.");
      clearEmailToken();
      queryClient.clear();
      await authClient.getSession();
      navigate("/entrar");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button className="button outline signout" onClick={logout} disabled={pending}>
        {pending ? "Saindo…" : "Sair da conta"}
      </button>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

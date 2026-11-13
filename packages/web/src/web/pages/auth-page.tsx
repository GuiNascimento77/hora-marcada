import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient, captureEmailToken, clearEmailToken, googleEnabled } from "../lib/auth";

export default function AuthPage() {
  const { data: session, isPending } = authClient.useSession();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const cache = useQueryClient();
  if (isPending)
    return (
      <div className="loading-panel">
        <span className="spinner" /> Verificando acesso…
      </div>
    );
  if (session) return <Redirect to="/agenda" />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      authClient.managedAuth.clearToken();
      clearEmailToken();
      cache.clear();
      const result =
        tab === "signin"
          ? await authClient.signIn.email({
              email: email.trim(),
              password,
              fetchOptions: { onSuccess: captureEmailToken },
            })
          : await authClient.signUp.email({
              name: name.trim(),
              email: email.trim(),
              password,
              fetchOptions: { onSuccess: captureEmailToken },
            });
      if (result.error) {
        const code = result.error.code;
        throw new Error(
          code === "INVALID_EMAIL_OR_PASSWORD"
            ? "E-mail ou senha incorretos."
            : code?.includes("EXISTS")
              ? "Não foi possível criar esta conta. Tente entrar ou use outro e-mail."
              : result.error.status === 429
                ? "Muitas tentativas. Aguarde um minuto e tente novamente."
                : "Não foi possível concluir. Confira os dados e tente novamente.",
        );
      }
      await authClient.getSession();
      navigate("/agenda");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível conectar.");
    } finally {
      setPending(false);
    }
  }
  async function googleLogin() {
    setError("");
    setPending(true);
    clearEmailToken();
    cache.clear();
    try {
      const result = await authClient.managedAuth.signIn({ provider: "google" });
      if (result.error && result.error.code !== "POPUP_CLOSED")
        throw new Error(
          "Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.",
        );
      if (result.data?.success) navigate("/agenda");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao conectar com Google.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="site-shell auth-shell">
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-symbol">
            <Scissors size={20} />
          </span>
          <span>
            hora<span className="brand-dot">.</span>
            <br />
            marcada
          </span>
        </Link>
        <span className="auth-header-note">
          <ShieldCheck size={15} /> UM HORÁRIO SÓ SEU
        </span>
        <Link to="/demo" className="button outline">
          Explorar demonstração <ArrowUpRight size={15} />
        </Link>
      </header>
      <main className="auth-layout">
        <section className="auth-editorial">
          <div className="hero-meta">
            <span className="status-dot" /> SEU ESTILO. SEU ESPAÇO.
          </div>
          <h1>
            SEU TEMPO.
            <br />
            SUA CONTA.
            <br />
            <span>HORA CERTA.</span>
          </h1>
          <p>
            Reserve um momento para cuidar de você.
            <br />
            Sua agenda, protegida e sem complicação.
          </p>
          <div className="auth-benefits">
            <span>
              <Check size={15} /> Escolha serviço, profissional e horário.
            </span>
            <span>
              <Check size={15} /> Reagende sem perder seu lugar.
            </span>
            <span>
              <LockKeyhole size={15} /> Só você e a administração veem suas reservas.
            </span>
          </div>
          <Link to="/demo" className="auth-demo-ticket">
            <span className="eyebrow">ANTES DE ENTRAR, EXPERIMENTE</span>
            <strong>
              Conheça a agenda.
              <br />
              Sem criar uma conta.
            </strong>
            <span>
              Demonstração pública, só com dados fictícios.
              <ArrowUpRight size={22} />
            </span>
          </Link>
        </section>
        <section className="auth-card" aria-label="Acesso à conta">
          <span className="eyebrow">BEM-VINDO AO HORA MARCADA</span>
          <h2>{tab === "signin" ? "Bom te ver por aqui." : "Seu próximo cuidado."}</h2>
          <p className="muted">
            {tab === "signin"
              ? "Entre para acompanhar seus agendamentos."
              : "Crie sua conta de cliente para começar."}
          </p>
          <div className="auth-tabs">
            <button
              className={tab === "signin" ? "active" : ""}
              disabled={pending}
              onClick={() => {
                setTab("signin");
                setError("");
              }}
            >
              Entrar
            </button>
            <button
              className={tab === "signup" ? "active" : ""}
              disabled={pending}
              onClick={() => {
                setTab("signup");
                setError("");
              }}
            >
              Criar conta
            </button>
          </div>
          {googleEnabled ? (
            <>
              <button
                className="button outline google-button"
                onClick={googleLogin}
                disabled={pending}
              >
                <span className="google-letter">G</span> Continuar com Google{" "}
                <ArrowUpRight size={15} />
              </button>
              <div className="auth-or">
                <span />
                ou use seu e-mail
                <span />
              </div>
            </>
          ) : (
            <p className="local-auth-note">
              Execução local: acesso por e-mail e senha. Google fica disponível com a configuração
              gerenciada.
            </p>
          )}
          <form onSubmit={submit} className="booking-fields">
            {tab === "signup" && (
              <label>
                Seu nome
                <input
                  aria-label="Seu nome"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como podemos chamar você?"
                  disabled={pending}
                />
              </label>
            )}
            <label>
              E-mail
              <input
                aria-label="E-mail"
                autoComplete="email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                disabled={pending}
              />
            </label>
            <label>
              Senha
              <div className="password-field">
                <input
                  aria-label="Senha"
                  autoComplete={tab === "signin" ? "current-password" : "new-password"}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={tab === "signup" ? 10 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === "signup" ? "Pelo menos 10 caracteres" : "Sua senha"}
                  disabled={pending}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button dark full" disabled={pending}>
              {pending
                ? "Conectando…"
                : tab === "signin"
                  ? "Entrar na minha agenda"
                  : "Criar minha conta"}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="auth-footnote">
            <LockKeyhole size={14} />
            <span>
              Novas contas são sempre clientes.
              <br />
              Acesso de administrador é concedido fora do cadastro.
            </span>
          </div>
          <p className="auth-data-note">
            Projeto de portfólio: use dados de teste. Cadastro por e-mail sem verificação de
            endereço e sem recuperação de senha nesta versão.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          hora<span>.</span>marcada
        </span>
        <span>TypeScript + React · versão 0.1.0</span>
        <span>MENOS ESPERA. MAIS ESTILO.</span>
      </footer>
    </div>
  );
}

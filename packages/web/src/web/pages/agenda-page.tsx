import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  MapPin,
  Plus,
  Search,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAppointments, useBookingMutations, useCatalog } from "../queries/agenda";
import { addDays, businessNow, CLOSE, formatTime } from "../../api/domain/scheduling";
import { Appointment, BookingModal, dateLabel, Dialog, money } from "../components/booking-modal";
import { useAccess } from "../components/access-provider";
import { SignOutButton } from "../components/auth-gate";
import { Link } from "wouter";

type View = "agenda" | "services" | "team";
export default function AgendaPage() {
  const { demo, profile } = useAccess();
  const customer = !demo && profile?.role === "customer";
  const catalog = useCatalog();
  const [date, setDate] = useState("");
  const [view, setView] = useState<View>("agenda");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [booking, setBooking] = useState<{ serviceId?: string; appointment?: Appointment } | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [notice, setNotice] = useState("");
  const reservations = useAppointments(date);
  const mutations = useBookingMutations();
  useEffect(() => {
    if (catalog.data && !date) setDate(catalog.data.initialDate);
  }, [catalog.data, date]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const all = reservations.data ?? [];
  const active = all.filter((a) => a.status === "confirmed");
  const filtered = all.filter(
    (a) =>
      (showCancelled || a.status === "confirmed") &&
      (filter === "all" || filter === a.professionalId) &&
      `${a.customerName} ${a.serviceName}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const now = businessNow();
  const next = active.find((a) => date > now.date || (date === now.date && a.start > now.minute));
  const dates = date ? Array.from({ length: 7 }, (_, i) => addDays(date, i - 2)) : [];
  const revenue = active.reduce((sum, a) => sum + a.price, 0);
  const totalMinutes = active.reduce((sum, a) => sum + a.duration, 0);
  const occupancy = Math.round(
    (totalMinutes / (600 * (catalog.data?.professionals.length ?? 3))) * 100,
  );
  const changeView = (target: View) => {
    setView(target);
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelError("");
    try {
      await mutations.cancel.mutateAsync({ id: cancelTarget.id });
      setCancelTarget(null);
      setNotice("Reserva cancelada. O horário está livre novamente.");
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Erro ao cancelar.");
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="/" className="brand" aria-label="Hora Marcada início">
          <span className="brand-symbol">
            <Scissors size={20} />
          </span>
          <span>
            hora<span className="brand-dot">.</span>
            <br />
            marcada
          </span>
        </a>
        <nav className="main-nav" aria-label="Navegação principal">
          <button
            className={view === "agenda" ? "active" : ""}
            onClick={() => changeView("agenda")}
          >
            <CalendarDays size={15} /> Agenda
          </button>
          <button
            className={view === "services" ? "active" : ""}
            onClick={() => changeView("services")}
          >
            <Scissors size={15} /> Serviços
          </button>
          <button className={view === "team" ? "active" : ""} onClick={() => changeView("team")}>
            <Users size={15} /> Equipe
          </button>
        </nav>
        <button
          className="button dark header-cta"
          onClick={() => setBooking({})}
          disabled={!catalog.data}
        >
          <Plus size={16} />
          <span>Novo agendamento</span>
        </button>
      </header>

      <div className={`access-strip ${demo ? "demo" : "private"}`}>
        <div>
          <span className="status-dot" />
          <strong>
            {demo ? "DEMONSTRAÇÃO PÚBLICA" : customer ? "MINHA AGENDA PRIVADA" : "ADMINISTRAÇÃO"}
          </strong>
          <span>
            {demo
              ? "Dados fictícios. Separada das contas e reservas privadas."
              : `Olá, ${profile?.name.split(" ")[0]}. ${customer ? "Somente suas reservas aparecem aqui." : "Visão completa da agenda privada."}`}
          </span>
        </div>
        {demo ? (
          <Link to="/entrar">
            Entrar na minha conta <ArrowUpRight size={14} />
          </Link>
        ) : (
          <div className="account-actions">
            <Link to="/demo">Ver demonstração</Link>
            <SignOutButton />
          </div>
        )}
      </div>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-meta">
              <span className="status-dot" /> SUA ROTINA, NO SEU TEMPO{" "}
              <span className="tiny-separator">/</span> {demo ? "BARBEARIA DEMO" : "ÁREA PRIVADA"}
            </div>
            <h1>
              MENOS ESPERA.
              <br />
              MAIS{" "}
              <span className="accent-word">
                ESTILO<span className="word-dot">.</span>
              </span>
            </h1>
            <p>
              O próximo corte começa com um horário.
              <br />
              Organize a agenda. Cuide de quem chega.
            </p>
            <div className="hero-actions">
              <button
                className="button dark"
                onClick={() => setBooking({})}
                disabled={!catalog.data}
              >
                Reservar um horário <ArrowUpRight size={16} />
              </button>
              <button className="button subtle" onClick={() => changeView("agenda")}>
                Ver agenda <ArrowDown size={15} />
              </button>
            </div>
            <div className="hero-bottom">
              <span>
                <span className="mini-circle">✓</span> Sem fila. Sem complicação.
              </span>
              <span>FEITO PARA O SEU DIA A DIA</span>
            </div>
          </div>
          <div className="hero-art" aria-label="Ilustração de um ticket de agendamento">
            <span className="art-label">
              SEU TEMPO MERECE
              <br />
              UM BOM CORTE.
            </span>
            <div className="orange-ticket">
              <div className="ticket-top">
                <span>HORA MARCADA®</span>
                <Scissors size={23} />
              </div>
              <div className="ticket-title">
                BOM CORTE.
                <br />
                BOA HORA.
              </div>
              <div className="ticket-rule" />
              <div className="ticket-footer">
                <span>CUIDADO EM CADA DETALHE</span>
                <ArrowUpRight size={26} />
              </div>
              <div className="ticket-scallop left" />
              <div className="ticket-scallop right" />
            </div>
            <div className="white-ticket">
              <div className="ticket-status">
                <span className="status-dot" /> TUDO NO LUGAR
              </div>
              <div className="sample-time">
                10:00<span>— 10:45</span>
              </div>
              <div className="sample-row">
                <span>
                  <strong>Corte de cabelo</strong>
                  <small>Um momento só seu.</small>
                </span>
                <span className="sample-check">
                  <Check size={18} />
                </span>
              </div>
            </div>
            <div className="art-bottom">
              <span>01 / ORGANIZAR PARA CUIDAR</span>
              <span className="art-cross">✳</span>
            </div>
          </div>
        </section>

        <div className="section-divider">
          <span>UM DIA BEM ORGANIZADO COMEÇA AQUI</span>
          <span>
            <Clock3 size={12} /> HORÁRIO DE SÃO PAULO
          </span>
        </div>

        <section className="workspace" id="workspace">
          <aside className="section-intro">
            <span className="eyebrow">
              01 / {view === "agenda" ? "AGENDA" : view === "services" ? "SERVIÇOS" : "EQUIPE"}
            </span>
            <h2>
              {view === "agenda" ? (
                <>
                  Cada horário,
                  <br />
                  um cuidado.
                </>
              ) : view === "services" ? (
                <>
                  O seu estilo.
                  <br />
                  Nosso cuidado.
                </>
              ) : (
                <>
                  Boas mãos.
                  <br />
                  Bons encontros.
                </>
              )}
            </h2>
            <p>
              {view === "agenda"
                ? "Tudo o que acontece na cadeira, em um só lugar."
                : view === "services"
                  ? "Serviços pensados para você sair se sentindo bem."
                  : "Conheça quem transforma um horário em uma experiência."}
            </p>
            <div className="demo-note">
              <Code2 size={16} />
              <div>
                <strong>
                  {demo
                    ? "Projeto em demonstração"
                    : customer
                      ? "Reservas protegidas"
                      : "Acesso de administrador"}
                </strong>
                <span>
                  {demo
                    ? "Use apenas dados fictícios."
                    : customer
                      ? "Só você e a administração."
                      : "Agenda privada completa."}
                  <br />
                  {demo ? "Sem acesso a reservas privadas." : "Permissões verificadas na API."}
                </span>
              </div>
            </div>
            <div className="side-stamp">
              HM<span>EST. 2026</span>
            </div>
          </aside>
          <div className="workspace-main">
            {catalog.isLoading ? (
              <div className="loading-panel">
                <span className="spinner" /> Carregando a barbearia…
              </div>
            ) : catalog.isError ? (
              <div className="error-panel">
                <h3>Não foi possível conectar.</h3>
                <p>Verifique sua conexão e tente novamente.</p>
                <button className="button dark" onClick={() => catalog.refetch()}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              catalog.data && (
                <>
                  {view === "agenda" ? (
                    <>
                      <div className="agenda-heading">
                        <div>
                          <span className="eyebrow">
                            {customer ? "MEUS AGENDAMENTOS" : "SUA AGENDA"}
                          </span>
                          <h2>
                            {date
                              ? dateLabel(date, { month: "long", year: "numeric" })
                              : "Carregando…"}
                            <span className="orange-dot" />
                          </h2>
                        </div>
                        <div className="date-controls">
                          <button
                            className="button outline today-button"
                            onClick={() => setDate(catalog.data!.initialDate)}
                          >
                            Hoje
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Dia anterior"
                            onClick={() => setDate(addDays(date, -1))}
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Próximo dia"
                            onClick={() => setDate(addDays(date, 1))}
                          >
                            <ChevronRight size={18} />
                          </button>
                          <label className="date-picker-button" title="Escolher data">
                            <CalendarDays size={17} />
                            <input
                              aria-label="Escolher data da agenda"
                              type="date"
                              value={date}
                              onChange={(e) => {
                                if (e.target.value) setDate(e.target.value);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="day-strip">
                        {dates.map((day) => (
                          <button
                            key={day}
                            className={day === date ? "selected" : ""}
                            onClick={() => setDate(day)}
                            aria-pressed={day === date}
                          >
                            <span>{dateLabel(day, { weekday: "short" }).replace(".", "")}</span>
                            <strong>{Number(day.slice(-2))}</strong>
                            <span className="day-indicator" />
                          </button>
                        ))}
                      </div>
                      <div className="metrics">
                        <div>
                          <span>{customer ? "Minhas reservas" : "Agendamentos"}</span>
                          <strong>
                            {reservations.isLoading ? "—" : String(active.length).padStart(2, "0")}
                            <CalendarDays size={19} />
                          </strong>
                        </div>
                        <div>
                          <span>
                            {customer ? "Valor dos serviços" : "Valor previsto"}{" "}
                            <small>{customer ? "sem pagamento" : "não recebido"}</small>
                          </span>
                          <strong>
                            {reservations.isLoading ? "—" : money(revenue)}
                            <ArrowUpRight size={19} />
                          </strong>
                        </div>
                        <div>
                          <span>{customer ? "Meu tempo reservado" : "Ocupação do dia"}</span>
                          <strong>
                            {reservations.isLoading
                              ? "—"
                              : customer
                                ? `${totalMinutes} min`
                                : `${occupancy}%`}
                            <span className="mini-bars">
                              <i />
                              <i />
                              <i />
                              <i />
                              <i />
                            </span>
                          </strong>
                        </div>
                      </div>
                      <div className="agenda-tools">
                        <label className="search-field">
                          <Search size={16} />
                          <input
                            aria-label="Buscar cliente ou serviço"
                            placeholder="Buscar cliente ou serviço"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                        <label className="filter-select">
                          <SlidersHorizontal size={15} />
                          <select
                            aria-label="Filtrar profissional"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                          >
                            <option value="all">Todos os profissionais</option>
                            {catalog.data.professionals.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="list-heading">
                        <span>
                          {date
                            ? dateLabel(date, { weekday: "long", day: "numeric", month: "short" })
                            : ""}
                        </span>
                        <label>
                          <input
                            aria-label="Mostrar cancelados"
                            type="checkbox"
                            checked={showCancelled}
                            onChange={(e) => setShowCancelled(e.target.checked)}
                          />{" "}
                          Mostrar cancelados
                        </label>
                      </div>
                      <div className="appointment-list" aria-live="polite">
                        {reservations.isLoading ? (
                          <div className="loading-panel">
                            <span className="spinner" /> Consultando agendamentos…
                          </div>
                        ) : reservations.isError ? (
                          <div className="error-panel">
                            <p>Não foi possível carregar a agenda.</p>
                            <button
                              className="button outline"
                              onClick={() => reservations.refetch()}
                            >
                              Tentar novamente
                            </button>
                          </div>
                        ) : filtered.length ? (
                          filtered.map((a) => (
                            <div
                              className={`appointment-row ${a.status === "cancelled" ? "cancelled" : ""}`}
                              key={a.id}
                            >
                              <div className="appointment-time">
                                <strong>{formatTime(a.start)}</strong>
                                <span>{formatTime(a.start + a.duration)}</span>
                              </div>
                              <div className="appointment-details">
                                <strong>{a.customerName}</strong>
                                <span>
                                  {a.serviceName} <i>·</i> {a.duration} min
                                </span>
                              </div>
                              <div className="appointment-professional">
                                <span className={`avatar small ${a.color}`}>{a.initials}</span>
                                <span>{a.professionalName.split(" ")[0]}</span>
                              </div>
                              <div className="appointment-status">
                                <span className={`status-pill ${a.status}`}>
                                  <span />
                                  {a.status === "confirmed" ? "Confirmado" : "Cancelado"}
                                </span>
                                <strong>{money(a.price)}</strong>
                              </div>
                              <div className="appointment-actions">
                                {a.status === "confirmed" && (
                                  <>
                                    <button
                                      className="icon-button"
                                      aria-label={`Reagendar ${a.customerName}`}
                                      title="Reagendar"
                                      onClick={() => setBooking({ appointment: a })}
                                    >
                                      <CalendarDays size={16} />
                                    </button>
                                    <button
                                      className="icon-button cancel-button"
                                      aria-label={`Cancelar ${a.customerName}`}
                                      title="Cancelar"
                                      onClick={() => {
                                        setCancelTarget(a);
                                        setCancelError("");
                                      }}
                                    >
                                      <X size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty-agenda">
                            <CalendarDays size={32} />
                            <h3>
                              {search || filter !== "all"
                                ? "Nenhum resultado por aqui."
                                : "Um dia com espaço para cuidar."}
                            </h3>
                            <p>
                              {search || filter !== "all"
                                ? "Tente outro nome, serviço ou profissional."
                                : "Ainda não há reservas para esta data."}
                            </p>
                            <button
                              className="button outline"
                              onClick={() => {
                                if (search || filter !== "all") {
                                  setSearch("");
                                  setFilter("all");
                                } else setBooking({});
                              }}
                            >
                              {search || filter !== "all"
                                ? "Limpar filtros"
                                : "Criar primeiro agendamento"}
                              <Plus size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="list-footer">
                        <span>
                          {filtered.length} {filtered.length === 1 ? "agendamento" : "agendamentos"}{" "}
                          na visualização
                        </span>
                        <span>
                          <span className="status-dot" /> Agenda sincronizada com o banco
                        </span>
                      </div>
                      <div className="bottom-panels">
                        <div className="next-appointment">
                          <span className="eyebrow">PRÓXIMO ATENDIMENTO</span>
                          {next ? (
                            <>
                              <div className="next-time">
                                {formatTime(next.start)} <ArrowUpRight size={24} />
                              </div>
                              <strong>{next.customerName}</strong>
                              <span>
                                {next.serviceName} · {next.professionalName.split(" ")[0]}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="next-time">
                                Livre <Sparkles size={23} />
                              </div>
                              <strong>O próximo momento é seu.</strong>
                              <span>Nenhum atendimento futuro nesta data.</span>
                            </>
                          )}
                        </div>
                        <div className="shop-info">
                          <span className="eyebrow">BARBEARIA DEMO</span>
                          <h3>
                            Um lugar para
                            <br />
                            ficar bem.
                          </h3>
                          <p>
                            <Clock3 size={14} /> Segunda a sábado · 09h às 19h
                          </p>
                          <p>
                            <MapPin size={14} /> São Paulo, SP · estabelecimento fictício
                          </p>
                          <button onClick={() => changeView("team")}>
                            Conheça a equipe <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : view === "services" ? (
                    <>
                      <div className="catalog-heading">
                        <span className="eyebrow">O MENU DE CUIDADOS</span>
                        <h2>
                          Do detalhe ao completo
                          <span className="orange-dot" />
                        </h2>
                        <p>Preços e durações da barbearia de demonstração.</p>
                      </div>
                      <div className="services-list">
                        {catalog.data.services.map((s, i) => (
                          <div
                            key={s.id}
                            className={`service-row ${s.id === "combo" ? "featured-service" : ""}`}
                          >
                            <span className="service-number">0{i + 1}</span>
                            <div>
                              <h3>
                                {s.name}
                                {s.id === "combo" && (
                                  <span className="popular-label">COMPLETO</span>
                                )}
                              </h3>
                              <p>{s.description}</p>
                              <span className="service-duration">
                                <Clock3 size={13} /> {s.duration} minutos
                              </span>
                            </div>
                            <div className="service-price">
                              <strong>{money(s.price)}</strong>
                              <button
                                className="button outline"
                                onClick={() => setBooking({ serviceId: s.id })}
                              >
                                Agendar <ArrowUpRight size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="catalog-footnote">
                        Todos os serviços podem ser agendados com qualquer profissional da equipe.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="catalog-heading">
                        <span className="eyebrow">QUEM CUIDA DO SEU ESTILO</span>
                        <h2>
                          Talento com hora marcada
                          <span className="orange-dot" />
                        </h2>
                        <p>Três profissionais. A mesma atenção a cada detalhe.</p>
                      </div>
                      <div className="team-list">
                        {catalog.data.professionals.map((p, i) => (
                          <article key={p.id} className="team-card">
                            <div className={`team-monogram ${p.color}`}>
                              <span className="eyebrow">BARBEIRO / 0{i + 1}</span>
                              <strong>
                                {p.initials}
                                <span>✳</span>
                              </strong>
                              <Scissors size={28} />
                            </div>
                            <div className="team-card-body">
                              <h3>{p.name}</h3>
                              <p>{p.specialty}</p>
                              <button
                                onClick={() => {
                                  setFilter(p.id);
                                  setView("agenda");
                                }}
                              >
                                Ver agenda <ArrowUpRight size={16} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="team-note">
                        <span className="status-dot" /> Equipe fictícia criada para demonstrar o
                        funcionamento do projeto.
                      </div>
                    </>
                  )}
                </>
              )
            )}
          </div>
        </section>
        <section className="closing-banner">
          <div>
            <span className="eyebrow">TEMPO BEM CUIDADO</span>
            <h2>
              O bom estilo
              <br />
              começa na agenda<span>.</span>
            </h2>
          </div>
          <button className="button dark" onClick={() => setBooking({})} disabled={!catalog.data}>
            Marcar meu próximo corte <ArrowUpRight size={17} />
          </button>
          <Scissors className="closing-scissors" size={100} strokeWidth={1} />
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          hora<span>.</span>marcada
        </span>
        <span>Projeto de portfólio · TypeScript + React</span>
        <span>MENOS ESPERA. MAIS ESTILO. © 2026</span>
      </footer>
      {notice && (
        <output className="toast" aria-live="polite">
          <Check size={17} />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </output>
      )}
      {booking && catalog.data && (
        <BookingModal
          services={catalog.data.services}
          professionals={catalog.data.professionals}
          date={
            date < now.date || (date === now.date && now.minute >= CLOSE)
              ? catalog.data.initialDate
              : date
          }
          today={catalog.data.today}
          maxDate={catalog.data.maxDate}
          presetService={booking.serviceId}
          appointment={booking.appointment}
          onClose={() => setBooking(null)}
          onSaved={(savedDate, message) => {
            setDate(savedDate);
            setView("agenda");
            setNotice(message);
          }}
        />
      )}
      {cancelTarget && (
        <Dialog
          label="Cancelar agendamento"
          onClose={() => {
            if (!mutations.cancel.isPending) setCancelTarget(null);
          }}
        >
          <div className="modal-top">
            <span className="eyebrow">CANCELAMENTO</span>
            <button
              className="icon-button"
              aria-label="Fechar"
              disabled={mutations.cancel.isPending}
              onClick={() => setCancelTarget(null)}
            >
              <X size={20} />
            </button>
          </div>
          <h2>Liberar este horário?</h2>
          <p className="muted">
            A reserva de <strong>{cancelTarget.customerName}</strong> em{" "}
            {dateLabel(cancelTarget.date)} às {formatTime(cancelTarget.start)} será cancelada. Ela
            continuará no histórico.
          </p>
          {cancelError && (
            <p className="error" role="alert">
              {cancelError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="button outline"
              disabled={mutations.cancel.isPending}
              onClick={() => setCancelTarget(null)}
            >
              Manter reserva
            </button>
            <button
              className="button danger"
              disabled={mutations.cancel.isPending}
              onClick={confirmCancel}
            >
              {mutations.cancel.isPending ? "Cancelando…" : "Cancelar reserva"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

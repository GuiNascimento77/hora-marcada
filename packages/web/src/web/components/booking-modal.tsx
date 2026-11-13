import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Scissors, X } from "lucide-react";
import { useAvailability, useBookingMutations } from "../queries/agenda";
import { formatTime, schedulingError } from "../../api/domain/scheduling";
import { useAccess } from "./access-provider";

export type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  icon: string;
};
export type Professional = {
  id: string;
  name: string;
  specialty: string;
  initials: string;
  color: string;
};
export type Appointment = {
  id: string;
  serviceId: string;
  professionalId: string;
  date: string;
  start: number;
  customerName: string;
  phone: string;
  duration: number;
  price: number;
  status: "confirmed" | "cancelled";
  serviceName: string;
  professionalName: string;
  initials: string;
  color: string;
};
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) =>
  new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

// O modal prende o foco para navegação por teclado e o devolve ao botão de origem.
export function Dialog({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current!;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      );
    (focusables()[0] ?? node).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-overlay">
      <dialog open className="modal" ref={ref} aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </dialog>
    </div>
  );
}

export function BookingModal({
  services,
  professionals,
  date,
  today,
  maxDate,
  presetService,
  appointment,
  onClose,
  onSaved,
}: {
  services: Service[];
  professionals: Professional[];
  date: string;
  today: string;
  maxDate: string;
  presetService?: string;
  appointment?: Appointment;
  onClose: () => void;
  onSaved: (date: string, message: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(
    appointment?.serviceId ?? presetService ?? services[0]!.id,
  );
  const [professionalId, setProfessionalId] = useState(
    appointment?.professionalId ?? professionals[0]!.id,
  );
  const [selectedDate, setDate] = useState(appointment?.date ?? date);
  const [start, setStart] = useState<number | null>(null);
  const { demo, profile } = useAccess();
  const [name, setName] = useState(
    appointment?.customerName ?? (demo ? "" : (profile?.name ?? "")),
  );
  const [phone, setPhone] = useState(appointment?.phone ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const service = services.find((item) => item.id === serviceId)!;
  const professional = professionals.find((item) => item.id === professionalId)!;
  const availability = useAvailability({
    date: selectedDate,
    serviceId,
    professionalId,
    excludeId: appointment?.id,
  });
  const mutations = useBookingMutations();
  const pending = mutations.create.isPending || mutations.reschedule.isPending;
  const canContinue = start !== null && availability.data?.includes(start);
  const close = () => {
    if (!pending) onClose();
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (start === null) return;
    setError("");
    try {
      const input = {
        serviceId,
        professionalId,
        date: selectedDate,
        start,
        customerName: name.trim(),
        phone: demo ? "" : phone.trim(),
      };
      if (appointment) await mutations.reschedule.mutateAsync({ ...input, id: appointment.id });
      else await mutations.create.mutateAsync(input);
      setSuccess(true);
      onSaved(
        selectedDate,
        appointment ? "Reserva reagendada com sucesso." : "Novo horário reservado com sucesso.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
      void availability.refetch();
    }
  }
  return (
    <Dialog onClose={close} label={appointment ? "Reagendar reserva" : "Novo agendamento"}>
      <div className="modal-top">
        <span className="eyebrow">HORA MARCADA / {success ? "TUDO CERTO" : `ETAPA 0${step}`}</span>
        <button className="icon-button" aria-label="Fechar" onClick={close} disabled={pending}>
          <X size={20} />
        </button>
      </div>
      {success ? (
        <div className="booking-success">
          <div className="success-mark">
            <Check size={32} />
          </div>
          <h2>
            Seu próximo
            <br />
            visual tem hora.
          </h2>
          <p>{appointment ? "Reagendamento" : "Agendamento"} confirmado.</p>
          <div className="confirmation-ticket">
            <strong>{service.name}</strong>
            <span>{professional.name}</span>
            <hr />
            <b>
              {dateLabel(selectedDate)} · {formatTime(start!)}
            </b>
            <span>
              {service.duration} min · {money(service.price)}
            </span>
          </div>
          <button className="button dark full" onClick={onClose}>
            Voltar para a agenda <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <h2>{appointment ? "Um novo horário." : "Reserve seu momento."}</h2>
          <p className="muted">
            {step === 1
              ? "Escolha o cuidado, o profissional e o melhor horário."
              : "Só mais alguns detalhes para confirmar."}
          </p>
          <div className="step-track">
            <span className="active">01. Serviço & horário</span>
            <span className={step === 2 ? "active" : ""}>02. Seus dados</span>
          </div>
          {step === 1 ? (
            <div className="booking-fields">
              <label>
                Serviço
                <select
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    setStart(null);
                  }}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration} min · {money(s.price)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profissional
                <div className="professional-options">
                  {professionals.map((p) => (
                    <button
                      key={p.id}
                      className={`professional-option ${professionalId === p.id ? "selected" : ""}`}
                      onClick={() => {
                        setProfessionalId(p.id);
                        setStart(null);
                      }}
                    >
                      <span className={`avatar ${p.color}`}>{p.initials}</span>
                      <span>{p.name.split(" ")[0]}</span>
                      {professionalId === p.id && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                Data
                <input
                  aria-label="Data do agendamento"
                  type="date"
                  min={today}
                  max={maxDate}
                  value={selectedDate}
                  required
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                    setStart(null);
                  }}
                />
              </label>
              <div>
                <span className="field-label">
                  Horários disponíveis <small>São Paulo (UTC−3)</small>
                </span>
                {availability.isLoading ? (
                  <p className="inline-loading">Consultando horários…</p>
                ) : availability.isError ? (
                  <p className="error" role="alert">
                    Não foi possível consultar.{" "}
                    <button onClick={() => availability.refetch()}>Tentar novamente</button>
                  </p>
                ) : availability.data?.length ? (
                  <div className="time-options">
                    {availability.data.map((time) => (
                      <button
                        key={time}
                        className={start === time ? "selected" : ""}
                        onClick={() => setStart(time)}
                      >
                        {formatTime(time)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">
                    {schedulingError(selectedDate, 540, service.duration)?.includes("domingo")
                      ? "Domingo é dia de descanso. Escolha outra data."
                      : "Nenhum horário disponível. Tente outra data ou profissional."}
                  </p>
                )}
              </div>
              <button
                className="button dark full"
                disabled={!canContinue}
                onClick={() => setStep(2)}
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="booking-fields">
              <div className="booking-summary">
                <Scissors size={23} />
                <div>
                  <strong>{service.name}</strong>
                  <span>
                    {professional.name} · {dateLabel(selectedDate)} às {formatTime(start!)}
                  </span>
                </div>
                <b>{money(service.price)}</b>
              </div>
              <label>
                Nome do cliente
                <input
                  aria-label="Nome do cliente"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder={demo ? "Use um nome fictício" : "Nome para o atendimento"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {!demo && (
                <label>
                  Telefone <small>opcional</small>
                  <input
                    aria-label="Telefone opcional"
                    type="tel"
                    maxLength={20}
                    placeholder="Contato para o atendimento (opcional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              )}
              <p className="demo-warning">
                <Clock3 size={15} />{" "}
                {demo
                  ? "Demonstração pública: qualquer visitante pode ver e alterar estas reservas fictícias. Nenhum telefone é coletado."
                  : "Área privada: apenas o titular da reserva e a administração têm acesso. Projeto de portfólio; use dados de teste."}
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button outline"
                  disabled={pending}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={15} /> Voltar
                </button>
                <button
                  className="button dark"
                  type="submit"
                  disabled={pending || name.trim().length < 2}
                >
                  {pending
                    ? "Salvando…"
                    : appointment
                      ? "Confirmar alteração"
                      : "Confirmar agendamento"}
                  <Check size={16} />
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Dialog>
  );
}

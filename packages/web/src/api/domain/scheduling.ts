// Regras puras: não dependem de React nem do banco. Assim podemos testá-las isoladamente.
export const TIMEZONE = "America/Sao_Paulo";
export const OPEN = 9 * 60;
export const CLOSE = 19 * 60;
export const STEP = 15;

export function businessNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isSunday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}
export function blocks(start: number, duration: number) {
  return Array.from({ length: duration / STEP }, (_, i) => start + i * STEP);
}
export function formatTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export function overlaps(
  start: number,
  duration: number,
  otherStart: number,
  otherDuration: number,
) {
  return start < otherStart + otherDuration && otherStart < start + duration;
}

export function schedulingError(
  date: string,
  start: number,
  duration: number,
  now = businessNow(),
) {
  if (!isValidDate(date)) return "Data inválida.";
  if (date < now.date || (date === now.date && start <= now.minute))
    return "Escolha um horário futuro.";
  if (date > addDays(now.date, 60)) return "Agendamentos disponíveis para os próximos 60 dias.";
  if (isSunday(date)) return "A barbearia não abre aos domingos.";
  if (!Number.isInteger(start) || start % STEP !== 0)
    return "Escolha um horário em intervalos de 15 minutos.";
  if (!Number.isInteger(duration) || duration <= 0 || duration % STEP !== 0)
    return "Duração inválida.";
  if (start < OPEN || start + duration > CLOSE)
    return "O atendimento deve acontecer entre 09:00 e 19:00.";
  return null;
}

export function availableTimes(
  date: string,
  duration: number,
  occupied: number[],
  now = businessNow(),
) {
  const taken = new Set(occupied);
  const result: number[] = [];
  for (let start = OPEN; start + duration <= CLOSE; start += STEP) {
    if (
      !schedulingError(date, start, duration, now) &&
      blocks(start, duration).every((minute) => !taken.has(minute))
    )
      result.push(start);
  }
  return result;
}

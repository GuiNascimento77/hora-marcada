import { describe, expect, test } from "bun:test";
import {
  addDays,
  availableTimes,
  blocks,
  businessNow,
  formatTime,
  isValidDate,
  overlaps,
  schedulingError,
} from "./scheduling";

const now = { date: "2026-11-12", minute: 600 };
describe("Regras de agendamento", () => {
  test("aceita uma data real e recusa data inexistente", () => {
    expect(isValidDate("2026-11-12")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("12/11/2026")).toBe(false);
  });
  test("soma dias sem depender do fuso do computador", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("relógio do negócio usa São Paulo", () => {
    expect(businessNow(new Date("2026-11-12T12:30:00Z"))).toEqual({
      date: "2026-11-12",
      minute: 570,
    });
  });
  test("formata hora com zeros", () => {
    expect(formatTime(555)).toBe("09:15");
  });
  test("recusa data inválida", () => {
    expect(schedulingError("2026-02-30", 660, 30, now)).toBe("Data inválida.");
  });
  test("recusa passado e minuto atual", () => {
    expect(schedulingError("2026-11-11", 660, 30, now)).toBe("Escolha um horário futuro.");
    expect(schedulingError(now.date, 600, 30, now)).toBe("Escolha um horário futuro.");
  });
  test("recusa domingo", () => {
    expect(schedulingError("2026-11-15", 660, 30, now)).toContain("domingos");
  });
  test("recusa mais de 60 dias de antecedência", () => {
    expect(schedulingError("2027-02-01", 660, 30, now)).toContain("60 dias");
  });
  test("recusa antes da abertura", () => {
    expect(schedulingError("2026-11-13", 525, 30, now)).toContain("09:00");
  });
  test("recusa atendimento que termina após o fechamento", () => {
    expect(schedulingError("2026-11-13", 1110, 45, now)).toContain("19:00");
  });
  test("aceita atendimento que termina exatamente às 19h", () => {
    expect(schedulingError("2026-11-13", 1110, 30, now)).toBeNull();
  });
  test("recusa minuto fora do intervalo de 15", () => {
    expect(schedulingError("2026-11-13", 601, 30, now)).toContain("15 minutos");
  });
  test("recusa duração inválida", () => {
    expect(schedulingError("2026-11-13", 660, 0, now)).toBe("Duração inválida.");
  });
  test("cria todos os blocos necessários", () => {
    expect(blocks(600, 45)).toEqual([600, 615, 630]);
  });
  test("reservas adjacentes não se sobrepõem", () => {
    expect(overlaps(600, 45, 645, 30)).toBe(false);
  });
  test("detecta sobreposição parcial e total", () => {
    expect(overlaps(600, 45, 630, 30)).toBe(true);
    expect(overlaps(600, 75, 615, 30)).toBe(true);
  });
  test("disponibilidade exclui serviço que cruza um bloco ocupado", () => {
    const result = availableTimes("2026-11-13", 45, [600, 615, 630], now);
    expect(result).not.toContain(570);
    expect(result).not.toContain(585);
    expect(result).not.toContain(600);
    expect(result).toContain(645);
  });
  test("domingo não oferece horários", () => {
    expect(availableTimes("2026-11-15", 30, [], now)).toEqual([]);
  });
  test("hoje só oferece horários futuros", () => {
    expect(availableTimes(now.date, 30, [], now)[0]).toBe(615);
  });
  test("último horário respeita duração", () => {
    expect(availableTimes("2026-11-13", 75, [], now).at(-1)).toBe(1065);
  });
});

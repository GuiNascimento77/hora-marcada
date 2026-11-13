import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { addDays, businessNow, isSunday } from "../domain/scheduling";

// Testes usam um SQLite temporário, NUNCA o banco de demonstração ou produção.
const folder = await mkdtemp(join(tmpdir(), "hora-marcada-test-"));
process.env.DATABASE_URL = `file:${join(folder, "test.db")}`;
delete process.env.DATABASE_AUTH_TOKEN;
process.env.BETTER_AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
process.env.WEBSITE_URL = "http://localhost:4200";
delete process.env.APPLICATION_ID;
delete process.env.VITE_RUNABLE_AUTH_ISSUER;
const migrations = new URL("../../../drizzle/", import.meta.url);
const sqlClient = createClient({ url: process.env.DATABASE_URL });
for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
  await sqlClient.executeMultiple(await readFile(new URL(file, migrations), "utf8"));
}
const { agenda, demoAgenda } = await import("./agenda");
const { profile } = await import("./profile");
const { auth } = await import("../auth");
const { user, session, account } = await import("../database/auth-schema");
const { db } = await import("../database");
// Os testes originais continuam cobrindo a demo; a área privada é testada abaixo com sessões reais.
const client = createRouterClient({ agenda: demoAgenda }, { context: { headers: new Headers() } });
const anonymous = createRouterClient(
  { agenda, demoAgenda, profile },
  { context: { headers: new Headers() } },
);
function authenticated(token: string) {
  return createRouterClient(
    { agenda, demoAgenda, profile },
    { context: { headers: new Headers({ authorization: `Bearer ${token}` }) } },
  );
}
let date = addDays(businessNow().date, 10);
if (isSunday(date)) date = addDays(date, 1);
const input = {
  serviceId: "corte",
  professionalId: "rafael",
  date,
  start: 600,
  customerName: "Cliente Teste",
  phone: "",
};
let id: string;

beforeAll(async () => {
  await client.agenda.catalog();
});
afterAll(async () => {
  sqlClient.close();
  db.$client.close();
  await rm(folder, { recursive: true, force: true });
});

describe("API + SQLite: reservas e transações", () => {
  test("catálogo tem quatro serviços e três profissionais", async () => {
    const catalog = await client.agenda.catalog();
    expect(catalog.services).toHaveLength(4);
    expect(catalog.professionals).toHaveLength(3);
  });
  test("cria reserva e guarda preço em centavos", async () => {
    ({ id } = await client.agenda.create(input));
    const list = await client.agenda.list({ date });
    expect(list.find((a) => a.id === id)?.price).toBe(4500);
    expect(list.find((a) => a.id === id)?.status).toBe("confirmed");
  });
  test("recusa duplicata no mesmo profissional", async () => {
    await expect(client.agenda.create(input)).rejects.toThrow("reservado");
    expect(await client.agenda.list({ date })).toHaveLength(1);
  });
  test("recusa sobreposição parcial", async () => {
    await expect(client.agenda.create({ ...input, start: 630 })).rejects.toThrow("reservado");
  });
  test("horário ocupado some da disponibilidade", async () => {
    const times = await client.agenda.availability(input);
    expect(times).not.toContain(600);
    expect(times).not.toContain(630);
    expect(times).toContain(645);
  });
  test("permite o mesmo horário com outro profissional", async () => {
    await client.agenda.create({ ...input, professionalId: "lucas" });
    expect(await client.agenda.list({ date })).toHaveLength(2);
  });
  test("reagendamento em conflito preserva horário antigo", async () => {
    await client.agenda.create({ ...input, start: 660 });
    await expect(client.agenda.reschedule({ ...input, id, start: 675 })).rejects.toThrow(
      "reservado",
    );
    expect((await client.agenda.list({ date })).find((a) => a.id === id)?.start).toBe(600);
    expect(await client.agenda.availability(input)).not.toContain(600);
  });
  test("reagenda de forma atômica e libera horário anterior", async () => {
    await client.agenda.reschedule({ ...input, id, start: 780 });
    expect((await client.agenda.list({ date })).find((a) => a.id === id)?.start).toBe(780);
    expect(await client.agenda.availability(input)).toContain(600);
  });
  test("cancelamento preserva histórico e libera blocos", async () => {
    await client.agenda.cancel({ id });
    expect((await client.agenda.list({ date })).find((a) => a.id === id)?.status).toBe("cancelled");
    expect(await client.agenda.availability(input)).toContain(780);
  });
  test("reserva cancelada não pode ser reagendada", async () => {
    await expect(client.agenda.reschedule({ ...input, id, start: 780 })).rejects.toThrow("ativa");
  });
  test("valida nome antes de salvar", async () => {
    await expect(client.agenda.create({ ...input, customerName: " " })).rejects.toThrow();
  });
  test("recusa serviço inexistente", async () => {
    await expect(client.agenda.create({ ...input, serviceId: "nao-existe" })).rejects.toThrow(
      "não encontrado",
    );
  });
  test("recusa profissional inexistente", async () => {
    await expect(client.agenda.create({ ...input, professionalId: "nao-existe" })).rejects.toThrow(
      "não encontrado",
    );
  });
  test("recusa telefone malformado", async () => {
    await expect(client.agenda.create({ ...input, phone: "abc" })).rejects.toThrow();
  });
  test("API recusa atendimento no passado", async () => {
    await expect(client.agenda.create({ ...input, date: "2020-01-01" })).rejects.toThrow("futuro");
  });
  test("duas solicitações simultâneas não criam duas reservas", async () => {
    const requests = await Promise.allSettled([
      client.agenda.create({ ...input, start: 990 }),
      client.agenda.create({ ...input, start: 990 }),
    ]);
    expect(requests.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = requests.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("CONFLICT");
    expect(
      (await client.agenda.list({ date })).filter(
        (a) => a.professionalId === "rafael" && a.start === 990,
      ),
    ).toHaveLength(1);
  });
});

describe("Acesso privado, autenticação e isolamento da demonstração", () => {
  let alice: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  let bob: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  let manager: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  let aliceClient: ReturnType<typeof authenticated>;
  let bobClient: ReturnType<typeof authenticated>;
  let adminClient: ReturnType<typeof authenticated>;
  let privateId: string;
  let demoId: string;
  const password = "Teste-Apenas-!2026";
  const privateInput = {
    ...input,
    start: 600,
    customerName: "Alice Privada",
    phone: "11900000000",
  };

  beforeAll(async () => {
    alice = await auth.api.signUpEmail({
      body: { name: "Alice Teste", email: "alice@example.test", password },
    });
    bob = await auth.api.signUpEmail({
      body: { name: "Bob Teste", email: "bob@example.test", password },
    });
    manager = await auth.api.signUpEmail({
      body: { name: "Admin Teste", email: "admin@example.test", password },
    });
    await db.update(user).set({ role: "admin" }).where(eq(user.id, manager.user.id));
    aliceClient = authenticated(alice.token!);
    bobClient = authenticated(bob.token!);
    adminClient = authenticated(manager.token!);
  });
  test("visitante não consegue listar reservas privadas", async () => {
    await expect(anonymous.agenda.list({ date })).rejects.toThrow("Entre");
  });
  test("visitante não consegue criar reserva privada", async () => {
    await expect(anonymous.agenda.create(privateInput)).rejects.toThrow("Entre");
  });
  test("visitante não consegue cancelar ou reagendar", async () => {
    await expect(anonymous.agenda.cancel({ id: "any" })).rejects.toThrow("Entre");
    await expect(anonymous.agenda.reschedule({ ...privateInput, id: "any" })).rejects.toThrow(
      "Entre",
    );
  });
  test("token inventado não autentica", async () => {
    await expect(authenticated("token-falso").profile()).rejects.toThrow("Entre");
  });
  test("cadastro define cliente, nunca administrador", async () => {
    expect((await aliceClient.profile()).role).toBe("customer");
    const response = await auth.handler(
      new Request("http://localhost:4200/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:4200" },
        body: JSON.stringify({
          name: "Tentativa Admin",
          email: "forge@example.test",
          password,
          role: "admin",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { user: { role: string } };
    expect(result.user.role).toBe("customer");
  });
  test("senhas são armazenadas como hash", async () => {
    const [stored] = await db.select().from(account).where(eq(account.userId, alice.user.id));
    expect(stored!.password).not.toBe(password);
    expect(stored!.password!.length).toBeGreaterThan(50);
  });
  test("e-mail e senha corretos criam sessão válida", async () => {
    const signed = await auth.api.signInEmail({ body: { email: "alice@example.test", password } });
    expect((await authenticated(signed.token).profile()).id).toBe(alice.user.id);
  });
  test("senha incorreta é rejeitada", async () => {
    await expect(
      auth.api.signInEmail({ body: { email: "alice@example.test", password: "Incorreta-!" } }),
    ).rejects.toThrow();
  });
  test("origem não permitida não pode autenticar", async () => {
    const response = await auth.handler(
      new Request("http://localhost:4200/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://hostil.example" },
        body: JSON.stringify({ email: "alice@example.test", password }),
      }),
    );
    expect(response.status).toBe(403);
  });
  test("reserva recebe dono e escopo da sessão, não do corpo", async () => {
    const hostileInput = { ...privateInput, userId: bob.user.id, scope: "demo", role: "admin" };
    ({ id: privateId } = await aliceClient.agenda.create(hostileInput));
    const stored = await sqlClient.execute({
      sql: "select user_id, scope from appointments where id=?",
      args: [privateId],
    });
    expect(stored.rows[0]!.user_id).toBe(alice.user.id);
    expect(stored.rows[0]!.scope).toBe("private");
  });
  test("cliente lê suas reservas e não as de outra conta", async () => {
    expect((await aliceClient.agenda.list({ date })).map((a) => a.id)).toContain(privateId);
    expect(await bobClient.agenda.list({ date })).toEqual([]);
  });
  test("outra conta não cancela reserva alheia", async () => {
    await expect(bobClient.agenda.cancel({ id: privateId })).rejects.toThrow("não encontrada");
    expect((await aliceClient.agenda.list({ date }))[0]!.status).toBe("confirmed");
  });
  test("outra conta não reage agenda alheia", async () => {
    await expect(
      bobClient.agenda.reschedule({ ...privateInput, id: privateId, start: 780 }),
    ).rejects.toThrow("não encontrada");
    expect((await aliceClient.agenda.list({ date }))[0]!.start).toBe(600);
  });
  test("excludeId não permite ignorar reserva alheia", async () => {
    await expect(
      bobClient.agenda.availability({ ...privateInput, excludeId: privateId }),
    ).rejects.toThrow("não encontrada");
    expect(await bobClient.agenda.availability(privateInput)).not.toContain(600);
  });
  test("demo não lista nem altera reserva privada, mesmo conhecendo seu id", async () => {
    expect((await anonymous.demoAgenda.list({ date })).map((a) => a.id)).not.toContain(privateId);
    await expect(anonymous.demoAgenda.cancel({ id: privateId })).rejects.toThrow("não encontrada");
    await expect(
      anonymous.demoAgenda.reschedule({ ...input, id: privateId, start: 780 }),
    ).rejects.toThrow("não encontrada");
    await expect(
      anonymous.demoAgenda.availability({ ...input, excludeId: privateId }),
    ).rejects.toThrow("não encontrada");
  });
  test("demo e privado têm disponibilidade independente", async () => {
    expect(await anonymous.demoAgenda.availability(input)).toContain(600);
    ({ id: demoId } = await anonymous.demoAgenda.create({
      ...input,
      customerName: "Visitante Demo",
    }));
    expect((await aliceClient.agenda.list({ date })).map((a) => a.id)).not.toContain(demoId);
  });
  test("API demo não coleta telefone", async () => {
    await expect(
      anonymous.demoAgenda.create({ ...input, start: 900, phone: "11900000000" }),
    ).rejects.toThrow("não coleta");
  });
  test("conta privada não altera demo pelo namespace privado", async () => {
    await expect(adminClient.agenda.cancel({ id: demoId })).rejects.toThrow("não encontrada");
  });
  test("cliente pode reagendar e cancelar sua própria reserva", async () => {
    await aliceClient.agenda.reschedule({ ...privateInput, id: privateId, start: 780 });
    expect((await aliceClient.agenda.list({ date }))[0]!.start).toBe(780);
    await aliceClient.agenda.cancel({ id: privateId });
    expect((await aliceClient.agenda.list({ date }))[0]!.status).toBe("cancelled");
  });
  test("administrador lê e gerencia todas as reservas privadas", async () => {
    const created = await bobClient.agenda.create({
      ...privateInput,
      customerName: "Bob Privado",
      start: 660,
    });
    expect((await adminClient.agenda.list({ date })).map((a) => a.id)).toContain(created.id);
    await adminClient.agenda.reschedule({
      ...privateInput,
      id: created.id,
      customerName: "Bob Privado",
      start: 900,
    });
    expect((await bobClient.agenda.list({ date }))[0]!.start).toBe(900);
    await adminClient.agenda.cancel({ id: created.id });
    expect((await bobClient.agenda.list({ date }))[0]!.status).toBe("cancelled");
  });
  test("revogação de papel vale imediatamente com a mesma sessão", async () => {
    await db.update(user).set({ role: "customer" }).where(eq(user.id, manager.user.id));
    expect((await adminClient.profile()).role).toBe("customer");
    expect(await adminClient.agenda.list({ date })).toEqual([]);
    await expect(adminClient.agenda.cancel({ id: privateId })).rejects.toThrow("não encontrada");
  });
  test("sessão expirada não acessa API", async () => {
    const signed = await auth.api.signInEmail({ body: { email: "bob@example.test", password } });
    await db
      .update(session)
      .set({ expiresAt: new Date(0) })
      .where(eq(session.token, signed.token));
    await expect(authenticated(signed.token).profile()).rejects.toThrow("Entre");
  });
  test("sair revoga token, que deixa de acessar API", async () => {
    const signed = await auth.api.signInEmail({ body: { email: "bob@example.test", password } });
    const headers = new Headers({ authorization: `Bearer ${signed.token}` });
    await auth.api.signOut({ headers });
    await expect(authenticated(signed.token).profile()).rejects.toThrow("Entre");
  });
  test("limita tentativas consecutivas de login", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const response = await auth.handler(
        new Request("http://localhost:4200/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:4200" },
          body: JSON.stringify({ email: "ninguem@example.test", password: "Incorreta-!2026" }),
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  });
});

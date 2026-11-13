import { z } from "zod";
import { and, asc, eq, ne } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import { appointments, occupiedSlots, professionals, services } from "../database/schema";
import { ensureSeed, initialDate } from "../database/seed";
import { assertOwnership, resolveAccess, type Access } from "../middleware/auth";
import {
  addDays,
  availableTimes,
  blocks,
  businessNow,
  isValidDate,
  schedulingError,
} from "../domain/scheduling";

const dateSchema = z.string().refine(isValidDate, "Data inválida.");
const bookingInput = z.object({
  serviceId: z.string(),
  professionalId: z.string(),
  date: dateSchema,
  start: z.number().int(),
  customerName: z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .default("")
    .refine((value) => !value || /^\+?[\d\s()-]{8,20}$/.test(value), "Telefone inválido."),
});

async function validateBooking(input: z.infer<typeof bookingInput>) {
  await ensureSeed();
  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId));
  const [professional] = await db
    .select()
    .from(professionals)
    .where(eq(professionals.id, input.professionalId));
  if (!service || !professional)
    throw new ORPCError("NOT_FOUND", { message: "Serviço ou profissional não encontrado." });
  const error = schedulingError(input.date, input.start, service.duration);
  if (error) throw new ORPCError("BAD_REQUEST", { message: error });
  return service;
}

function rethrowConflict(error: unknown): never {
  if (error instanceof ORPCError) throw error;
  // A mensagem da restrição pode estar no erro ou em sua causa, dependendo do driver.
  let current: unknown = error;
  for (let i = 0; i < 6 && current instanceof Error; i++) {
    if (/unique constraint|SQLITE_CONSTRAINT|professional_date_minute/i.test(current.message)) {
      throw new ORPCError("CONFLICT", {
        message: "Esse horário acabou de ser reservado. Escolha outro horário.",
      });
    }
    if (/SQLITE_BUSY|database is locked/i.test(current.message)) {
      throw new ORPCError("CONFLICT", {
        message:
          "A agenda recebeu outra alteração ao mesmo tempo. Atualize os horários e tente novamente.",
      });
    }
    current = current.cause;
  }
  console.error("Falha de persistência da agenda", error);
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: "Não foi possível salvar. Tente novamente.",
  });
}

function createAgendaRouter(scope: "demo" | "private") {
  const scoped = base.use(async ({ context, next }) => {
    const access: Access =
      scope === "demo"
        ? { scope: "demo", actorId: null, role: "demo" }
        : await resolveAccess(context.headers);
    return next({ context: { access } });
  });
  return {
    catalog: scoped.handler(async () => {
      await ensureSeed();
      return {
        services: await db.select().from(services),
        professionals: await db.select().from(professionals),
        today: businessNow().date,
        initialDate: initialDate(),
        maxDate: addDays(businessNow().date, 60),
      };
    }),
    list: scoped.input(z.object({ date: dateSchema })).handler(async ({ input, context }) => {
      await ensureSeed();
      return db
        .select({
          id: appointments.id,
          customerName: appointments.customerName,
          phone: appointments.phone,
          date: appointments.date,
          start: appointments.start,
          duration: appointments.duration,
          price: appointments.price,
          status: appointments.status,
          serviceId: appointments.serviceId,
          professionalId: appointments.professionalId,
          serviceName: services.name,
          professionalName: professionals.name,
          initials: professionals.initials,
          color: professionals.color,
        })
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
        .where(
          and(
            eq(appointments.date, input.date),
            eq(appointments.scope, scope),
            context.access.role === "customer"
              ? eq(appointments.userId, context.access.actorId!)
              : undefined,
          ),
        )
        .orderBy(asc(appointments.start));
    }),
    availability: scoped
      .input(
        z.object({
          date: dateSchema,
          serviceId: z.string(),
          professionalId: z.string(),
          excludeId: z.string().optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        await ensureSeed();
        if (input.excludeId) {
          const [reservation] = await db
            .select()
            .from(appointments)
            .where(eq(appointments.id, input.excludeId));
          assertOwnership(context.access, reservation);
        }
        const [service] = await db.select().from(services).where(eq(services.id, input.serviceId));
        const [professional] = await db
          .select()
          .from(professionals)
          .where(eq(professionals.id, input.professionalId));
        if (!service || !professional)
          throw new ORPCError("NOT_FOUND", { message: "Selecione um serviço e um profissional." });
        const occupied = await db
          .select()
          .from(occupiedSlots)
          .where(
            and(
              eq(occupiedSlots.scope, scope),
              eq(occupiedSlots.date, input.date),
              eq(occupiedSlots.professionalId, input.professionalId),
              input.excludeId ? ne(occupiedSlots.appointmentId, input.excludeId) : undefined,
            ),
          );
        return availableTimes(
          input.date,
          service.duration,
          occupied.map((slot) => slot.minute),
        );
      }),
    create: scoped.input(bookingInput).handler(async ({ input, context }) => {
      if (scope === "demo" && input.phone)
        throw new ORPCError("BAD_REQUEST", {
          message: "A demonstração não coleta telefones. Use dados fictícios.",
        });
      const service = await validateBooking(input);
      const id = crypto.randomUUID();
      try {
        // Uma transação salva a reserva e os blocos juntos. Se houver conflito,
        // nenhuma parte fica gravada: não existem reservas pela metade.
        await db.transaction(async (tx) => {
          await tx.insert(appointments).values({
            ...input,
            id,
            scope,
            userId: context.access.actorId,
            duration: service.duration,
            price: service.price,
            createdAt: new Date().toISOString(),
          });
          await tx.insert(occupiedSlots).values(
            blocks(input.start, service.duration).map((minute) => ({
              id: `${id}-${minute}`,
              appointmentId: id,
              scope,
              professionalId: input.professionalId,
              date: input.date,
              minute,
            })),
          );
        });
      } catch (error) {
        rethrowConflict(error);
      }
      return { id };
    }),
    reschedule: scoped
      .input(bookingInput.extend({ id: z.string() }))
      .handler(async ({ input, context }) => {
        if (scope === "demo" && input.phone)
          throw new ORPCError("BAD_REQUEST", { message: "A demonstração não coleta telefones." });
        const service = await validateBooking(input);
        try {
          await db.transaction(async (tx) => {
            const [old] = await tx.select().from(appointments).where(eq(appointments.id, input.id));
            assertOwnership(context.access, old);
            if (!old || old.status !== "confirmed")
              throw new ORPCError("NOT_FOUND", { message: "Esta reserva não está ativa." });
            await tx.delete(occupiedSlots).where(eq(occupiedSlots.appointmentId, input.id));
            await tx
              .update(appointments)
              .set({
                serviceId: input.serviceId,
                professionalId: input.professionalId,
                date: input.date,
                start: input.start,
                customerName: input.customerName,
                phone: input.phone,
                duration: service.duration,
                price: service.price,
              })
              .where(eq(appointments.id, input.id));
            await tx.insert(occupiedSlots).values(
              blocks(input.start, service.duration).map((minute) => ({
                id: `${input.id}-${minute}`,
                appointmentId: input.id,
                scope,
                professionalId: input.professionalId,
                date: input.date,
                minute,
              })),
            );
          });
        } catch (error) {
          rethrowConflict(error);
        }
        return { id: input.id };
      }),
    cancel: scoped.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
      await ensureSeed();
      await db.transaction(async (tx) => {
        const [old] = await tx.select().from(appointments).where(eq(appointments.id, input.id));
        assertOwnership(context.access, old);
        if (!old) throw new ORPCError("NOT_FOUND", { message: "Reserva não encontrada." });
        await tx.delete(occupiedSlots).where(eq(occupiedSlots.appointmentId, input.id));
        await tx
          .update(appointments)
          .set({ status: "cancelled" })
          .where(eq(appointments.id, input.id));
      });
      return { success: true };
    }),
  };
}

// Namespaces distintos, com escopo decidido pelo servidor — não por campos enviados pelo cliente.
export const agenda = createAgendaRouter("private");
export const demoAgenda = createAgendaRouter("demo");

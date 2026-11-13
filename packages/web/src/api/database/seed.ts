import { eq } from "drizzle-orm";
import { db } from "./index";
import { appointments, occupiedSlots, professionals, services, settings } from "./schema";
import { addDays, blocks, businessNow, CLOSE, isSunday } from "../domain/scheduling";

export const serviceData = [
  {
    id: "corte",
    name: "Corte de cabelo",
    description: "Do clássico ao degradê. Seu corte, do seu jeito.",
    duration: 45,
    price: 4500,
    icon: "scissors",
  },
  {
    id: "barba",
    name: "Barba & acabamento",
    description: "Toalha quente, precisão e um acabamento impecável.",
    duration: 30,
    price: 3500,
    icon: "razor",
  },
  {
    id: "combo",
    name: "Corte + barba",
    description: "O cuidado completo. Cabelo e barba em sintonia.",
    duration: 75,
    price: 7000,
    icon: "sparkles",
  },
  {
    id: "acabamento",
    name: "Acabamento",
    description: "Os pequenos detalhes que fazem toda a diferença.",
    duration: 15,
    price: 2000,
    icon: "comb",
  },
];
export const professionalData = [
  {
    id: "rafael",
    name: "Rafael Costa",
    specialty: "Degradê & cortes modernos",
    initials: "RC",
    color: "sage",
  },
  {
    id: "lucas",
    name: "Lucas Martins",
    specialty: "Barba & estilo clássico",
    initials: "LM",
    color: "peach",
  },
  {
    id: "andre",
    name: "André Santos",
    specialty: "Cortes & visagismo",
    initials: "AS",
    color: "lavender",
  },
];

export function initialDate() {
  const now = businessNow();
  let date = now.minute >= CLOSE ? addDays(now.date, 1) : now.date;
  if (isSunday(date)) date = addDays(date, 1);
  return date;
}

let initialization: Promise<void> | undefined;
// O marcador persistido evita recriar reservas de demonstração a cada reinício.
export function ensureSeed() {
  initialization ??= seed().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

async function seed() {
  await db.insert(services).values(serviceData).onConflictDoNothing();
  await db.insert(professionals).values(professionalData).onConflictDoNothing();
  const seeded = await db.select().from(settings).where(eq(settings.key, "demo-seeded-v1"));
  if (seeded.length) return;
  await db.transaction(async (tx) => {
    const marker = await tx
      .insert(settings)
      .values({ key: "demo-seeded-v1", value: initialDate() })
      .onConflictDoNothing()
      .returning();
    if (!marker.length) return;
    const customers = [
      "Gabriel Oliveira",
      "Pedro Almeida",
      "Matheus Lima",
      "Bruno Ferreira",
      "Felipe Souza",
    ];
    for (let day = 0; day < 3; day++) {
      const date = addDays(initialDate(), day);
      if (isSunday(date)) continue;
      for (let i = 0; i < 5; i++) {
        const service = serviceData[[0, 2, 1, 0, 2][i]]!;
        const professional = professionalData[i % 3]!;
        const id = `demo-${date}-${i}`;
        const start = [600, 660, 810, 870, 960][i]!;
        await tx
          .insert(appointments)
          .values({
            id,
            date,
            start,
            serviceId: service.id,
            professionalId: professional.id,
            customerName: customers[(i + day) % customers.length]!,
            duration: service.duration,
            price: service.price,
            status: "confirmed",
            createdAt: new Date().toISOString(),
          });
        await tx
          .insert(occupiedSlots)
          .values(
            blocks(start, service.duration).map((minute) => ({
              id: `${id}-${minute}`,
              appointmentId: id,
              date,
              professionalId: professional.id,
              minute,
            })),
          );
      }
    }
  });
}

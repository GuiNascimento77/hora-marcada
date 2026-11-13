import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
export * from "./auth-schema";

// Preço em centavos evita os arredondamentos de números decimais em dinheiro.
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  duration: integer("duration").notNull(),
  price: integer("price").notNull(),
  icon: text("icon").notNull(),
});

export const professionals = sqliteTable("professionals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  initials: text("initials").notNull(),
  color: text("color").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  scope: text("scope", { enum: ["demo", "private"] })
    .notNull()
    .default("demo"),
  userId: text("user_id").references(() => user.id),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  professionalId: text("professional_id")
    .notNull()
    .references(() => professionals.id),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull().default(""),
  date: text("date").notNull(),
  start: integer("start").notNull(),
  duration: integer("duration").notNull(),
  price: integer("price").notNull(),
  status: text("status", { enum: ["confirmed", "cancelled"] })
    .notNull()
    .default("confirmed"),
  createdAt: text("created_at").notNull(),
});

// Cada serviço ocupa blocos de 15 minutos. A unicidade é aplicada pelo banco,
// não só pela interface, e protege contra duas reservas simultâneas.
export const occupiedSlots = sqliteTable(
  "occupied_slots",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id),
    scope: text("scope", { enum: ["demo", "private"] })
      .notNull()
      .default("demo"),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id),
    date: text("date").notNull(),
    minute: integer("minute").notNull(),
  },
  (table) => [
    uniqueIndex("scope_professional_date_minute").on(
      table.scope,
      table.professionalId,
      table.date,
      table.minute,
    ),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { auth } from "../auth";
import { db } from "../database";
import { user } from "../database/auth-schema";

export type Access = {
  scope: "demo" | "private";
  actorId: string | null;
  role: "demo" | "customer" | "admin";
};
export async function resolveAccess(headers: Headers): Promise<Access> {
  const session = await auth.api.getSession({ headers });
  if (!session)
    throw new ORPCError("UNAUTHORIZED", { message: "Entre na sua conta para acessar a agenda." });
  // Papel é relido no banco: alteração/revogação não espera um cookie em cache expirar.
  const [current] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id));
  if (!current) throw new ORPCError("UNAUTHORIZED");
  return {
    scope: "private",
    actorId: current.id,
    role: current.role === "admin" ? "admin" : "customer",
  };
}

export function assertOwnership(
  access: Access,
  reservation: { scope: string; userId: string | null } | undefined,
) {
  // Mesmo erro para id inexistente e id de outra pessoa: não revela a existência de uma reserva.
  if (
    !reservation ||
    reservation.scope !== access.scope ||
    (access.scope === "private" && access.role !== "admin" && reservation.userId !== access.actorId)
  ) {
    throw new ORPCError("NOT_FOUND", { message: "Reserva não encontrada." });
  }
}

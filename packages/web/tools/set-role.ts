import { eq } from "drizzle-orm";
import { db } from "../src/api/database";
import { user } from "../src/api/database/auth-schema";

// Ferramenta operacional: exige acesso ao .env/banco, nunca vira endpoint público.
const [email, role] = process.argv.slice(2);
if (!email || (role && !["admin", "customer"].includes(role))) {
  console.error(
    "Uso (em packages/web): bun --env-file=../../.env tools/set-role.ts email [admin|customer]",
  );
  process.exit(1);
}
try {
  const [existing] = await db.select().from(user).where(eq(user.email, email.trim().toLowerCase()));
  if (!existing)
    throw new Error("Conta não encontrada. Cadastre a conta antes de conceder acesso.");
  if (role) await db.update(user).set({ role }).where(eq(user.id, existing.id));
  console.log(
    `Papel: ${role ?? existing.role}. ${role ? "Alteração salva; vale na próxima requisição à API." : "Nenhuma alteração realizada."}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Não foi possível alterar o papel.");
  process.exitCode = 1;
} finally {
  db.$client.close();
}

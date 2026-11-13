import { base } from "../__core/app";
import { auth } from "../auth";
import { resolveAccess } from "../middleware/auth";

export const profile = base.handler(async ({ context }) => {
  const access = await resolveAccess(context.headers);
  const current = await auth.api.getSession({ headers: context.headers });
  return {
    id: access.actorId!,
    role: access.role,
    name: current!.user.name,
    email: current!.user.email,
  };
});

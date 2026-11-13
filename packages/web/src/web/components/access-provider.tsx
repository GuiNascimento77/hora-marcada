import { createContext, useContext } from "react";

export type AccountProfile = { id: string; name: string; email: string; role: string };
const AccessContext = createContext<{ demo: boolean; profile?: AccountProfile }>({ demo: true });
export function AccessProvider({
  demo,
  profile,
  children,
}: {
  demo: boolean;
  profile?: AccountProfile;
  children: React.ReactNode;
}) {
  return <AccessContext.Provider value={{ demo, profile }}>{children}</AccessContext.Provider>;
}
export function useAccess() {
  return useContext(AccessContext);
}

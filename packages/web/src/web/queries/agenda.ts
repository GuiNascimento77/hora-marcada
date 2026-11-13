import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAccess } from "../components/access-provider";

function useAgendaApi() {
  const { demo, profile } = useAccess();
  return {
    api: demo ? orpc.demoAgenda : orpc.agenda,
    scopeKey: demo ? "demo" : `private-${profile?.id}-${profile?.role}`,
  };
}

export function useCatalog() {
  const { api, scopeKey } = useAgendaApi();
  return useQuery({
    ...api.catalog.queryOptions({ staleTime: 60_000 }),
    queryKey: ["agenda", scopeKey, "catalog"],
  });
}
export function useAppointments(date: string) {
  const { api, scopeKey } = useAgendaApi();
  return useQuery({
    ...api.list.queryOptions({ input: { date }, enabled: Boolean(date) }),
    queryKey: ["agenda", scopeKey, "list", date],
  });
}
export function useAvailability(input: {
  date: string;
  serviceId: string;
  professionalId: string;
  excludeId?: string;
}) {
  const { api, scopeKey } = useAgendaApi();
  return useQuery({
    ...api.availability.queryOptions({
      input,
      enabled: Boolean(input.date && input.serviceId && input.professionalId),
      staleTime: 0,
    }),
    queryKey: ["agenda", scopeKey, "availability", input],
  });
}
export function useBookingMutations() {
  const { api, scopeKey } = useAgendaApi();
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ["agenda", scopeKey] });
  return {
    create: useMutation(api.create.mutationOptions({ onSuccess })),
    reschedule: useMutation(api.reschedule.mutationOptions({ onSuccess })),
    cancel: useMutation(api.cancel.mutationOptions({ onSuccess })),
  };
}

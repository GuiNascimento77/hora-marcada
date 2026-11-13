import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useProfile(userId: string) {
  return useQuery({
    ...orpc.profile.queryOptions(),
    queryKey: ["private-profile", userId],
    enabled: Boolean(userId),
    staleTime: 0,
    retry: false,
  });
}

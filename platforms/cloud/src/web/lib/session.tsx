import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router";
import { ApiError, api, unwrap } from "./api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await unwrap(api.me.$get());
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export type Me = NonNullable<ReturnType<typeof useMe>["data"]>;

/** The logged-in user. Only inside <RequireAuth>. */
export function useUser(): Me {
  const { data } = useMe();
  if (!data) throw new Error("useUser outside <RequireAuth>");
  return data;
}

export function useInstance() {
  return useQuery({
    queryKey: ["instance", "public"],
    queryFn: () => unwrap(api.instance.public.$get()),
    staleTime: 5 * 60_000,
  });
}

/** Renders its routes only for logged-in users; others go to the login page. */
export function RequireAuth() {
  const { data, isPending } = useMe();
  const location = useLocation();
  if (isPending) return null;
  if (!data) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const user = useUser();
  if (user.role !== "admin") return <Navigate to="/books" replace />;
  return <Outlet />;
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await unwrap(api.auth.logout.$post());
    queryClient.clear();
    window.location.assign("/login");
  };
}

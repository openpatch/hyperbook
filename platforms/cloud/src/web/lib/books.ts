import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./api";

export function useBook(id: string) {
  return useQuery({
    queryKey: ["books", id],
    queryFn: () => unwrap(api.books[":id"].$get({ param: { id } })),
  });
}

export type Book = NonNullable<ReturnType<typeof useBook>["data"]>;

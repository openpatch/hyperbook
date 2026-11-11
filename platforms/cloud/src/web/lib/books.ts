import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./api";

const fetchBook = (id: string) => unwrap(api.books[":id"].$get({ param: { id } }));
type BookResponse = Awaited<ReturnType<typeof fetchBook>>;

/**
 * A book as GET /books/:id has it. `viewer` (who is looking: an account or
 * an access link) and `commentMail` are missing in the answers of the routes
 * that change a book, which pages put into the cache too.
 */
export type Book = Omit<BookResponse, "viewer" | "commentMail"> &
  Partial<Pick<BookResponse, "viewer" | "commentMail">>;

export function useBook(id: string) {
  return useQuery<Book>({
    queryKey: ["books", id],
    queryFn: () => fetchBook(id),
  });
}

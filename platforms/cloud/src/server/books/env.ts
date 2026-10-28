import type { StudentSession } from "../auth/student-sessions";
import type { BookRow } from "../domain/books";

export type BookBindings = {
  /** Subdomain label of the request, e.g. "physics-7a". */
  label: string;
  /** The request came in on the book's active custom domain. */
  customDomain?: boolean;
};

export type BookEnv = {
  Bindings: BookBindings;
  Variables: {
    /** The book this host belongs to. */
    book: BookRow;
    /** The logged-in student (cookie or Bearer token), if any. */
    student: StudentSession | null;
  };
};

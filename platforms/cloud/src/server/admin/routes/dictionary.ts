import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  addDictionaryWordInput,
  dictionaryWord,
} from "../../../shared/schemas";
import { bookDictionary } from "../../db/schema";
import type { Deps } from "../../deps";
import { bookAccess } from "../../domain/books";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

/** The book's words, as the editor's spell check reads them. */
function wordsOf(db: Deps["db"], bookId: number) {
  return db
    .select({ word: bookDictionary.word })
    .from(bookDictionary)
    .where(eq(bookDictionary.bookId, bookId))
    .all()
    .map((row) => row.word);
}

/** /api/books/:id/dictionary — words the book's teachers accepted. */
export function bookDictionaryRoutes({ db }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/:id/dictionary", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json({ words: wordsOf(db, book.id) });
    })

    .post(
      "/:id/dictionary",
      idParam,
      validate("json", addDictionaryWordInput),
      (c) => {
        const user = c.get("user");
        const { book } = bookAccess(db, user, c.req.valid("param").id);
        db.insert(bookDictionary)
          .values({
            bookId: book.id,
            word: c.req.valid("json").word,
            addedBy: user.id,
          })
          .onConflictDoNothing()
          .run();
        return c.json({ words: wordsOf(db, book.id) });
      },
    )

    .delete(
      "/:id/dictionary/:word",
      validate(
        "param",
        z.object({
          id: z.coerce.number().int().positive(),
          word: dictionaryWord,
        }),
      ),
      (c) => {
        const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
        db.delete(bookDictionary)
          .where(
            and(
              eq(bookDictionary.bookId, book.id),
              eq(bookDictionary.word, c.req.valid("param").word),
            ),
          )
          .run();
        return c.json({ words: wordsOf(db, book.id) });
      },
    );
}

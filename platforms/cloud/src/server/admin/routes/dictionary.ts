import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  addDictionaryWordInput,
  dictionaryWord,
} from "../../../shared/schemas";
import { bookDictionary } from "../../db/schema";
import type { Deps } from "../../deps";
import { visitorAccess } from "../../domain/actors";
import type { AdminEnv } from "../env";
import { requireVisitor } from "../middleware";
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
  // Link visitors use these routes too (see domain/actors.ts).
  return new Hono<AdminEnv>()
    .use(requireVisitor)

    .get("/:id/dictionary", idParam, (c) => {
      const { book } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id, "commenter");
      return c.json({ words: wordsOf(db, book.id) });
    })

    .post(
      "/:id/dictionary",
      idParam,
      validate("json", addDictionaryWordInput),
      (c) => {
        const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id);
        db.insert(bookDictionary)
          .values({
            bookId: book.id,
            word: c.req.valid("json").word,
            addedBy: actor.userId,
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
        const { book } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id);
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

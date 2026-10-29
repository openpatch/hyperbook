import { api, unwrap } from "@/lib/api";

/** The book's spell-check dictionary: the words its teachers accepted. */
export const fetchDictionary = (bookId: string) =>
  unwrap(api.books[":id"].dictionary.$get({ param: { id: bookId } }));

export const addDictionaryWord = (bookId: string, word: string) =>
  unwrap(
    api.books[":id"].dictionary.$post({
      param: { id: bookId },
      json: { word },
    }),
  );

export const removeDictionaryWord = (bookId: string, word: string) =>
  unwrap(
    api.books[":id"].dictionary[":word"].$delete({
      param: { id: bookId, word },
    }),
  );

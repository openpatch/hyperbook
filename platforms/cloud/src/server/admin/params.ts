import { z } from "zod";
import { validate } from "./validate";

export const idParam = validate("param", z.object({ id: z.coerce.number().int().positive() }));

import { HyperbookPage } from "@hyperbook/types";

// Query language types
export type QueryNode =
  | { type: "AND"; left: QueryNode; right: QueryNode }
  | { type: "OR"; left: QueryNode; right: QueryNode }
  | { type: "NOT"; operand: QueryNode }
  | { type: "condition"; field: string; regex: string };

// Tokenizer for query language
export const tokenize = (source: string): string[] => {
  const tokens: string[] = [];
  let i = 0;

  while (i < source.length) {
    // Skip whitespace
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }

    // Parentheses
    if (source[i] === "(" || source[i] === ")") {
      tokens.push(source[i]);
      i++;
      continue;
    }

    // Keywords: AND, OR, NOT
    if (source.slice(i, i + 3).toUpperCase() === "AND" && !/\w/.test(source[i + 3] || "")) {
      tokens.push("AND");
      i += 3;
      continue;
    }
    if (source.slice(i, i + 2).toUpperCase() === "OR" && !/\w/.test(source[i + 2] || "")) {
      tokens.push("OR");
      i += 2;
      continue;
    }
    if (source.slice(i, i + 3).toUpperCase() === "NOT" && !/\w/.test(source[i + 3] || "")) {
      tokens.push("NOT");
      i += 3;
      continue;
    }

    // Condition: field(regex)
    const condMatch = source.slice(i).match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)/);
    if (condMatch) {
      tokens.push(condMatch[0]);
      i += condMatch[0].length;
      continue;
    }

    // Unknown character, skip
    i++;
  }

  return tokens;
};

// Recursive descent parser
export class QueryParser {
  private tokens: string[];
  private pos: number;

  constructor(tokens: string[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(): QueryNode | null {
    if (this.tokens.length === 0) {
      return null;
    }
    return this.parseOr();
  }

  private parseOr(): QueryNode {
    let left = this.parseAnd();

    while (this.peek() === "OR") {
      this.consume("OR");
      const right = this.parseAnd();
      left = { type: "OR", left, right };
    }

    return left;
  }

  private parseAnd(): QueryNode {
    let left = this.parseNot();

    while (this.peek() === "AND") {
      this.consume("AND");
      const right = this.parseNot();
      left = { type: "AND", left, right };
    }

    return left;
  }

  private parseNot(): QueryNode {
    if (this.peek() === "NOT") {
      this.consume("NOT");
      const operand = this.parseNot();
      return { type: "NOT", operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): QueryNode {
    const token = this.peek();

    if (token === "(") {
      this.consume("(");
      const node = this.parseOr();
      this.consume(")");
      return node;
    }

    // Must be a condition
    return this.parseCondition();
  }

  private parseCondition(): QueryNode {
    const token = this.next();
    if (!token) {
      throw new Error("Unexpected end of query");
    }

    const match = token.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)$/);
    if (!match) {
      throw new Error(`Invalid condition: ${token}`);
    }

    return { type: "condition", field: match[1], regex: match[2] };
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private next(): string | undefined {
    return this.tokens[this.pos++];
  }

  private consume(expected: string): void {
    const token = this.next();
    if (token !== expected) {
      throw new Error(`Expected ${expected}, got ${token}`);
    }
  }
}

// Parse a source query string into an AST
export const parseQuery = (source: string): QueryNode | null => {
  const tokens = tokenize(source);
  const parser = new QueryParser(tokens);
  return parser.parse();
};

// Evaluate a query AST against a page
export const evaluateQuery = (query: QueryNode | null, page: HyperbookPage & Record<string, unknown>): boolean => {
  if (query === null) {
    return true;
  }

  switch (query.type) {
    case "AND":
      return evaluateQuery(query.left, page) && evaluateQuery(query.right, page);
    case "OR":
      return evaluateQuery(query.left, page) || evaluateQuery(query.right, page);
    case "NOT":
      return !evaluateQuery(query.operand, page);
    case "condition":
      return evaluateCondition(query.field, query.regex, page);
    default:
      return false;
  }
};

// Evaluate a single condition against a page
export const evaluateCondition = (field: string, regex: string, page: HyperbookPage & Record<string, unknown>): boolean => {
  const re = new RegExp(regex);

  if (field === "href") {
    return page.href ? re.test(page.href) : false;
  } else if (field === "name") {
    return re.test(page.name);
  } else if (field === "keyword") {
    if (!page.keywords || !Array.isArray(page.keywords)) {
      return false;
    }
    // Default to exact match unless regex is explicitly used
    if (/^\^.*\$$/.test(regex)) {
      // Regex: starts with ^ and ends with $
      const re = new RegExp(regex);
      return page.keywords.some((k: string) => re.test(k));
    } else {
      // Exact match
      return page.keywords.includes(regex);
    }
  } else if (field === "description") {
    return page.description ? re.test(page.description) : false;
  } else {
    // Custom frontmatter field
    const value = page[field];
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === "string") {
      return re.test(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      return re.test(String(value));
    } else if (value instanceof Date) {
      return re.test(value.toISOString());
    } else if (Array.isArray(value)) {
      return value.some((v) => {
        if (typeof v === "string") {
          return re.test(v);
        } else if (typeof v === "number" || typeof v === "boolean") {
          return re.test(String(v));
        }
        return false;
      });
    }
    return false;
  }
};

// Compare two values for sorting
export const compareValues = (val1: unknown, val2: unknown): number => {
  // Handle undefined/null values - sort them to the end
  if (val1 === undefined || val1 === null) {
    if (val2 === undefined || val2 === null) {
      return 0;
    } else {
      return 1;
    }
  } else if (val2 === undefined || val2 === null) {
    return -1;
  } else if (typeof val1 === "string" && typeof val2 === "string") {
    return val1.localeCompare(val2);
  } else if (typeof val1 === "number" && typeof val2 === "number") {
    return val1 - val2;
  } else if (typeof val1 === "boolean" && typeof val2 === "boolean") {
    return (val1 ? 1 : 0) - (val2 ? 1 : 0);
  } else if (val1 instanceof Date && val2 instanceof Date) {
    return val1.getTime() - val2.getTime();
  } else if (val1 instanceof Date) {
    return val1.getTime() - new Date(String(val2)).getTime();
  } else if (val2 instanceof Date) {
    return new Date(String(val1)).getTime() - val2.getTime();
  } else {
    // Fallback: convert to string and compare
    return String(val1).localeCompare(String(val2));
  }
};

// Create a sort function for pages based on orderBy string
export const createPageSorter = (orderBy: string): ((a: Record<string, unknown>, b: Record<string, unknown>) => number) => {
  const orderByKey = orderBy?.split(":")[0] || "name";
  const orderByMode = orderBy?.split(":")[1] || "desc";

  return (p1: Record<string, unknown>, p2: Record<string, unknown>): number => {
    const val1 = p1[orderByKey];
    const val2 = p2[orderByKey];
    const result = compareValues(val1, val2);

    if (orderByMode === "desc") {
      return result * -1;
    }

    return result;
  };
};

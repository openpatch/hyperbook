import type { Extension, State, Effects, Code } from "micromark-util-types";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    sub: "sub";
    sup: "sup";
    subMarker: "subMarker";
    subText: "subText";
    supMarker: "supMarker";
    supText: "supText";
  }
}

// Utility to check whitespace
function isWhitespace(code: Code) {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

// --- Subscript tokenizer (_{…}) with escape ---
function subTokenizer(effects: Effects, ok: State, nok: State): State {
  let hasContent = false;

  return start;

  function start(code: Code): State {
    if (code === 92 /* \ */) return afterBackslash; // handle escape
    if (code !== 95 /* _ */) return nok(code) as State;

    effects.enter("sub");
    effects.enter("subMarker");
    effects.consume(code); // _
    effects.exit("subMarker");
    return afterUnderscore;
  }

  function afterBackslash(code: Code): State {
    // If next character is _ or ^, treat as literal
    if (code === 95 || code === 94) {
      effects.consume(code); // consume literal character
      return ok;
    }
    // Otherwise, treat \ as literal
    effects.consume(92);
    return start(code);
  }

  function afterUnderscore(code: Code): State {
    if (code !== 123 /* { */) return nok(code) as State; // {
    effects.enter("subMarker");
    effects.consume(code); // consume {
    effects.exit("subMarker");
    return inside;
  }

  function inside(code: Code): State {
    if (code === 125 /* } */) {
      // }
      if (!hasContent) return nok(code) as State;
      effects.enter("subMarker");
      effects.consume(code);
      effects.exit("subMarker");
      effects.exit("sub");
      return ok;
    }

    if (code === null || code < 0) return nok(code) as State;
    if (!hasContent && isWhitespace(code)) return nok(code) as State;

    effects.enter("subText");
    effects.consume(code);
    effects.exit("subText");
    hasContent = true;
    return inside;
  }
}

// --- Superscript tokenizer (^{…}) with escape ---
function supTokenizer(effects: Effects, ok: State, nok: State): State {
  let hasContent = false;
  return start;

  function start(code: Code): State {
    if (code === 92 /* \ */) return afterBackslash; // handle escape
    if (code !== 94 /* ^ */) return nok(code) as State;

    effects.enter("sup");
    effects.enter("supMarker");
    effects.consume(code); // ^
    effects.exit("supMarker");
    return afterCaret;
  }

  function afterBackslash(code: Code): State {
    if (code === 94 || code === 95) {
      effects.consume(code); // literal
      return ok;
    }
    effects.consume(92); // literal \
    return start(code);
  }

  function afterCaret(code: Code): State {
    if (code !== 123 /* { */) return nok(code) as State; // {
    effects.enter("supMarker");
    effects.consume(code); // consume {
    effects.exit("supMarker");
    return inside;
  }

  function inside(code: Code): State {
    if (code === 125 /* } */) {
      // }
      if (!hasContent) return nok(code) as State;
      effects.enter("supMarker");
      effects.consume(code);
      effects.exit("supMarker");
      effects.exit("sup");
      return ok;
    }

    if (code === null || code < 0) return nok(code) as State;
    if (!hasContent && isWhitespace(code)) return nok(code) as State;

    effects.enter("supText");
    effects.consume(code);
    effects.exit("supText");
    hasContent = true;
    return inside;
  }
}

// --- Micromark extension ---
const micromarkSubSup: Extension = {
  text: {
    95: { tokenize: subTokenizer, partial: true }, // _
    94: { tokenize: supTokenizer, partial: true }, // ^
  },
};

export default micromarkSubSup;

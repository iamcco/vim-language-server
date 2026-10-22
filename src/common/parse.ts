import { INode, StringReader, VimLParser } from "../lib/vimparser";
import { lintCommand } from "./lint";

export interface IParseError {
  message: string;
  // 0-based
  line: number;
  col: number;
}

const NODE_FUNCTION = 4;
const NODE_IF = 13;
const NODE_WHILE = 17;
const NODE_FOR = 19;
const NODE_TRY = 23;
const NODE_IDENTIFIER = 86;
const NODE_LAMBDA = 92;
const NODE_DEF = 101;
const NODE_BLOCK = 111;
const NODE_CLASS = 113;
const NODE_INTERFACE = 115;
const NODE_ENUM = 117;

const errorPattern = /^vimlparser:\s*([\s\S]*?):\s*line\s*([0-9]+)\s*col\s*([0-9]+)$/;

// error for a block that is not closed, reported at the start of the block
const missingEnd: Record<number, string> = {
  [NODE_FUNCTION]: "E126: Missing :endfunction",
  [NODE_DEF]: "E1057: Missing :enddef",
  [NODE_IF]: "E171: Missing :endif",
  [NODE_WHILE]: "E170: Missing :endwhile",
  [NODE_FOR]: "E170: Missing :endfor",
  [NODE_TRY]: "E600: Missing :endtry",
  [NODE_BLOCK]: "E1026: Missing }",
  [NODE_CLASS]: "E1101: Missing :endclass",
  [NODE_INTERFACE]: "E1101: Missing :endinterface",
  [NODE_ENUM]: "E1101: Missing :endenum",
  [NODE_LAMBDA]: "E1171: Missing } after inline function",
};

// a line that starts the block of a Vim9 lambda: "(args) => {"
const lambdaBlockPattern = /=>\s*\{\s*(#.*)?$/;

// commands that start a block, with the node used when the command fails
const blockCommands: Record<string, () => Partial<INode>> = {
  if: () => ({ type: NODE_IF, elseif: [], _else: undefined }),
  while: () => ({ type: NODE_WHILE }),
  for: () => ({ type: NODE_FOR, list: [] }),
  try: () => ({ type: NODE_TRY, catch: [] }),
  function: () => ({ type: NODE_FUNCTION, rlist: [], default_args: [] }),
  def: () => ({ type: NODE_DEF, rlist: [], default_args: [], attr: {} }),
  class: () => ({ type: NODE_CLASS, implements: [] }),
  interface: () => ({ type: NODE_INTERFACE }),
  enum: () => ({ type: NODE_ENUM, enumvalues: [], implements: [] }),
};

function toParseError(error: any): IParseError | undefined {
  const m = typeof error === "string" ? error.match(errorPattern) : null;
  if (!m) {
    return;
  }
  return {
    message: m[1],
    line: Math.max(parseInt(m[2], 10) - 1, 0),
    col: Math.max(parseInt(m[3], 10) - 1, 0),
  };
}

// quote of a string that is not closed before "col" in "line"
function openQuote(line: string, col: number): string {
  let quote = "";
  for (let i = 0; i < Math.min(col, line.length); i++) {
    const c = line[i];
    if (quote === "\"" && c === "\\") {
      i++;
    } else if (quote && c === quote) {
      quote = "";
    } else if (!quote && (c === "'" || c === "\"")) {
      quote = c;
    }
  }
  return quote;
}

/*
 * Messages of the parser like Vim gives them, with the error number:
 * "unexpected token: <EOL>" is "E15: Invalid expression".
 */
export function normalizeMessage(message: string, line: string, col: number): string {
  let m = message.match(/^unexpected (?:token|character): (.*?)(?:, type: \d+)?$/);
  if (m) {
    return m[1] === "<EOL>" || m[1] === "<EOF>"
      ? "E15: Invalid expression: unexpected end of line"
      : `E15: Invalid expression: unexpected "${m[1]}"`;
  }
  if (/^(ExprTokenizer: )?unexpecte?d EOL$/.test(message)) {
    return openQuote(line || "", line ? line.length : col) === "'"
      ? "E115: Missing single quote"
      : "E114: Missing double quote";
  }
  if (message === "Invalid Expression") {
    return "E15: Invalid expression";
  }
  if (message === "Not an function call") {
    return "E107: Missing parentheses";
  }
  if (message === 'Missing "in" after :for') {
    return 'E690: Missing "in" after :for';
  }
  m = message.match(/^(E\d+) (.*)$/);
  if (m) {
    return `${m[1]}: ${m[2]}`;
  }
  return message;
}

// the arguments of the lambda "(args) => {" at the end of "line"
function lambdaArguments(line: string, lnum: number): INode[] {
  const m = line.match(/\(([^()]*)\)(\s*:[^=]*)?\s*=>\s*\{\s*(#.*)?$/);
  if (!m) {
    return [];
  }
  let col = line.lastIndexOf(m[0]) + 1;
  return m[1].split(",").map((arg) => {
    const name = arg.match(/^\s*((?:\.\.\.)?\w+)/);
    const pos = col + (name ? arg.indexOf(name[1]) + 1 : 0);
    col += arg.length + 1;
    return name ? { type: NODE_IDENTIFIER, value: name[1], pos: { lnum, col: pos, offset: 0 } } as INode : undefined;
  }).filter((n) => !!n);
}

// Skip to the start of the line after "lnum" (1-based), at least one line.
function skipLine(reader: StringReader, start: number, lnum: number) {
  const len = reader.buf.length;
  if (reader.i <= start) {
    reader.i = start;
    while (reader.i < len && reader.buf[reader.i] !== "<EOL>") {
      reader.i += 1;
    }
    reader.i += 1;
  }
  while (reader.i < len && reader.pos[reader.i][0] <= lnum) {
    reader.i += 1;
  }
}

/*
 * Parse with error recovery: an error skips the rest of the line and the
 * parser continues with the next one.  A block command that fails, like an
 * :if with an invalid condition, still opens the block, so that the end of
 * the block gives no extra error.
 */
export function parseWithRecovery(lines: string[], isNeovim: boolean): [INode | null, IParseError[]] {
  const errors: IParseError[] = [];
  const reader = new StringReader(lines);
  const parser = new VimLParser(isNeovim);
  const parseOneCmd = parser.parse_one_cmd;

  // lambdas with a block opened for a line that failed
  const openLambdas: INode[] = [];

  parser.parse_one_cmd = function() {
    const start = this.reader.i;
    const depth = this.context.length;
    const lambda = openLambdas.length ? openLambdas[openLambdas.length - 1] : undefined;
    if (lambda && this.context[0] === lambda) {
      // the "}" at the start of a line ends the block, the rest of the line
      // belongs to the expression that failed
      const lnum = this.reader.pos[start] ? this.reader.pos[start][0] : 0;
      if (/^\s*\}/.test(lines[lnum - 1] || "")) {
        this.context.shift();
        openLambdas.pop();
        skipLine(this.reader, start, lnum);
        return;
      }
    }
    try {
      parseOneCmd.call(this);
    } catch (e) {
      const error = toParseError(e);
      if (!error) {
        throw e;
      }
      errors.push(error);
      // the command is checked here, there is no node for it
      lintCommand(this.ea, (this as any).isvim9(), lines).forEach((e) => errors.push(e));
      // drop lambdas that were not closed
      while (this.context.length > depth && this.context[0].type === NODE_LAMBDA) {
        this.context.shift();
      }
      const cmd = this.ea && this.ea.cmd;
      if (this.context.length === depth && cmd && blockCommands[cmd.name]) {
        const node = {
          pos: this.ea.cmdpos,
          ea: this.ea,
          body: [],
          left: { type: NODE_IDENTIFIER, value: "", pos: this.ea.cmdpos },
          ...blockCommands[cmd.name](),
        } as INode;
        this.context[0].body.push(node);
        this.context.unshift(node);
      } else if (this.context.length === depth && lambdaBlockPattern.test(lines[error.line] || "")) {
        // parse the block of the lambda, for its own errors
        const node = {
          type: NODE_LAMBDA,
          pos: { ...this.ea.cmdpos, lnum: error.line + 1, col: 1 },
          body: [],
          rlist: lambdaArguments(lines[error.line], error.line + 1),
          rettype: "",
        } as INode;
        this.context[0].body.push(node);
        this.context.unshift(node);
        openLambdas.push(node);
      }
      skipLine(this.reader, start, error.line + 1);
    }
  };

  const normalize = (list: IParseError[]) => list.map((error) => {
    const message = normalizeMessage(error.message, lines[error.line], error.col);
    let { line, col } = error;
    // an expression that continues at the end of the file: report it at the
    // end of the last line with text, not on the empty line after it
    if (/unexpected end of line$/.test(message)) {
      while (line > 0 && !(lines[line] || "").trim()) {
        line -= 1;
        col = (lines[line] || "").length;
      }
    }
    return { ...error, message, line, col };
  });
  try {
    const node = parser.parse(reader);
    // lambdas that are not closed at the end of the file
    openLambdas.forEach((lambda) => errors.push({
      message: missingEnd[NODE_LAMBDA],
      line: lambda.pos.lnum - 1,
      col: 0,
    }));
    return [node, normalize(errors)];
  } catch (e) {
    const error = toParseError(e);
    if (!error || !parser.context || !parser.context.length) {
      errors.push(error || { message: `${e}`, line: 0, col: 0 });
      return [null, normalize(errors)];
    }
    // unclosed blocks at the end of the file
    const open = parser.context.filter((node) => missingEnd[node.type]);
    if (open.length) {
      open.forEach((node) => {
        errors.push({
          message: missingEnd[node.type],
          line: Math.max(node.pos.lnum - 1, 0),
          col: Math.max(node.pos.col - 1, 0),
        });
      });
    } else {
      errors.push(error);
    }
    return [parser.context[parser.context.length - 1], normalize(errors)];
  }
}

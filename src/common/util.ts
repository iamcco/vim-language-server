import {ErrnoException} from "@nodelib/fs.stat/out/types";
import {spawn, SpawnOptions} from "child_process";
import findup from "findup";
import fs, {Stats} from "fs";
import path from "path";
import {Readable} from "stream";
import {CompletionItem, InsertTextFormat, Position, Range, TextDocument} from "vscode-languageserver";
import {INode, StringReader, VimLParser} from "../lib/vimparser";
import { commentPattern, keywordPattern, kindPattern, wordNextPattern, wordPrePattern } from "./patterns";
import config from '../server/config';

// FIXME vimlparser missing update builtin_commands
if (VimLParser.prototype) {
  (VimLParser.prototype as any).builtin_commands?.push({
    name: 'balt',
    minlen: 4,
    flags: 'NEEDARG|FILE1|EDITCMD|TRLBAR|CMDWIN',
    parser: 'parse_cmd_common'
  })
}

export function isSomeMatchPattern(patterns: kindPattern, line: string): boolean {
  return patterns.some((p) => p.test(line));
}

export function executeFile(
  input: Readable,
  command: string,
  args?: any[],
  option?: SpawnOptions,
): Promise<{
  code: number,
  stdout: string,
  stderr: string,
}> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let error: Error;
    let isPassAsText = false;

    args = (args || []).map((arg) => {
      if (/%text/.test(arg)) {
        isPassAsText = true;
        return arg.replace(/%text/g, input.toString());
      }
      return arg;
    });

    const cp = spawn(command,  args, option);

    cp.stdout.on("data", (data) => {
      stdout += data;
    });

    cp.stderr.on("data", (data) => {
      stderr += data;
    });

    cp.on("error", (err: Error) => {
      error = err;
      reject(error);
    });

    cp.on("close", (code) => {
      if (!error) {
        resolve({ code, stdout, stderr });
      }
    });

    // error will occur when cp get error
    if (!isPassAsText) {
      input.pipe(cp.stdin).on("error", () => { return; });
    }

  });
}

// cover cb type async function to promise
export function pcb(
  cb: (...args: any[]) => void,
): (...args: any[]) => Promise<any> {
  return (...args: any[]): Promise<any> => {
    return new Promise((resolve) => {
      cb(...args, (...params: any[]) => {
        resolve(params);
      });
    });
  };
}

// find work dirname by root patterns
export async function findProjectRoot(
  filePath: string,
  rootPatterns: string | string[],
): Promise<string> {
  const dirname = path.dirname(filePath);
  const patterns = [].concat(rootPatterns);
  let dirCandidate = "";
  for (const pattern of patterns) {
    const [err, dir] =  await pcb(findup)(dirname, pattern);
    if (!err && dir && dir !== "/" && dir.length > dirCandidate.length) {
      dirCandidate = dir;
    }
  }
  if (dirCandidate.length) {
    return dirCandidate;
  }
  return dirname;
}

export function markupSnippets(snippets: string): string {
  return [
    "```vim",
    snippets.replace(/\$\{[0-9]+(:([^}]+))?\}/g, "$2"),
    "```",
  ].join("\n");
}

export function getWordFromPosition(
  doc: TextDocument,
  position: Position,
): {
  word: string
  wordLeft: string
  wordRight: string
  left: string
  right: string,
} | undefined {
  if (!doc) {
    return;
  }

  // invalid character which less than 0
  if (position.character < 0) {
    return
  }

  const character = doc.getText(
    Range.create(
      Position.create(position.line, position.character),
      Position.create(position.line, position.character + 1),
    ),
  );

  // not keyword position
  if (!character || !keywordPattern.test(character)) {
    return;
  }

  const currentLine = doc.getText(
    Range.create(
      Position.create(position.line, 0),
      Position.create(position.line + 1, 0),
    ),
  );

  // comment line
  if (commentPattern.test(currentLine)) {
    return;
  }

  const preSegment = currentLine.slice(0, position.character);
  const nextSegment = currentLine.slice(position.character);
  const wordLeft = preSegment.match(wordPrePattern);
  const wordRight = nextSegment.match(wordNextPattern);
  const word = `${wordLeft && wordLeft[1] || ""}${wordRight && wordRight[1] || ""}`;

  return {
    word,
    left: wordLeft && wordLeft[1] || "",
    right: wordRight && wordRight[1] || "",
    wordLeft: wordLeft && wordLeft[1]
      ? preSegment.replace(new RegExp(`${wordLeft[1]}$`), word)
      : `${preSegment}${word}`,
    wordRight: wordRight && wordRight[1]
      ? nextSegment.replace(new RegExp(`^${wordRight[1]}`), word)
      : `${word}${nextSegment}`,
  };
}

// parse vim buffer
export async function handleParse(textDoc: TextDocument | string): Promise<[INode | null, string]> {
  const text = textDoc instanceof Object ? textDoc.getText() : textDoc;
  const tokens = new StringReader(text.split(/\r\n|\r|\n/));
  try {
    const node: INode = new VimLParser(config.isNeovim).parse(tokens);
    return [node, ""];
  } catch (error) {
    return [null, error];
  }
}

// remove snippets of completionItem
export function removeSnippets(completionItems: CompletionItem[] = []): CompletionItem[] {
  return completionItems.map((item) => {
    if (item.insertTextFormat === InsertTextFormat.Snippet) {
      return {
        ...item,
        insertText: item.label,
        insertTextFormat: InsertTextFormat.PlainText,
      };
    }
    return item;
  });
}

export const isSymbolLink = async (filePath: string): Promise<{ err: ErrnoException | null; stats: boolean }> => {
  return new Promise((resolve) => {
    fs.lstat(filePath, (err: ErrnoException | null, stats: Stats) => {
      resolve({
        err,
        stats: stats && stats.isSymbolicLink(),
      });
    });
  });
};

export const getRealPath = async (filePath: string): Promise<string> => {
  const { err, stats } = await isSymbolLink(filePath);
  if (!err && stats) {
    return new Promise((resolve) => {
      fs.realpath(filePath, (error: ErrnoException | null, realPath: string) => {
        if (error) {
          return resolve(filePath);
        }
        resolve(realPath);
      });
    });
  }
  return filePath;
};

export const delay = async (ms: number) => {
  await new Promise<void>((res) => {
    setTimeout(() => {
      res()
    }, ms);
  })
}

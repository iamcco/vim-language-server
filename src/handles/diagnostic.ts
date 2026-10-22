import {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
  TextDocument,
} from "vscode-languageserver";
import { IParseError } from "../common/parse";
import { connection } from "../server/connection";

const codePattern = /^(E\d+):/;

// range of the word at the error, or of a single character
function getRange(textDoc: TextDocument, error: IParseError): Range {
  const line = Math.min(error.line, Math.max(textDoc.lineCount - 1, 0));
  const text = textDoc.getText(Range.create(
    Position.create(line, 0),
    Position.create(line + 1, 0),
  )).replace(/\r?\n$/, "");
  const col = Math.min(error.col, text.length);
  const m = text.slice(col).match(/^[\w#:]+/);
  const end = m ? col + m[0].length : Math.min(col + 1, Math.max(text.length, col + 1));
  return Range.create(Position.create(line, col), Position.create(line, end));
}

export function getDiagnostics(textDoc: TextDocument, errors: IParseError[]): Diagnostic[] {
  const sorted = (errors || []).slice().sort((a, b) => a.line - b.line || a.col - b.col);
  return sorted.map((error) => {
    const m = error.message.match(codePattern);
    const diagnostic: Diagnostic = {
      source: "vimlsp",
      message: error.message,
      range: getRange(textDoc, error),
      severity: DiagnosticSeverity.Error,
    };
    if (m) {
      diagnostic.code = m[1];
    }
    return diagnostic;
  });
}

export async function handleDiagnostic(
  textDoc: TextDocument,
  errors: IParseError[],
) {
  return connection.sendDiagnostics({
    uri: textDoc.uri,
    diagnostics: getDiagnostics(textDoc, errors),
  });
}

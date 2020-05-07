import {
  DiagnosticSeverity,
  Position,
  Range,
  TextDocument,
} from "vscode-languageserver";
import { errorLinePattern } from "../common/patterns";
import { connection } from "../server/connection";

const fixNegativeNum = (num: number): number => {
  if (num < 0) {
    return 0;
  }
  return num;
};

export async function handleDiagnostic(
  textDoc: TextDocument,
  error: string,
) {
  const m = (error || "").match(errorLinePattern);
  if (m) {
    const lines = textDoc.lineCount;
    const line = fixNegativeNum(parseFloat(m[2]) - 1);
    const col = fixNegativeNum(parseFloat(m[3]) - 1);
    return connection.sendDiagnostics({
      uri: textDoc.uri,
      diagnostics: [{
        source: "vimlsp",
        message: m[1],
        range: Range.create(
          Position.create(line > lines ? lines : line, col),
          Position.create(line > lines ? lines : line, col + 1),
        ),
        severity: DiagnosticSeverity.Error,
      }],
    });
  }

  // clear diagnostics
  connection.sendDiagnostics({
    uri: textDoc.uri,
    diagnostics: [],
  });
}

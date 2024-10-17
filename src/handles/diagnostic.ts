import { spawnSync } from "child_process";
import {
  DiagnosticSeverity,
  Position,
  Range,
  TextDocument,
} from "vscode-languageserver";
import { URI } from 'vscode-uri'
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
  save: boolean,
) {
  let diagnostics = []
  if (save) {
    let cp = spawnSync("vint", [URI.parse(textDoc.uri).fsPath], { encoding: "utf8" });
    if (cp.stdout) {
      // example output:
      //   "/home/wzy/.config/nvim/init.vim:21:3: warning! " "Do not use nocompatible which has unexpected effects(:help nocompatible)"
      for (let line of cp.stdout.trim().split("\n")) {
        let [_1, info, _2, message, _3] = line.split('"');
        let [_path, _row, _col, _severity] = info.split(":");
        let row = Number(_row);
        let col = Number(_col);
        _severity = _severity.trim().replace("!", "");
        let severity: DiagnosticSeverity = DiagnosticSeverity.Error;
        if (_severity === "warning") {
          severity = DiagnosticSeverity.Warning;
        }
        diagnostics = [...diagnostics, {
          source: "vint",
          message: message,
          range: Range.create(
            Position.create(row - 1, col - 1),
            Position.create(row, 0),
          ),
          severity: severity,
        }];
      }
    }
  }

  const m = (error || "").match(errorLinePattern);
  if (m) {
    const lines = textDoc.lineCount;
    const line = fixNegativeNum(parseFloat(m[2]) - 1);
    const col = fixNegativeNum(parseFloat(m[3]) - 1);
    diagnostics = [...diagnostics, {
      source: "vimlsp",
      message: m[1],
      range: Range.create(
        Position.create(line > lines ? lines : line, col),
        Position.create(line > lines ? lines : line, col + 1),
      ),
      severity: DiagnosticSeverity.Error,
    }];
  }

  return connection.sendDiagnostics({
    uri: textDoc.uri,
    diagnostics: diagnostics,
  });
}

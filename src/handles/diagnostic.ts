import {
  TextDocument,
  Range,
  Position,
  DiagnosticSeverity
} from 'vscode-languageserver';
import { errorLinePattern } from '../common/patterns';
import { connection } from '../server/connection';

export async function handleDiagnostic(
  textDoc: TextDocument,
  error: string
) {
  const m = (error || '').match(errorLinePattern)
  if (m) {
   return connection.sendDiagnostics({
      uri: textDoc.uri,
      diagnostics: [{
        message: m[1],
        range: Range.create(
          Position.create(parseFloat(m[2]) - 1, parseFloat(m[3]) - 1),
          Position.create(parseFloat(m[2]) - 1, parseFloat(m[3]))
        ),
        severity: DiagnosticSeverity.Error
      }]
    })
  }

  // clear diagnostics
  connection.sendDiagnostics({
    uri: textDoc.uri,
    diagnostics: []
  })
}

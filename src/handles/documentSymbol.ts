import {DocumentSymbolParams, DocumentSymbol, SymbolKind, Range, Position, SymbolInformation} from "vscode-languageserver";
import * as shvl from "shvl";

import {workspace} from "../server/workspaces";
import {IFunction, IIdentifier} from "../server/buffer";
import {documents} from "../server/documents";
import config from "../server/config";

export const documentSymbolProvider = async (params: DocumentSymbolParams): Promise<DocumentSymbol[] | SymbolInformation[]> => {
  const documentSymbols: DocumentSymbol[] = []
  const { textDocument } = params
  const buffer = await workspace.getBufferByUri(textDocument.uri)
  const document = documents.get(textDocument.uri)
  if (!buffer || !document) {
    return documentSymbols
  }
  const globalFunctions = buffer.getGlobalFunctions()
  const scriptFunctions = buffer.getScriptFunctions()
  const globalVariables = buffer.getGlobalIdentifiers()
  const localVariables = buffer.getLocalIdentifiers()
  const functions = Object.values(globalFunctions).concat(Object.values(scriptFunctions)).reduce((pre, cur) => {
    return pre.concat(cur)
  }, [])
  let variables = Object.values(globalVariables).concat(Object.values(localVariables)).reduce((pre, cur) => {
    return pre.concat(cur)
  }, [])

  // hierarchicalDocumentSymbolSupport: false
  if (!config.capabilities || !shvl.get(config.capabilities, 'textDocument.documentSymbol.hierarchicalDocumentSymbolSupport')) {
    return ([] as (IFunction | IIdentifier)[]).concat(functions,variables).sort((a, b) => {
      if (a.startLine === b.startLine) {
        return a.startCol - b.startCol
      }
      return a.startLine - b.startLine
    }).map<SymbolInformation>(item => {
      const vimRange = (item as IFunction).range
      const line = vimRange
        ? document.getText(Range.create( Position.create(vimRange.endLine - 1, 0), Position.create(vimRange.endLine, 0)))
        : ''
      const range = vimRange
        ? Range.create(
          Position.create(vimRange.startLine - 1, vimRange.startCol - 1),
          Position.create(vimRange.endLine - 1, vimRange.endCol - 1 + line.slice(vimRange.endCol - 1).split(' ')[0].length)
        )
        :
        Range.create(
          Position.create(item.startLine - 1, item.startCol - 1),
          Position.create(item.startLine, item.startCol - 1 + item.name.length)
        )
      return {
        name: item.name,
        kind: vimRange ? SymbolKind.Function : SymbolKind.Variable,
        location: {
          uri: textDocument.uri,
          range,
        }
      }
    })
  }

  const sortFunctions: IFunction[] = []
  functions.forEach(func => {
    if (sortFunctions.length === 0) {
      return sortFunctions.push(func)
    }
    let i = 0;
    for (const len = sortFunctions.length; i < len; i += 1) {
      const sf = sortFunctions[i]
      if (func.range.endLine < sf.range.endLine) {
        sortFunctions.splice(i, 0, func)
        break
      }
    }
    if (i === sortFunctions.length) {
      sortFunctions.push(func)
    }
  })
  return sortFunctions
    .map(func => {
      const vimRange = func.range
      const line = document.getText(Range.create(
        Position.create(vimRange.endLine - 1, 0),
        Position.create(vimRange.endLine, 0)
      ))
      const range = Range.create(
        Position.create(vimRange.startLine - 1, vimRange.startCol - 1),
        Position.create(vimRange.endLine - 1, vimRange.endCol - 1 + line.slice(vimRange.endCol - 1).split(' ')[0].length)
      )
      const ds: DocumentSymbol = {
        name: func.name,
        kind: SymbolKind.Function,
        range,
        selectionRange: range,
        children: []
      }
      variables = variables.filter(v => {
        if (v.startLine >= vimRange.startLine && v.startLine <= vimRange.endLine) {
          const vRange = Range.create(
            Position.create(v.startLine - 1, v.startCol - 1),
            Position.create(v.startLine, v.startCol - 1 + v.name.length)
          )
          ds.children.push({
            name: v.name,
            kind: SymbolKind.Variable,
            range: vRange,
            selectionRange: vRange
          })
          return false
        }
        return true
      })
      return ds
    })
    .reduce((res, cur) => {
      if (res.length === 0) {
        res.push(cur)
      } else {
        res = res.filter(item => {
          if (item.range.start.line >= cur.range.start.line && item.range.end.line <= cur.range.end.line) {
            cur.children.push(item)
            return false
          }
          return true
        })
        res.push(cur)
      }
      return res
    }, [] as DocumentSymbol[])
    .concat(
      variables.map(v => {
        const vRange = Range.create(
          Position.create(v.startLine - 1, v.startCol - 1),
          Position.create(v.startLine, v.startCol - 1 + v.name.length)
        )
        return {
          name: v.name,
          kind: SymbolKind.Variable,
          range: vRange,
          selectionRange: vRange
        }
      })
    )
}

import {SelectionRangeParams, SelectionRange, Range, Position} from "vscode-languageserver";

import {workspace} from "../server/workspaces";
import {documents} from "../server/documents";

export const selectionRangeProvider = (params: SelectionRangeParams): SelectionRange[] => {
  const selectRanges: SelectionRange[] = [];
  const { textDocument, positions } = params;
  if (!positions || positions.length === 0) {
    return selectRanges
  }
  const buffer = workspace.getBufferByUri(textDocument.uri);
  const document = documents.get(textDocument.uri)
  if (!buffer || !document) {
    return selectRanges;
  }
  const globalFunctions = buffer.getGlobalFunctions();
  const scriptFunctions = buffer.getScriptFunctions();

  const funcs = Object.values(globalFunctions).concat(Object.values(scriptFunctions))
    .reduce((pre, cur) => {
      return pre.concat(cur);
    }, [])
  let range = Range.create(positions[0], positions[0])
  if (positions.length > 1) {
    range = Range.create(positions[0], positions[positions.length - 1])
  }
  const ranges: Range[] = []
  funcs.forEach(item => {
    const p = item.range
    const line = document.getText(Range.create(
      Position.create(p.endLine - 1, 0),
      Position.create(p.endLine, 0)
    ))
    const newRange = Range.create(
      Position.create(p.startLine - 1, p.startCol - 1),
      Position.create(p.endLine - 1, p.endCol - 1 + line.slice(p.endCol - 1).split(' ')[0].length)
    )
    if (range.start.line >= newRange.start.line
      && range.end.line <= newRange.end.line
      && !(range.start.line === newRange.start.line && range.end.line === newRange.end.line)) {
      if (ranges.length === 0) {
        ranges.push(newRange)
      } else {
        let i = 0;
        for(const len = ranges.length; i < len; i++) {
          if (ranges[i].start.line <= newRange.start.line && ranges[i].end.line >= newRange.end.line) {
            ranges.splice(i, 0, newRange)
            break
          }
        }
        if (i === ranges.length) {
          ranges.push(newRange)
        }
      }
    }
  })
  if (ranges.length) {
    selectRanges.push(
      ranges.reverse().reduce((pre, cur, idx) => {
        if (idx === 0) {
          return pre
        }
        return {
          range: cur,
          parent: pre
        }
      }, {range: ranges[0]} as SelectionRange)
    )
  }
  return selectRanges
};

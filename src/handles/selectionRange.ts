import {SelectionRangeParams, SelectionRange, Range, Position} from "vscode-languageserver";

import {workspace} from "../server/workspaces";
import {documents} from "../server/documents";

export const selectionRangeProvider = async (params: SelectionRangeParams): Promise<SelectionRange[]> => {
  const selectRanges: SelectionRange[] = [];
  const { textDocument, positions } = params;
  if (!positions || positions.length === 0) {
    return selectRanges
  }
  const buffer = await workspace.getBufferByUri(textDocument.uri);
  const document = documents.get(textDocument.uri)
  if (!buffer || !document) {
    return selectRanges;
  }
  const vimRanges = buffer.getRanges()
  if (vimRanges.length === 0) {
    return selectRanges
  }

  let range = Range.create(positions[0], positions[0])
  if (positions.length > 1) {
    range = Range.create(positions[0], positions[positions.length - 1])
  }
  let ranges: Range[] = []
  vimRanges.forEach(vimRange => {
    const line = document.getText(Range.create(
      Position.create(vimRange.endLine - 1, 0),
      Position.create(vimRange.endLine, 0)
    ))
    const newRange = Range.create(
      Position.create(vimRange.startLine - 1, vimRange.startCol - 1),
      Position.create(vimRange.endLine - 1, vimRange.endCol - 1 + line.slice(vimRange.endCol - 1).split(' ')[0].length)
    )
    if (range.start.line >= newRange.start.line && range.end.line <= newRange.end.line) {
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
    if (ranges.length > 1) {
      ranges = ranges.filter(newRange => {
        return range.start.line !== newRange.start.line || range.end.line !== newRange.end.line
      })
    }
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

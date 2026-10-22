import {FoldingRange, FoldingRangeParams} from "vscode-languageserver";

import {IRange} from "../server/buffer";
import {workspace} from "../server/workspaces";

export const foldingRangeProvider = async (params: FoldingRangeParams) => {
  const res: FoldingRange[] = [];
  const { textDocument } = params;
  const buffer = await workspace.getBufferByUri(textDocument.uri);
  if (!buffer) {
    return res;
  }
  const globalFunctions = buffer.getGlobalFunctions();
  const scriptFunctions = buffer.getScriptFunctions();
  const ranges: IRange[][] = [
    ...Object.values(globalFunctions),
    ...Object.values(scriptFunctions),
    ...Object.values(buffer.getMethods()),
    // Vim9 classes, interfaces and enums
    ...Object.values(buffer.getClasses()).map((list) => list.filter((item) => item.endLine > item.startLine)),
  ];
  return ranges
    .reduce((pre, cur) => {
      return pre.concat(cur);
    }, [])
    .map<FoldingRange>((func) => {
      return {
        startLine: func.startLine - 1,
        startCharacter: func.startCol - 1,
        endLine: func.endLine - 1,
        endCharacter: func.endCol - 1,
        kind: "region",
      };
    });
};

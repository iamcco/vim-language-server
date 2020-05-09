import {FoldingRange, FoldingRangeParams} from "vscode-languageserver";

import {workspace} from "../server/workspaces";

export const foldingRangeProvider = (params: FoldingRangeParams) => {
  const res: FoldingRange[] = [];
  const { textDocument } = params;
  const buffer = workspace.getBufferByUri(textDocument.uri);
  if (!buffer) {
    return res;
  }
  const globalFunctions = buffer.getGlobalFunctions();
  const scriptFunctions = buffer.getScriptFunctions();
  return Object.values(globalFunctions).concat(Object.values(scriptFunctions))
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

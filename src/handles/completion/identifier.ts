/*
 * vim identifier
 *
 * - xxx
 * - g:xxx
 * - b:xxx
 * - s:xxx
 * - l:xxx
 * - a:xxx
 */
import { CompletionItem, Position } from "vscode-languageserver";

import { notIdentifierPattern } from "../../common/patterns";
import { isSomeMatchPattern } from "../../common/util";
import config from "../../server/config";
import { workspace } from "../../server/workspaces";
import { useProvider } from "./provider";

function provider(line: string, uri: string, position: Position): CompletionItem[] {
  if (isSomeMatchPattern(notIdentifierPattern, line)) {
    return [];
  } else if (/\b[gbsla]:\w*$/.test(line)) {
    let list = [];
    if (/\bg:\w*$/.test(line)) {
      list = workspace.getIdentifierItems(uri, position.line)
        .filter((item) => /^g:/.test(item.label));
    } else if (/\bb:\w*$/.test(line)) {
      list = workspace.getIdentifierItems(uri, position.line)
        .filter((item) => /^b:/.test(item.label));
    } else if (/\bs:\w*$/.test(line)) {
      list = workspace.getIdentifierItems(uri, position.line)
        .filter((item) => /^s:/.test(item.label));
    } else if (/\bl:\w*$/.test(line)) {
      list = workspace.getIdentifierItems(uri, position.line)
        .filter((item) => /^l:/.test(item.label));
    } else if (/\ba:\w*$/.test(line)) {
      list = workspace.getIdentifierItems(uri, position.line)
        .filter((item) => /^a:/.test(item.label));
    }
    return list.map((item) => ({
      ...item,
      insertText: !/:/.test(config.iskeyword) ? item.insertText.slice(2) : item.insertText,
    }));
  } else if (/\B:\w*$/.test(line)) {
    return workspace.getIdentifierItems(uri, position.line)
      .filter((item) => /:/.test(item.label))
      .map((item) => {
        const m = line.match(/:[^:]*$/);
        return {
          ...item,
          // delete the `:` symbol
          textEdit: {
            range: {
              start: {
                line: position.line,
                character: line.length - m[0].length,
              },
              end: {
                line: position.line,
                character: line.length - m[0].length + 1,
              },
            },
            newText: item.insertText,
          },
        };
      });
  }
  return workspace.getIdentifierItems(uri, position.line);
}

useProvider(provider);

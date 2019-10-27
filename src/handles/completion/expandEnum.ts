/*
 * expand args enum
 *
 * - <cfile>
 * - <afile>
 * - <abuf>
 * - <amatch>
 * - <sfile>
 * - <cword>
 * - <cWORD>
 * - <client>
 */
import { CompletionItem } from "vscode-languageserver";
import { expandPattern } from "../../common/patterns";
import { builtinDocs } from "../../server/builtin";
import { useProvider } from "./provider";

function provider(line: string): CompletionItem[] {
  if (expandPattern[0].test(line)) {
    return builtinDocs.getExpandKeywords().map((item) => {
      return {
        ...item,
        insertText: item.insertText.slice(1),
      };
    });
  } else if (expandPattern[1].test(line)) {
    return builtinDocs.getExpandKeywords();
  }
  return [];
}

useProvider(provider);

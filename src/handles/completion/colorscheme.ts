/*
 * vim color scheme
 */
import { CompletionItem } from "vscode-languageserver";
import { colorschemePattern } from "../../common/patterns";
import { builtinDocs } from "../../server/builtin";
import { useProvider } from "./provider";

function provider(line: string): CompletionItem[] {
  if (colorschemePattern.test(line)) {
    return builtinDocs.getColorschemes();
  }
  return [];
}

useProvider(provider);

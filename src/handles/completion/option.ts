/*
 * vim options
 *
 * - &xxxx
 */
import { CompletionItem } from "vscode-languageserver";
import { optionPattern } from "../../common/patterns";
import { isSomeMatchPattern } from "../../common/util";
import { builtinDocs } from "../../server/builtin";
import { useProvider } from "./provider";

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(optionPattern, line)) {
    return builtinDocs.getVimOptions();
  }
  return [];
}

useProvider(provider);

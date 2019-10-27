/*
 * vim builtin command
 *
 * - xxx
 */
import { CompletionItem } from "vscode-languageserver";
import { commandPattern } from "../../common/patterns";
import { isSomeMatchPattern } from "../../common/util";
import { builtinDocs } from "../../server/builtin";
import config from "../../server/config";
import { commandSnippets } from "../../server/snippets";
import { useProvider } from "./provider";

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(commandPattern, line)) {
    // only return snippets when snippetSupport is true
    if (config.snippetSupport) {
      return builtinDocs.getVimCommands().concat(commandSnippets);
    }
    return builtinDocs.getVimCommands();
  }
  return [];
}

useProvider(provider);

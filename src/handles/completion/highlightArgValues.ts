/*
 * highlight arg values
 *
 */
import { CompletionItem } from "vscode-languageserver";
import { highlightLinkPattern, highlightValuePattern } from "../../common/patterns";
import { builtinDocs } from "../../server/builtin";
import { useProvider } from "./provider";

function provider(line: string): CompletionItem[] {
  const m = line.match(highlightValuePattern);
  if (!highlightLinkPattern.test(line) && m) {
    const values = builtinDocs.getHighlightArgValues();
    const keyName = m[3];
    if (values[keyName]) {
      return values[keyName];
    }
  }
  return [];
}

useProvider(provider);

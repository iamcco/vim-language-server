/*
 * has features enum
 *
 * - mac
 * - win32
 * - win64
 * ...
 */
import { CompletionItem } from "vscode-languageserver";
import { featurePattern } from "../../common/patterns";
import { isSomeMatchPattern } from "../../common/util";
import { builtinDocs } from "../../server/builtin";
import { useProvider } from "./provider";

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(featurePattern, line)) {
    return builtinDocs.getVimFeatures();
  }
  return [];
}

useProvider(provider);

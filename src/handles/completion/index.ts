import {
  CompletionItem,
  CompletionParams,
  Position,
  Range,
} from "vscode-languageserver";

import fuzzy from "../../common/fuzzy";
import { getWordFromPosition, removeSnippets } from "../../common/util";
import config from "../../server/config";
import { documents } from "../../server/documents";
import "./autocmds";
import "./builtinVariable";
import "./colorscheme";
import "./command";
import "./expandEnum";
import "./function";
import "./hasEnum";
import "./highlightArgKeys";
import "./highlightArgValues";
import "./identifier";
import "./mapEnum";
import "./option";
import { getProvider } from "./provider";

const provider = getProvider();

export const completionProvider = (params: CompletionParams): CompletionItem[] => {

  const { textDocument, position } = params;
  const textDoc = documents.get(textDocument.uri);
  if (textDoc) {
    const line = textDoc.getText(Range.create(
      Position.create(position.line, 0),
      position,
    ));
    const completionItems = provider(line, textDoc.uri, position, []);
    if (!config.snippetSupport) {
      return removeSnippets(completionItems);
    }
    const words = getWordFromPosition(textDoc, { line: position.line, character: position.character - 1 });
    let word = words && words.word || "";
    if (word === "" && words && words.wordRight.trim() === ":") {
      word = ":";
    }
    // options items start with &
    const invalidLength = word.replace(/^&/, "").length;
    return completionItems.filter((item) => fuzzy(item.label, word) >= invalidLength);
  }
  return [];
};

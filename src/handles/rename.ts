import { Position, Range, RenameParams, TextDocumentPositionParams, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { getWordFromPosition } from "../common/util";
import { documents } from "../server/documents";
import { workspace } from "../server/workspaces";

export const prepareProvider = (params: TextDocumentPositionParams): {
  range: Range
  placeholder: string,
} | null => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) {
    return null;
  }
  const words = getWordFromPosition(doc, position);
  if (!words) {
    return null;
  }

  let currentName = words.word;
  if (/\./.test(words.right)) {
    const tail = words.right.replace(/^[^.]*(\.)/, "$1");
    currentName = words.word.replace(tail, "");
  }

  return {
    placeholder: currentName,
    range: Range.create(
      Position.create(position.line, position.character - words.left.length),
      Position.create(position.line, position.character + words.right.length - 1),
    ),
  };
};

export const renameProvider = (params: RenameParams): WorkspaceEdit | null => {
  const { textDocument, position, newName } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) {
    return null;
  }
  const words = getWordFromPosition(doc, position);
  if (!words) {
    return null;
  }

  let currentName = words.word;
  if (/\./.test(words.right)) {
    const tail = words.right.replace(/^[^.]*(\.)/, "$1");
    currentName = words.word.replace(tail, "");
  }

  const changes: Record<string, TextEdit[]> = {};
  let isChange = false;

  workspace.getLocations(currentName, doc.uri, position, "definition").locations
    .forEach((l) => {
      isChange = true;
      if (!changes[l.uri] || !Array.isArray(changes[l.uri])) {
        changes[l.uri] = [];
      }
      changes[l.uri].push({
        newText: /^a:/.test(newName) ? newName.slice(2) : newName,
        range: l.range,
      });
    });

  const refs = workspace.getLocations(currentName, doc.uri, position, "references");

  refs.locations.forEach((l) => {
    isChange = true;
    if (!changes[l.uri] || !Array.isArray(changes[l.uri])) {
      changes[l.uri] = [];
    }
    changes[l.uri].push({
      newText: refs.isFunArg ? `a:${newName}` : newName,
      range: l.range,
    });
  });

  if (isChange) {
    return {
      changes,
    };
  }
  return null;
};

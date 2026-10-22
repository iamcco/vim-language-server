import fs from "fs";
import { Location, Position, Range, TextDocumentPositionParams } from "vscode-languageserver";
import { URI } from "vscode-uri";

import logger from "../common/logger";
import { getWordFromPosition, handleParse } from "../common/util";
import { INode } from "../lib/vimparser";
import config from "../server/config";
import { documents } from "../server/documents";
import { buildScopeIndex, declLocation, findExport, resolve, resolveImportPath } from "../server/scope";
import { workspace } from "../server/workspaces";

const log = logger("definition");

async function getNode(uri: string, fsPath?: string): Promise<INode | undefined> {
  const buffer = await workspace.getBufferByUri(uri);
  if (buffer) {
    return buffer.getNode();
  }
  if (!fsPath) {
    return;
  }
  // a script that was not indexed yet, e.g. imported from 'runtimepath'
  const [node] = await handleParse(fs.readFileSync(fsPath).toString());
  if (node) {
    workspace.updateBuffer(uri, node);
  }
  return node || undefined;
}

/*
 * Definition by the scopes of Vim9 script: local variables, arguments,
 * class members with "this." and "super.", and names of imported scripts.
 */
async function getScopeDefinition(uri: string, position: Position): Promise<Location[]> {
  const node = await getNode(uri);
  if (!node) {
    return [];
  }
  const res = resolve(buildScopeIndex(node), position);
  if (!res.imported) {
    return res.decls.map((d) => declLocation(uri, d));
  }
  const { decl, name } = res.imported;
  const file = resolveImportPath(decl.node, uri, [config.vimruntime].concat(config.runtimepath).filter((p) => !!p));
  if (!file) {
    return [declLocation(uri, decl)];
  }
  const target = URI.file(file).toString();
  const targetNode = await getNode(target, file);
  const found = targetNode ? findExport(buildScopeIndex(targetNode), name) : [];
  if (!found.length) {
    return [{ uri: target, range: Range.create(0, 0, 0, 0) }];
  }
  return found.map((d) => declLocation(target, d));
}

export const definitionProvider = async (params: TextDocumentPositionParams): Promise<Location[] | null> => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) {
    return null;
  }
  try {
    const locations = await getScopeDefinition(doc.uri, position);
    if (locations.length) {
      return locations;
    }
  } catch (error) {
    log.warn(`definition: ${error.stack || error}`);
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
  return workspace.getLocations(currentName, doc.uri, position, "definition").locations;
};

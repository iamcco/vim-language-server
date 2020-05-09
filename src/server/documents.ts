import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from 'vscode-languageserver-textdocument';

// text document manager
export const documents = new TextDocuments(TextDocument);

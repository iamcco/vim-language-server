import { expect } from "chai";
import { SymbolKind } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { handleParse } from "../../../src/common/util";
import { documentSymbolProvider } from "../../../src/handles/documentSymbol";
import { foldingRangeProvider } from "../../../src/handles/foldingRange";
import config from "../../../src/server/config";
import { documents } from "../../../src/server/documents";
import { workspace } from "../../../src/server/workspaces";

const uri = "file:///symbols.vim";
const text = [
  "vim9script",
  "class Shape",
  "  var size: number",
  "  def Area(): number",
  "    return this.size",
  "  enddef",
  "endclass",
  "enum Color",
  "  Red",
  "endenum",
  "def Main()",
  "enddef",
].join("\n");

describe("Vim9 symbols", () => {
  before(async () => {
    const doc = TextDocument.create(uri, "vim", 1, text);
    (documents as any)._documents[uri] = doc;
    const [node] = await handleParse(doc as any);
    await workspace.updateBuffer(uri, node!);
  });

  it("nests methods in their class in the outline", async () => {
    config.init({
      capabilities: { textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } } },
    } as any);
    const symbols: any[] = await documentSymbolProvider({ textDocument: { uri } });
    const outline = symbols.map((s) => [s.name, s.kind, (s.children || []).map((c: any) => [c.name, c.kind])]);
    expect(outline).to.deep.equal([
      ["Shape", SymbolKind.Class, [["Area", SymbolKind.Method]]],
      ["Color", SymbolKind.Enum, []],
      ["Main", SymbolKind.Function, []],
    ]);
  });

  it("folds classes, enums, methods and functions", async () => {
    const ranges = await foldingRangeProvider({ textDocument: { uri } });
    expect(ranges.map((r) => [r.startLine, r.endLine]).sort((a, b) => a[0] - b[0])).to.deep.equal([
      [1, 6], [3, 5], [7, 9], [10, 11],
    ]);
  });
});

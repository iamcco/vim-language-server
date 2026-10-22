import { expect } from "chai";
import fs from "fs";
import path from "path";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { handleParse } from "../../../src/common/util";
import { definitionProvider } from "../../../src/handles/definition";
import { documents } from "../../../src/server/documents";
import { workspace } from "../../../src/server/workspaces";

const fixtures = path.join(__dirname, "../../fixtures/vim9");
const uriOf = (file: string) => URI.file(path.join(fixtures, file)).toString();

async function open(uri: string, text: string) {
  const doc = TextDocument.create(uri, "vim", 1, text);
  (documents as any)._documents[uri] = doc;
  const [node] = await handleParse(doc as any);
  await workspace.updateBuffer(uri, node!);
}

async function definition(uri: string, line: number, character: number) {
  const res = await definitionProvider({ textDocument: { uri }, position: { line, character } });
  return (res || []).map((l) => [
    path.relative(fixtures, URI.parse(l.uri).fsPath) || l.uri,
    l.range.start.line,
    l.range.start.character,
  ]);
}

describe("definition", () => {
  const main = uriOf("main.vim");

  before(async () => {
    await open(main, fs.readFileSync(path.join(fixtures, "main.vim")).toString());
  });

  it("finds script and block variables", async () => {
    expect(await definition(main, 25, 4)).to.deep.equal([["main.vim", 5, 4]]);
    expect(await definition(main, 25, 13)).to.deep.equal([["main.vim", 24, 8]]);
  });

  it("finds lambda arguments and closure variables", async () => {
    expect(await definition(main, 29, 17)).to.deep.equal([["main.vim", 29, 11]]);
    expect(await definition(main, 29, 21)).to.deep.equal([["main.vim", 5, 4]]);
  });

  it("finds classes and members with this. and super.", async () => {
    expect(await definition(main, 21, 19)).to.deep.equal([["main.vim", 14, 6]]);
    expect(await definition(main, 10, 16)).to.deep.equal([["main.vim", 8, 6]]);
    expect(await definition(main, 16, 20)).to.deep.equal([["main.vim", 9, 6]]);
  });

  it("finds members of typed variables and Class.new()", async () => {
    expect(await definition(main, 27, 10)).to.deep.equal([["main.vim", 9, 6]]);
    expect(await definition(main, 27, 23)).to.deep.equal([["main.vim", 8, 6]]);
  });

  it("finds names exported by imported scripts", async () => {
    expect(await definition(main, 27, 32)).to.deep.equal([["lib.vim", 4, 11]]);
    expect(await definition(main, 16, 33)).to.deep.equal([["lib.vim", 2, 13]]);
    expect(await definition(main, 28, 5)).to.deep.equal([[path.join("autoload", "auto.vim"), 2, 11]]);
  });

  it("finds the import of an imported script name", async () => {
    expect(await definition(main, 28, 2)).to.deep.equal([["main.vim", 3, 30]]);
  });

  it("keeps the name based lookup for legacy script", async () => {
    const uri = uriOf("legacy.vim");
    await open(uri, "function! Foo()\nendfunction\ncall Foo()\n");
    expect(await definition(uri, 2, 6)).to.deep.equal([["legacy.vim", 0, 10]]);
  });
});

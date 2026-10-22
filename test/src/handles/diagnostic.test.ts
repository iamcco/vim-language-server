import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { handleParse } from "../../../src/common/util";
import { getDiagnostics } from "../../../src/handles/diagnostic";

const diagnose = async (text: string) => {
  const doc = TextDocument.create("file:///test.vim", "vim", 1, text);
  const [, errors] = await handleParse(doc);
  return getDiagnostics(doc as any, errors);
};

describe("diagnostics", () => {
  it("covers the word at the error and sets the error code", async () => {
    const [d] = await diagnose("echo 1\n  foobar baz\n");
    expect(d.code).to.equal("E492");
    expect(d.range).to.deep.equal({
      start: { line: 1, character: 2 },
      end: { line: 1, character: 8 },
    });
  });

  it("sorts the diagnostics by position", () => {
    const doc = TextDocument.create("file:///test.vim", "vim", 1, "a\nb\nc\n");
    const list = getDiagnostics(doc as any, [
      { message: "E2: two", line: 2, col: 0 },
      { message: "E1: one", line: 0, col: 0 },
    ]);
    expect(list.map((d) => d.code)).to.deep.equal(["E1", "E2"]);
  });

  it("reports one diagnostic per error", async () => {
    const list = await diagnose("let x = (\nfoobar\nfunction! F()\n");
    expect(list.map((d) => d.range.start.line)).to.deep.equal([0, 1, 2]);
  });
});

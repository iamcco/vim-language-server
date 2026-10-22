import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getWordFromPosition, handleParse } from "../../../src/common/util";

describe("parser", () => {
  it("parses Vim9 script", async () => {
    const [node] = await handleParse("vim9script\nvar x = 1\n");
    expect(node).to.not.equal(null);
  });
});

describe("getWordFromPosition", () => {
  const word = (text: string, line: number, character: number) => {
    const doc = TextDocument.create("file:///w.vim", "vim", 1, text);
    const res = getWordFromPosition(doc as any, { line, character });
    return res && res.word;
  };

  it("finds words on Vim9 lines starting with a string", () => {
    expect(word("vim9script\n'text'->setline(1)\n", 1, 10)).to.equal("setline");
  });

  it("skips Vim9 and legacy comments", () => {
    expect(word("vim9script\n# setline\n", 1, 4)).to.equal(undefined);
    expect(word("\" setline\n", 0, 4)).to.equal(undefined);
  });
});

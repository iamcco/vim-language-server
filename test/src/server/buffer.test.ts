import { expect } from "chai";
import { handleParse } from "../../../src/common/util";
import { Buffer } from "../../../src/server/buffer";

const load = async (text: string) => {
  const [node, errors] = await handleParse(text);
  expect(errors).to.deep.equal([]);
  return new Buffer("file:///test.vim", "/", node!);
};

const names = (record: Record<string, any[]>) => Object.keys(record).sort();

describe("Buffer with Vim9 script", () => {
  const script = [
    "vim9script",
    "var count = 0",
    "const NAMES = ['a']",
    "g:loaded = 1",
    "def Inc(n: number, ...rest: list<number>): number",
    "  var local = n",
    "  count += local",
    "  return count",
    "enddef",
    "export def g:Global()",
    "enddef",
    "class Shape",
    "  var size: number",
    "  def Area(): number",
    "    var tmp = this.size",
    "    return tmp",
    "  enddef",
    "endclass",
    "enum Color",
    "  Red, Green",
    "endenum",
    "type Names = list<string>",
    "var F = (x) => {",
    "  return Inc(x)",
    "}",
  ].join("\n");

  it("puts script-level names into the script scope", async () => {
    const buf = await load(script);
    expect(names(buf.getScriptFunctions())).to.deep.equal(["Inc"]);
    expect(names(buf.getGlobalFunctions())).to.deep.equal(["g:Global"]);
    expect(names(buf.getLocalIdentifiers())).to.deep.equal(["F", "NAMES", "count"]);
  });

  it("keeps function variables local and assignments as references", async () => {
    const buf = await load(script);
    expect(names(buf.getGlobalIdentifiers())).to.deep.equal(["g:loaded", "local", "tmp"]);
    expect(Object.keys(buf.getGlobalIdentifierRefs())).to.include("count");
  });

  it("collects classes and methods", async () => {
    const buf = await load(script);
    const classes = buf.getClasses();
    expect(names(classes)).to.deep.equal(["Color", "Names", "Shape"]);
    expect(classes.Shape[0]).to.include({ kind: "class", startLine: 12, startCol: 7, endLine: 18 });
    expect(names(buf.getMethods())).to.deep.equal(["Area"]);
  });

  it("completes :def arguments without a:", async () => {
    const buf = await load(script);
    const labels = buf.getFunctionLocalIdentifierItems(6).map((item) => item.label);
    expect(labels).to.include.members(["n", "rest", "local"]);
  });

  it("collects functions in a legacy script as before", async () => {
    const buf = await load("let s:x = 1\nfunction! Foo(a)\n  let l:y = a:a\nendfunction\ndef s:Bar()\nenddef\n");
    expect(names(buf.getGlobalFunctions())).to.deep.equal(["Foo"]);
    expect(names(buf.getScriptFunctions())).to.deep.equal(["s:Bar"]);
    expect(names(buf.getLocalIdentifiers())).to.deep.equal(["l:y", "s:x"]);
  });
});

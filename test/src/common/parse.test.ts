import { expect } from "chai";
import { parseWithRecovery } from "../../../src/common/parse";

const parse = (text: string) => parseWithRecovery(text.split("\n"), false);

describe("parseWithRecovery", () => {
  it("returns no errors for a valid script", () => {
    const [node, errors] = parse("vim9script\nvar x = 1\nx += 1\n");
    expect(errors).to.deep.equal([]);
    expect(node!.body.length).to.equal(3);
  });

  it("reports every error and keeps parsing", () => {
    const [node, errors] = parse("let x = (\necho 1\nfoobar baz\necho 2\n");
    expect(errors.map((e) => e.line)).to.deep.equal([0, 2]);
    expect(errors[1].message).to.match(/^E492: Not an editor command/);
    expect(node!.body.length).to.equal(2);
  });

  it("opens the block of a failing block command", () => {
    const [, errors] = parse("if (\n  echo 1\nendif\nwhile [\nendwhile\n");
    expect(errors.map((e) => e.line)).to.deep.equal([0, 3]);
  });

  it("reports blocks that are not closed at their start", () => {
    const [node, errors] = parse("function! F()\n  if 1\n    echo 1\n");
    expect(errors.map((e) => [e.line, e.message])).to.deep.equal([
      [1, "E171: Missing :endif"],
      [0, "E126: Missing :endfunction"],
    ]);
    expect(node!.body.length).to.equal(1);
  });

  it("recovers inside a Vim9 lambda block", () => {
    const [, errors] = parse("vim9script\nvar F = () => {\n  foobar baz\n}\necho 1\n");
    expect(errors.map((e) => [e.line, e.col])).to.deep.equal([[2, 2]]);
  });
});

describe("parse error messages", () => {
  const messages = (text: string) => parse(text)[1].map((e) => e.message);

  it("uses the errors of Vim", () => {
    expect(messages("let x = 1 +\n")).to.deep.equal(["E15: Invalid expression: unexpected end of line"]);
    expect(messages("echo [1 2]\n")).to.deep.equal(['E15: Invalid expression: unexpected "2"']);
    expect(messages("echo \"abc\n")).to.deep.equal(["E114: Missing double quote"]);
    expect(messages("echo 'abc\n")).to.deep.equal(["E115: Missing single quote"]);
    expect(messages("call Foo\n")).to.deep.equal(["E107: Missing parentheses"]);
    expect(messages("for in [1]\nendfor\n")).to.deep.equal(['E690: Missing "in" after :for']);
    expect(messages("let [a, b = [1, 2]\n")).to.deep.equal(["E475: Invalid argument: ="]);
  });
});

describe("errors at the end of the file", () => {
  it("reports an unfinished expression on its last line", () => {
    const [, errors] = parse("let x = 1\nlet y = (\n\n");
    expect(errors.map((e) => [e.line, e.col])).to.deep.equal([[1, 9]]);
  });
});

describe("commands that fail to parse", () => {
  const messages = (text: string) => parse(text)[1].map((e) => [e.line, e.message.replace(/:.*/, "")]);

  it("are checked for Vim9 script errors", () => {
    expect(messages("vim9script\nretu 1\n")).to.deep.equal([[1, "E133"], [1, "E1065"]]);
    expect(messages("vim9script\nlet x = (\n")).to.deep.equal([[1, "E15"], [1, "E1126"]]);
    expect(messages("var x = foo(\n")).to.deep.equal([[0, "E15"], [0, "E1124"]]);
  });
});

describe("lambda blocks of lines that fail", () => {
  it("parse the block as the body of the lambda", () => {
    const [, errors] = parse([
      "vim9script",
      "    handler: (diags: list<dict<any>>) => {",
      "      return diags->filter((_, d) => {",
      "        return d.ok",
      "      })",
      "    }",
      "echo 1",
    ].join("\n"));
    expect(errors.map((e) => [e.line, e.message.replace(/:.*/, "")])).to.deep.equal([[1, "E492"]]);
  });

  it("report a block that is not closed", () => {
    const [, errors] = parse("vim9script\n  name: (x) => {\n    return x\n");
    expect(errors.map((e) => [e.line, e.message.replace(/:.*/, "")])).to.deep.equal([[1, "E492"], [1, "E1171"]]);
  });
});

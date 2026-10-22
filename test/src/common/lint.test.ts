import { expect } from "chai";
import { lint } from "../../../src/common/lint";
import { parseWithRecovery } from "../../../src/common/parse";

const check = (text: string) => {
  const [node, errors] = parseWithRecovery(text.split("\n"), false);
  expect(errors).to.deep.equal([]);
  return lint(node).map((e) => [e.line, e.message.replace(/:.*/, "")]);
};

describe("lint", () => {
  it("reports :let in Vim9 script", () => {
    expect(check("vim9script\nlet x = 1\ndef F()\n  let y = 2\nenddef\n")).to.deep.equal([
      [1, "E1126"],
      [3, "E1126"],
    ]);
  });

  it("allows :let in a legacy function of a Vim9 script", () => {
    expect(check("vim9script\nfunction F()\n  let x = 1\n  echo s:x\nendfunction\n")).to.deep.equal([]);
  });

  it("reports :var in legacy script", () => {
    expect(check("var x = 1\nfunction F()\n  var y = 2\nendfunction\n")).to.deep.equal([
      [0, "E1124"],
      [2, "E1124"],
    ]);
  });

  it("allows :var in a :def function of a legacy script", () => {
    expect(check("def g:F()\n  var x = s:y\nenddef\nvim9cmd var z = 1\n")).to.deep.equal([]);
  });

  it("reports s: in Vim9 script", () => {
    expect(check("vim9script\necho s:x\nlegacy echo s:x\n")).to.deep.equal([[1, "E1268"]]);
  });
});

describe("lint of legacy lambdas", () => {
  it("allows s: in a legacy lambda in a Vim9 script", () => {
    const [node] = parseWithRecovery(["vim9script", "function F()", "  return {-> s:x}", "endfunction"], false);
    expect(lint(node)).to.deep.equal([]);
  });
});

// lint a Vim9 script, with the code of "lines" in a :def function or at the
// script level
const vim9 = (lines: string[], inDef = true) => {
  const text = inDef
    ? ["vim9script", "def T()"].concat(lines.map((l) => `  ${l}`), ["enddef"])
    : ["vim9script"].concat(lines);
  const [node, errors] = parseWithRecovery(text, false);
  expect(errors).to.deep.equal([]);
  return lint(node, text).map((e) => [e.line, e.message]);
};

describe("lint of Vim9 script", () => {
  it("reports declarations without type or value", () => {
    expect(vim9(["var x", "final y", "const Z", "var ok: number"])).to.deep.equal([
      [2, "E1022: Type or initialization required"],
      [3, "E1125: Final requires a value"],
      [4, "E1021: Const requires a value"],
    ]);
  });

  it("reports variables declared twice in a scope", () => {
    expect(vim9(["var x = 1", "var x = 2", "if true", "  var y = 1", "endif", "var y = 2"])).to.deep.equal([
      [3, "E1017: Variable already declared: x"],
    ]);
  });

  it("reports variables that are not declared", () => {
    expect(vim9(["echo y", "for i in range(3)", "endfor", "echo i", "{", "  var inner = 1", "}", "echo inner"])).to.deep.equal([
      [2, "E1001: Variable not found: y"],
      [5, "E1001: Variable not found: i"],
      [9, "E1001: Variable not found: inner"],
    ]);
  });

  it("reports script variables used before they are declared", () => {
    expect(vim9(["echo x", "var x = 1", "echo x"], false)).to.deep.equal([[1, "E121: Undefined variable: x"]]);
  });

  it("allows script variables declared after a function", () => {
    expect(vim9(["def F()", "  echo later", "enddef", "var later = 1"], false)).to.deep.equal([]);
  });

  it("allows functions, builtins, constants and globals", () => {
    expect(vim9(["var F = len", "echo true null null_list g:x v:true", "Undefined()", "echo Later",
      "var d = {}", "echo d.key"])).to.deep.equal([]);
  });

  it("reports shortened commands and unknown commands", () => {
    expect(vim9(["retu 1"])).to.deep.equal([[2, "E1065: Command cannot be shortened: retu"]]);
    // the parser gives E1100 for commands that do not exist in Vim9 script
    const [, errors] = parseWithRecovery(["vim9script", "k a"], false);
    expect(errors.map((e) => e.message)).to.deep.equal(["E1100: Command not supported in Vim9 script (missing :var?): k a"]);
    // :xit does not exist, this is an assignment to an undeclared variable
    expect(vim9(["x = 1"])).to.deep.equal([[2, "E1001: Variable not found: x"]]);
  });

  it("reports l: and unknown types", () => {
    expect(vim9(["echo l:x", "var n: numbr = 1"])).to.deep.equal([
      [2, "E1075: Namespace not supported: l:x"],
      [3, "E1010: Type not recognized: numbr"],
    ]);
  });
});

describe("lint of legacy variables", () => {
  const legacy = (lines: string[]) => {
    const [node, errors] = parseWithRecovery(lines, false);
    expect(errors).to.deep.equal([]);
    return lint(node, lines).map((e) => [e.line, e.message]);
  };

  it("reports local variables that a function never sets", () => {
    expect(legacy([
      "function F(arg) abort",
      "  let x = 1",
      "  for [k, v] in items({})",
      "  endfor",
      "  echo x k v l:x count arg",
      "endfunction",
    ])).to.deep.equal([[4, "E121: Undefined variable: arg"]]);
  });

  it("reports a: variables that are not arguments", () => {
    expect(legacy([
      "function F(name, ...) abort",
      "  echo a:name a:0 a:1 a:000 a:firstline a:other",
      "endfunction",
      "function G() abort",
      "  echo a:0",
      "endfunction",
    ])).to.deep.equal([[1, "E121: Undefined variable: a:other"], [4, "E121: Undefined variable: a:0"]]);
  });

  it("reports s: variables that the script never sets", () => {
    expect(legacy([
      "let s:set = 1",
      "redir => s:output",
      "redir END",
      "function s:F() abort",
      "  echo s:set s:output s:missing",
      "  call s:F()",
      "endfunction",
    ])).to.deep.equal([[4, "E121: Undefined variable: s:missing"]]);
  });

  it("skips functions that may define variables dynamically", () => {
    expect(legacy([
      "function F() abort",
      "  execute 'let x = 1'",
      "  echo x",
      "endfunction",
      "function G() abort",
      "  call win_execute(1, 'let y = 1')",
      "  echo y",
      "endfunction",
      "function H() abort closure",
      "  echo z",
      "endfunction",
      "function I() abort",
      "  echo [1]->map({_, v -> v + w})",
      "endfunction",
    ])).to.deep.equal([[12, "E121: Undefined variable: w"]]);
  });

  it("does not check variables at the script level", () => {
    expect(legacy(["echo global_set_elsewhere"])).to.deep.equal([]);
  });
});

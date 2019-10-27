export declare interface Pos {
  lnum: number;
  col: number;
  offset: number;
}

export declare interface Node {
  type: number;
  pos: Pos;
  body: Node[];
  ea: {
    linepos: Pos
    cmdpos: Pos
    argpos: Pos
    cmd: {
      name: string,
    },
  };
  cond?: Node;
  elseif?: Node[];
  _else?: Node;
  op?: string;
  catch?: Node[];
  _finally?: Node;
  left: Node;
  right: Node;
  rlist: Node[];
  str: string;
  value?: any;
  endfunction?: Node;
  list?: Node[];
}

export declare class StringReader {
  public buf: string[];
  public pos: Array<[number, number, number]>;
  constructor(str: string)
}

export declare class VimLParser {
  constructor(isNeovim: boolean)
  public parse(stringReader: StringReader): Node;
}

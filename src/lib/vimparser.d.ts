export declare interface IPos {
  lnum: number;
  col: number;
  offset: number;
}

export declare interface Node {
  type: number;
  pos: IPos;
  body: Node[];
  ea: {
    linepos: IPos
    cmdpos: IPos
    argpos: IPos
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

export declare interface IPos {
  lnum: number;
  col: number;
  offset: number;
}

export declare interface INode {
  type: number;
  pos: IPos;
  body: INode[];
  ea: {
    linepos: IPos
    cmdpos: IPos
    argpos: IPos
    cmd: {
      name: string,
    },
  };
  cond?: INode;
  elseif?: INode[];
  _else?: INode;
  op?: string;
  catch?: INode[];
  _finally?: INode;
  left: INode;
  right: INode;
  rlist: INode[];
  str: string;
  value?: any;
  endfunction?: INode;
  list?: INode[];
}

export declare class StringReader {
  public buf: string[];
  public pos: [number, number, number][];
  constructor(lines: string[])
}

// tslint:disable-next-line
export declare class VimLParser {
  constructor(isNeovim: boolean)
  public parse(stringReader: StringReader): INode;
}

import { createConnection, IConnection } from "vscode-languageserver";

// create connection by command argv
export const connection: IConnection = createConnection();

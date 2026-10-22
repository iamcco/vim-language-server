// Replace the LSP connection with a stub, so that modules which create it at
// load time (logger -> connection) can be tested without a client.
import Module from "module";

const sentDiagnostics: any[] = [];

const noop: any = new Proxy(() => noop, {
  get: (_target, key) => {
    if (key === "sendDiagnostics") {
      return (params: any) => sentDiagnostics.push(params);
    }
    return noop;
  },
});

const mod: any = Module;
const originalLoad = mod._load;
mod._load = function(request: string, ...args: any[]) {
  if (request === "vscode-languageserver/node") {
    return { createConnection: () => noop };
  }
  return originalLoad.call(this, request, ...args);
};

export { sentDiagnostics };

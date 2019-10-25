import { IConfig, IDiagnostic, ISuggest, IIndexes } from '../common/types';
import { projectRootPatterns } from '../common/constant';

let conf: IConfig;

export default {
  init(config: IConfig) {
    conf = config
  },

  get iskeyword(): string {
    return conf && conf.iskeyword || ''
  },

  get vimruntime(): string {
    return conf && conf.vimruntime || ''
  },

  get runtimepath(): string[] {
    return conf && conf.runtimepath || []
  },

  get diagnostic(): IDiagnostic {
    return conf && conf.diagnostic || {
      enable: true
    }
  },

  get snippetSupport() : boolean {
    return conf && conf.snippetSupport || false
  },

  get suggest(): ISuggest {
    return conf && conf.suggest || {
      fromRuntimepath: false,
      fromVimruntime: true
    }
  },

  get indexes(): IIndexes {
    return conf && conf.indexes || {
      runtimepath: true,
      gap: 100,
      count: 1,
      projectRootPatterns: projectRootPatterns
    }
  }
}

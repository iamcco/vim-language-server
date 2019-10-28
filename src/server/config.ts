import { projectRootPatterns } from "../common/constant";
import { IConfig, IDiagnostic, IIndexes, ISuggest } from "../common/types";

let conf: IConfig;

export default {
  init(config: IConfig) {
    conf = config;
  },

  get iskeyword(): string {
    return conf && conf.iskeyword || "";
  },

  get vimruntime(): string {
    return conf && conf.vimruntime || "";
  },

  get runtimepath(): string[] {
    return conf && conf.runtimepath || [];
  },

  get diagnostic(): IDiagnostic {
    return conf && conf.diagnostic || {
      enable: true,
    };
  },

  get snippetSupport(): boolean {
    return conf && conf.snippetSupport || false;
  },

  get suggest(): ISuggest {
    return conf && conf.suggest || {
      fromRuntimepath: false,
      fromVimruntime: true,
    };
  },

  get indexes(): IIndexes {
    const defaults = {
      count: 1,
      gap: 100,
      projectRootPatterns,
      runtimepath: true,
    };

    if (!conf || !conf.indexes) {
      return defaults;
    }

    if (conf.indexes.gap !== undefined) {
      defaults.gap = conf.indexes.gap;
    }
    if (conf.indexes.count !== undefined) {
      defaults.count = conf.indexes.count;
    }
    if (conf.indexes.projectRootPatterns !== undefined
        && Array.isArray(conf.indexes.projectRootPatterns)
        && conf.indexes.projectRootPatterns.length
       ) {
      defaults.projectRootPatterns = conf.indexes.projectRootPatterns;
    }

    return defaults;
  },
};

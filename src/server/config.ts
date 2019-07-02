import { IConfig } from '../common/types';

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
  }
}

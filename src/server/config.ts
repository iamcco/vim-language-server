import { IConfig } from '../common/types';

let conf: IConfig;

export default {
  init(config: IConfig) {
    conf = config
  },

  get iskeyword() {
    return conf && conf.iskeyword || ''
  },

  get vimruntime() {
    return conf && conf.vimruntime || ''
  },

  get runtimepath() {
    return conf && conf.runtimepath || ''
  }
}

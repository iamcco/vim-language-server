import { connection } from '../server/connection';

export default function(name: string) {
  return {
    log(message: string) {
      connection.console.log(`${name}: ${message}`)
    },
    info(message: string) {
      connection.console.info(`${name}: ${message}`)
    },
    warn(message: string) {
      connection.console.warn(`${name}: ${message}`)
    },
    error(message: string) {
      connection.console.error(`${name}: ${message}`)
    },
  }
}

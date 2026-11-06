// CLI integration tests replace both AI entry points before main() runs.
// Block SDK construction too, so an accidental call cannot reach a network.
const Module = require('node:module')
const load = Module._load
Module._load = function (id, ...args) {
  if (id === 'openai') {
    return { OpenAI: class { constructor() { throw new Error('AI is disabled in offline tests') } } }
  }
  return load.call(this, id, ...args)
}
const analyzer = require('../../dist/analyzer.js')
analyzer.generatePRDescription = async summary => `OFFLINE_PR:${JSON.stringify(summary)}`
analyzer.generateCommitMessage = async () => ({ type: 'test', subject: 'offline staged changes' })

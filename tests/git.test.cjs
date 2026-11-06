const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { getStagedDiff, getBranchDiff, getBranchCommitCount, getCommitDiff } = require('../dist/git.js')

const cli = path.resolve(__dirname, '../dist/index.js')
const offlineAI = path.resolve(__dirname, 'fixtures/offline-ai.cjs')

function withRepo(run) {
  const root = mkdtempSync(path.join(tmpdir(), 'git-ghost-test-'))
  const cwd = process.cwd()
  const env = process.env
  const repo = path.join(root, 'repo')
  mkdirSync(repo)
  mkdirSync(path.join(root, 'home'))
  writeFileSync(path.join(root, 'gitconfig'), '')
  // Do not inherit credentials, Git settings, hooks, or AI configuration.
  process.env = {
    PATH: env.PATH,
    ...(env.SystemRoot ? { SystemRoot: env.SystemRoot } : {}),
    HOME: path.join(root, 'home'),
    USERPROFILE: path.join(root, 'home'),
    XDG_CONFIG_HOME: path.join(root, 'home'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Git Ghost Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Git Ghost Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
    LC_ALL: 'C',
  }
  process.chdir(repo)
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const runCLI = (...args) => spawnSync(process.execPath, ['--require', offlineAI, cli, ...args], {
    encoding: 'utf8', env: process.env, timeout: 10_000,
  })
  try {
    git('init', '--initial-branch=main', '--template=')
    writeFileSync('base.txt', 'base\n')
    git('add', '.')
    git('commit', '-m', 'initial')
    const base = git('rev-parse', 'HEAD')
    git('update-ref', 'refs/remotes/origin/main', base)
    git('checkout', '-b', 'feature/auth')
    writeFileSync('feature.txt', 'feature\n')
    git('add', '.')
    git('commit', '-m', 'add feature')
    const head = git('rev-parse', 'HEAD')
    git('tag', 'v1.0')
    git('tag', '-a', 'release', '-m', 'annotated release')
    run({ git, runCLI, root, repo, base, head })
  } finally {
    process.chdir(cwd)
    process.env = env
    rmSync(root, { recursive: true, force: true })
  }
}

test('preserves branches, hashes, tags, remote refs, reflogs and revision syntax', () => withRepo(({ git, base, head }) => {
  const expected = git('diff', `${base}...${head}`)
  for (const ref of ['feature/auth', 'HEAD', '@', 'HEAD@{0}', 'v1.0', 'release', 'release^{}', head, head.slice(0, 8)]) {
    assert.equal(getBranchDiff('origin/main', ref).trim(), expected, ref)
    assert.match(getCommitDiff(ref), /feature\.txt/, ref)
    assert.equal(getBranchCommitCount('main', ref), 1, ref)
  }
  for (const ref of ['main', 'refs/heads/main', 'HEAD~1', 'HEAD^', base, base.slice(0, 8)]) {
    assert.equal(getBranchDiff(ref, 'HEAD').trim(), expected, ref)
    assert.match(getCommitDiff(ref), /base\.txt/, ref)
  }
}))

test('preserves literal shell metacharacters in valid Git ref names', () => withRepo(({ git, head }) => {
  for (const ref of ['feature/semi;colon', 'feature/$literal', 'feature/$(literal)', 'feature/`literal`', "feature/quo'te", 'feature/double"quote', 'feature/a&b', 'feature/a|b']) {
    git('update-ref', `refs/heads/${ref}`, head)
    assert.match(getBranchDiff('main', ref), /feature\.txt/, ref)
    assert.match(getCommitDiff(ref), /feature\.txt/, ref)
    assert.equal(getBranchCommitCount('main', ref), 1, ref)
  }
}))

test('keeps triple-dot merge-base diff and symmetric commit count on diverged branches', () => withRepo(({ git, head }) => {
  git('checkout', 'main')
  writeFileSync('base-only.txt', 'base side\n')
  git('add', '.')
  git('commit', '-m', 'base divergence')
  assert.equal(getBranchDiff('main', head).trim(), git('diff', `main...${head}`))
  assert.doesNotMatch(getBranchDiff('main', head), /base-only/)
  assert.equal(getBranchCommitCount('main', head), 2)
  assert.equal(getBranchDiff('main', 'main'), '')
  assert.equal(getBranchCommitCount('main', 'main'), 0)
}))

test('rejects invalid revisions, ranges, paths, trees and blobs', () => withRepo(() => {
  for (const ref of ['', 'missing-ref', 'HEAD main', 'HEAD..main', 'main...HEAD', 'HEAD^!', 'HEAD^@', 'HEAD:feature.txt', 'HEAD^{tree}', 'feature.txt', '\0']) {
    assert.throws(() => getCommitDiff(ref), /Invalid commit reference|Cannot find commit/, JSON.stringify(ref))
    assert.throws(() => getBranchDiff(ref, 'HEAD'), /Invalid commit reference|Cannot find commit/)
    assert.throws(() => getBranchDiff('main', ref), /Invalid commit reference|Cannot find commit/)
    assert.throws(() => getBranchCommitCount(ref, 'HEAD'), /Invalid commit reference|Cannot find commit/)
    assert.throws(() => getBranchCommitCount('main', ref), /Invalid commit reference|Cannot find commit/)
  }
}))

test('rejects shell injection without creating a marker in any helper', () => withRepo(() => {
  const payloads = ['HEAD; touch marker', 'HEAD && touch marker', 'HEAD | touch marker', 'HEAD\ntouch marker', 'HEAD$(touch marker)', 'HEAD`touch marker`', 'HEAD > marker', 'HEAD"; touch marker; #', "HEAD'; touch marker; #"]
  for (const ref of payloads) {
    for (const run of [() => getCommitDiff(ref), () => getBranchDiff(ref, 'HEAD'), () => getBranchDiff('main', ref), () => getBranchCommitCount(ref, 'HEAD'), () => getBranchCommitCount('main', ref)]) {
      assert.throws(run, /Cannot find commit/)
      assert.equal(existsSync('marker'), false, ref)
    }
  }
}))

test('rejects Git option injection in every ref position without writing output', () => withRepo(() => {
  writeFileSync('output', 'unchanged\n')
  for (const ref of ['--output=output', '--help', '-h', '--all', '--ext-diff', '--textconv', '-c', '--', '--upload-pack=touch marker']) {
    for (const run of [() => getCommitDiff(ref), () => getBranchDiff(ref, 'HEAD'), () => getBranchDiff('main', ref), () => getBranchCommitCount(ref, 'HEAD'), () => getBranchCommitCount('main', ref)]) {
      assert.throws(run, /Invalid commit reference/)
      assert.equal(readFileSync('output', 'utf8'), 'unchanged\n')
      assert.equal(existsSync('marker'), false)
    }
  }
}))

test('does not reinterpret a filename matching an object ID as a path', () => withRepo(({ git, head }) => {
  writeFileSync(head, 'not a revision\n')
  assert.match(getCommitDiff(head), /feature\.txt/)
  assert.match(getBranchDiff('main', head), /feature\.txt/)
  assert.equal(getBranchCommitCount('main', head), 1)
  assert.equal(git('rev-parse', 'HEAD'), head)
}))

test('reads empty and staged diffs while disabling external diff and textconv programs', () => withRepo(({ git }) => {
  assert.equal(getStagedDiff(), '')
  writeFileSync('feature.txt', 'changed\n')
  writeFileSync('.gitattributes', '*.txt diff=blocked\n')
  git('config', 'diff.external', 'touch marker')
  git('config', 'diff.blocked.textconv', 'touch marker')
  git('add', '.')
  assert.match(getStagedDiff(), /\+changed/)
  assert.match(getBranchDiff('main', 'HEAD'), /feature\.txt/)
  assert.match(getCommitDiff('HEAD'), /feature\.txt/)
  assert.equal(existsSync('marker'), false)
}))

test('CLI help, explain, scan and PR defaults work without network or credentials', () => withRepo(({ runCLI, git }) => {
  let result = runCLI('help')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /USAGE:/)
  result = runCLI('explain', 'HEAD')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /feature\.txt/)
  for (const refs of [[], ['main', 'feature/auth'], ['HEAD~1', 'release']]) {
    result = runCLI('pr', ...refs)
    assert.equal(result.status, 0, result.stderr)
    const summary = JSON.parse(result.stdout.match(/OFFLINE_PR:(.+)/)[1])
    assert.equal(summary.commitCount, 1)
    assert.deepEqual(summary.files, ['feature.txt'])
  }
  writeFileSync('staged.txt', 'staged\n')
  git('add', '.')
  result = runCLI('scan')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /test: offline staged changes/)
}))

test('CLI rejects invalid, shell and Git option payloads in base, head and commit arguments', () => withRepo(({ runCLI }) => {
  writeFileSync('output', 'unchanged\n')
  for (const ref of ['missing-ref', 'HEAD..main', '--help', '--all', '--output=output', 'HEAD; touch marker', 'HEAD$(touch marker)', 'HEAD`touch marker`', 'HEAD\ntouch marker']) {
    for (const args of [['explain', ref], ['pr', ref, 'HEAD'], ['pr', 'main', ref]]) {
      const result = runCLI(...args)
      assert.equal(result.status, 1, `${JSON.stringify(args)}: ${result.stderr}`)
      assert.match(result.stderr, /Error:/)
      assert.doesNotMatch(result.stdout, /OFFLINE_PR:/)
      assert.equal(existsSync('marker'), false)
      assert.equal(readFileSync('output', 'utf8'), 'unchanged\n')
    }
  }
  assert.equal(runCLI('explain').status, 1)
}))

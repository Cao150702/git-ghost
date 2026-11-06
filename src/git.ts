import { execFileSync } from 'child_process'

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024

function git(args: string[], maxBuffer = DEFAULT_MAX_BUFFER): string {
  // Never pass revisions through a shell. Disable diff programs configured by
  // the repository: these helpers only need Git's own textual diff output.
  return execFileSync('git', ['--no-pager', ...args], {
    encoding: 'utf-8',
    maxBuffer,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function resolveCommit(ref: string): string {
  if (!ref || ref.startsWith('-') || ref.includes('\0')) {
    throw new Error(`Invalid commit reference: ${JSON.stringify(ref)}`)
  }

  try {
    // --verify accepts exactly one revision; --end-of-options prevents Git
    // option injection. Peeling to a commit rejects trees, blobs and ranges,
    // while preserving tags, short hashes, reflogs and relative revisions.
    const oid = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim()
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(oid)) throw new Error('Invalid object ID')
    return oid
  } catch {
    throw new Error(`Cannot find commit ${JSON.stringify(ref)}`)
  }
}

function branchRange(base: string, head: string): string {
  return `${resolveCommit(base)}...${resolveCommit(head)}`
}

export function getStagedDiff(): string {
  try {
    return git(['diff', '--no-ext-diff', '--no-textconv', '--staged', '--'])
  } catch {
    throw new Error('Cannot read staged changes. Run this command inside a Git repository.')
  }
}

export function getBranchDiff(base: string, head: string): string {
  const range = branchRange(base, head)
  try {
    return git(['diff', '--no-ext-diff', '--no-textconv', range, '--'], 20 * 1024 * 1024)
  } catch {
    throw new Error(`Cannot diff ${JSON.stringify(base)}...${JSON.stringify(head)}. Check branch history.`)
  }
}

export function getBranchCommitCount(base: string, head: string): number {
  const range = branchRange(base, head)
  // Match the previous symmetric-difference log count without buffering every
  // commit subject or allowing either ref to introduce log/rev-list options.
  return Number(git(['rev-list', '--count', range, '--']).trim())
}

export function getCommitDiff(ref: string): string {
  const oid = resolveCommit(ref)
  return git(['show', '--no-ext-diff', '--no-textconv', oid, '--'])
}

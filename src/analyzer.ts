import { execSync } from 'child_process'
import { OpenAI } from 'openai'
import type { DiffSummary, CommitMessage, PRSummary } from './types'

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Please export it or add to .env.')
    _openai = new OpenAI({ apiKey })
  }
  return _openai
}

// ============================================================
// Level 1: Local diff parsing (rule-based, fast, zero cost)
// ============================================================

export function parseDiff(diffOutput: string): DiffSummary {
  const files: string[] = []
  const keywords: string[] = []

  // Extract file paths from +++ b/ lines
  const fileRegex = /^\+\+\+ b\/(.+)$/gm
  let match
  while ((match = fileRegex.exec(diffOutput)) !== null) {
    files.push(match[1])
  }

  // Count added/deleted lines (exclude +++ and --- headers)
  const allLines = diffOutput.split('\n')
  let addedLines = 0
  let deletedLines = 0
  for (const line of allLines) {
    if (line.startsWith('+') && !line.startsWith('+++')) addedLines++
    else if (line.startsWith('-') && !line.startsWith('---')) deletedLines++
  }

  // Extract content from added lines for keyword analysis
  const addedContent = allLines
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .join(' ')

  // Keyword extraction patterns
  const keywordMap: [RegExp, string][] = [
    [/\b(useState|useEffect|useRef|useMemo|useCallback)\b/, 'react-hooks'],
    [/\b(describe|it\(|test\(|expect\()/, 'testing'],
    [/\b(console\.log|debugger|console\.warn)/, 'debug'],
    [/\b(pragma solidity|contract |function |event )/, 'solidity'],
    [/\b(interface |type |enum )/, 'typescript'],
    [/\b(TODO|FIXME|HACK|XXX)/, 'technical-debt'],
    [/\b(async |await |Promise)/, 'async'],
    [/\b(class |extends |implements )/, 'oop'],
  ]

  for (const [pattern, keyword] of keywordMap) {
    if (pattern.test(addedContent)) {
      keywords.push(keyword)
    }
  }

  // Determine likely commit type (order matters — last match wins)
  let likelyType: DiffSummary['likelyType'] = 'chore'
  if (/package\.json|\.lock|yarn\.lock|pnpm-lock/.test(files.join(' '))) likelyType = 'chore'
  if (/\b(test|describe|it\(|expect\()/.test(addedContent)) likelyType = 'test'
  if (/\b(refactor|rename|move|extract|inline|simplify)/.test(addedContent)) likelyType = 'refactor'
  if (/\b(fix|bug|error|catch|throw|patch|hotfix)/.test(addedContent)) likelyType = 'fix'
  if (/\b(useState|useEffect|Component|Page|create|add|implement|new feature)/.test(addedContent)) likelyType = 'feat'

  return { files, addedLines, deletedLines, keywords, likelyType }
}

// ============================================================
// Level 2: AI semantic analysis
// ============================================================

const COMMIT_MSG_PROMPT = `Analyze the following diff summary and generate a Conventional Commits message.

## Diff Summary
{summary}

## Requirements
1. Output valid JSON only
2. type: one of feat|fix|refactor|chore|test|docs|style|perf|ci|build
3. scope: short module name (e.g. ui, api, auth, cli, contracts) — omit if unclear
4. subject: under 72 chars, imperative mood ("add" not "added")
5. body: optional, under 100 chars, explain "why" not "what"

## Examples
Input: { "files": ["src/components/Button.tsx"], "keywords": ["react-hooks", "async"], "likelyType": "feat", "addedLines": 18, "deletedLines": 2 }
Output: { "type": "feat", "scope": "ui", "subject": "add async loading state to Button component", "body": "Support skeleton UI while waiting for data fetch" }

Input: { "files": ["src/api/auth.ts", "tests/auth.test.ts"], "keywords": ["testing", "fix"], "likelyType": "fix", "addedLines": 8, "deletedLines": 3 }
Output: { "type": "fix", "scope": "auth", "subject": "correct token refresh race condition", "body": "Add mutex lock to prevent concurrent refresh requests" }`

const PR_DESCRIPTION_PROMPT = `Analyze the following diff summary from a pull request and generate a structured PR description.

## Diff Summary
{summary}

## Requirements
1. Output Markdown format
2. Title: concise, under 80 chars
3. Summary: what changed and why (2-3 sentences)
4. Changes: bulleted list of key changes
5. Testing: how to verify (1-2 sentences)
6. Keep it concise — no filler`

export async function generateCommitMessage(summary: DiffSummary): Promise<CommitMessage> {
  const openai = getOpenAI()
  const prompt = COMMIT_MSG_PROMPT.replace('{summary}', JSON.stringify(summary, null, 2))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a Git expert. Output only valid JSON, no markdown code fences.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0].message.content || '{}'
  return JSON.parse(content) as CommitMessage
}

export async function generatePRDescription(summary: PRSummary): Promise<string> {
  const openai = getOpenAI()
  const prompt = PR_DESCRIPTION_PROMPT.replace('{summary}', JSON.stringify(summary, null, 2))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a senior developer writing PR descriptions. Be concise and precise.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 1500,
  })

  return completion.choices[0].message.content || 'Unable to generate PR description.'
}

// ============================================================
// Formatters
// ============================================================

export function formatCommit(msg: CommitMessage): string {
  let result = `${msg.type}`
  if (msg.scope) result += `(${msg.scope})`
  result += `: ${msg.subject}`
  if (msg.body) result += `\n\n${msg.body}`
  return result
}

// ============================================================
// Git helpers
// ============================================================

export function getStagedDiff(): string {
  try {
    return execSync('git diff --staged', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
  } catch {
    console.error('Error: No staged changes found. Run `git add` first.')
    process.exit(1)
  }
}

export function getBranchDiff(base: string, head: string): string {
  try {
    return execSync(`git diff ${base}...${head}`, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 })
  } catch {
    console.error(`Error: Cannot diff ${base}...${head}. Check branch names.`)
    process.exit(1)
  }
}

export function getCommitDiff(hash: string): string {
  try {
    return execSync(`git show ${hash}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
  } catch {
    console.error(`Error: Cannot find commit ${hash}`)
    process.exit(1)
  }
}

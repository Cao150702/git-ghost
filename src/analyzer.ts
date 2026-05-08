import { execSync } from 'child_process'
import { OpenAI } from 'openai'
import type { DiffSummary, CommitMessage } from './types'

const openai = new OpenAI()

// --- 第一级：本地 diff 解析（规则） ---

export function parseDiff(diffOutput: string): DiffSummary {
  const files: string[] = []
  const keywords: string[] = []

  // Extract file paths
  const fileRegex = /^\+\+\+ b\/(.+)$/gm
  let match
  while ((match = fileRegex.exec(diffOutput)) !== null) {
    files.push(match[1])
  }

  // Count lines
  const addedLines = (diffOutput.match(/^\+.+$/gm) || []).filter(l => !l.startsWith('+++')).length
  const deletedLines = (diffOutput.match(/^-.+$/gm) || []).filter(l => !l.startsWith('---')).length

  // Extract keywords from added lines
  const addedContent = diffOutput
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .join(' ')

  const keywordMap: Record<string, string> = {
    'useState|useEffect|useRef': 'react-hooks',
    'test|describe|it\\(': 'testing',
    'console\\.log|debugger': 'debug',
    'import|require': 'dependency',
    'interface|type ': 'typescript',
    'function |const |class ': 'code',
    'TODO|FIXME|HACK': 'technical-debt',
  }

  for (const [pattern, keyword] of Object.entries(keywordMap)) {
    if (new RegExp(pattern).test(addedContent)) {
      keywords.push(keyword)
    }
  }

  // Determine likely commit type
  let likelyType: DiffSummary['likelyType'] = 'chore'
  if (/useState|useEffect|Component|Page/.test(addedContent)) likelyType = 'feat'
  if (/fix|bug|error|catch|throw/.test(addedContent)) likelyType = 'fix'
  if (/refactor|rename|move|extract/.test(addedContent)) likelyType = 'refactor'
  if (/test|describe|it\(/.test(addedContent)) likelyType = 'test'
  if (/package\.json|\.config|\.rc/.test(files.join(' '))) likelyType = 'chore'

  return { files, addedLines, deletedLines, keywords, likelyType }
}

// --- 第二级：AI 语义分析 ---

const COMMIT_PROMPT = `基于以下 diff 摘要，生成 Conventional Commits 格式的 commit message。

## diff 摘要
{summary}

## 要求
1. 输出 JSON 格式
2. type: feat|fix|refactor|chore|test|docs|style
3. scope: 简短范围（如 ui, api, auth, cli）
4. subject: 50 字以内
5. body: 补充说明（可选，不超过 100 字）

## 示例
输入：{ "files": ["src/components/Button.tsx"], "keywords": ["react-hooks", "code"], "likelyType": "feat" }
输出：{ "type": "feat", "scope": "ui", "subject": "add loading state to Button component", "body": "Added useState and useEffect for async operation handling" }`

export async function generateCommitMessage(summary: DiffSummary): Promise<CommitMessage> {
  const prompt = COMMIT_PROMPT.replace('{summary}', JSON.stringify(summary, null, 2))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '你是一个 Git 专家。只输出 JSON，不要其他内容。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0].message.content || '{}'
  return JSON.parse(content)
}

// --- Format commit message ---

export function formatCommit(msg: CommitMessage): string {
  let result = `${msg.type}`
  if (msg.scope) result += `(${msg.scope})`
  result += `: ${msg.subject}`
  if (msg.body) result += `\n\n${msg.body}`
  return result
}

// --- CLI helpers ---

export function getStagedDiff(): string {
  try {
    return execSync('git diff --staged', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
  } catch {
    console.error('没有暂存的改动。请先运行 git add')
    process.exit(1)
  }
}

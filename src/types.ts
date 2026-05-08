export interface DiffSummary {
  files: string[]
  addedLines: number
  deletedLines: number
  keywords: string[]
  likelyType: 'feat' | 'fix' | 'refactor' | 'chore' | 'test'
}

export interface CommitMessage {
  type: 'feat' | 'fix' | 'refactor' | 'chore' | 'test' | 'docs' | 'style' | 'perf' | 'ci' | 'build'
  scope?: string
  subject: string
  body?: string
}

export interface PRSummary extends DiffSummary {
  baseBranch: string
  headBranch: string
  commitCount: number
}

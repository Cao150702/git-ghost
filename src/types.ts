export interface DiffSummary {
  files: string[]
  fileTypes?: string[]
  addedLines: number
  deletedLines: number
  keywords: string[]
  likelyType: 'feat' | 'fix' | 'refactor' | 'chore' | 'test'
}

export interface CommitMessage {
  type: 'feat' | 'fix' | 'refactor' | 'chore' | 'test' | 'docs' | 'style'
  scope?: string
  subject: string
  body?: string
}

#!/usr/bin/env node
import { getStagedDiff, getBranchDiff, getCommitDiff, parseDiff, generateCommitMessage, generatePRDescription, formatCommit } from './analyzer'
import type { PRSummary } from './types'
import { execSync } from 'child_process'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  switch (command) {
    case 'scan': {
      console.log('👻 Git Ghost: Analyzing staged changes...\n')

      const diff = getStagedDiff()
      const summary = parseDiff(diff)

      // Display summary
      console.log('📁 Changed files:')
      summary.files.forEach(f => console.log(`   - ${f}`))
      console.log(`\n📊 Changes: +${summary.addedLines} / -${summary.deletedLines} lines`)
      console.log(`🏷️  Detected type: ${summary.likelyType}`)
      if (summary.keywords.length > 0) {
        console.log(`🔑 Keywords: ${summary.keywords.join(', ')}`)
      }

      // Generate commit message
      console.log('\n🤖 Generating commit message...')
      const msg = await generateCommitMessage(summary)
      const formatted = formatCommit(msg)

      console.log(`\n✅ Recommended commit message:\n`)
      console.log(`   ${formatted}\n`)
      console.log('💡 Copy the message above and use: git commit -m "..."')
      break
    }

    case 'pr': {
      const base = args[1] || 'origin/main'
      const head = args[2] || 'HEAD'

      console.log(`👻 Git Ghost: Analyzing PR diff (${base}...${head})...\n`)

      const diff = getBranchDiff(base, head)
      const parsed = parseDiff(diff)

      // Get commit count
      let commitCount = 0
      try {
        const log = execSync(`git log ${base}...${head} --oneline`, { encoding: 'utf-8' })
        commitCount = log.trim().split('\n').filter(Boolean).length
      } catch { /* ignore */ }

      const summary: PRSummary = { ...parsed, baseBranch: base, headBranch: head, commitCount }

      console.log('📁 Changed files:')
      summary.files.forEach(f => console.log(`   - ${f}`))
      console.log(`📊 Changes: +${summary.addedLines} / -${summary.deletedLines} lines`)
      console.log(`📋 Commits: ${summary.commitCount}`)

      console.log('\n🤖 Generating PR description...')
      const description = await generatePRDescription(summary)

      console.log(`\n✅ PR Description:\n`)
      console.log(description)
      break
    }

    case 'explain': {
      const commitHash = args[1]
      if (!commitHash) {
        console.error('Usage: gg explain <commit-hash>')
        process.exit(1)
      }

      const diff = getCommitDiff(commitHash)
      const summary = parseDiff(diff)

      console.log(`\n📝 Explanation for commit ${commitHash.slice(0, 7)}:`)
      console.log(`   Files: ${summary.files.join(', ')}`)
      console.log(`   Type: ${summary.likelyType}`)
      console.log(`   Scale: +${summary.addedLines} / -${summary.deletedLines} lines`)
      if (summary.keywords.length > 0) {
        console.log(`   Keywords: ${summary.keywords.join(', ')}`)
      }
      break
    }

    case 'help':
    default:
      console.log(`
Git Ghost 👻 — AI-powered Git commit message generator

USAGE:
  gg scan              Analyze staged changes, generate commit message
  gg pr [base] [head]  Generate PR description (default: origin/main...HEAD)
  gg explain <hash>    Explain what a specific commit changed

EXAMPLES:
  gg scan                         # Generate commit message for staged changes
  gg pr origin/main feature/auth  # Generate PR description for a branch
  gg explain abc1234              # Explain a specific commit

ENVIRONMENT:
  OPENAI_API_KEY    Your OpenAI API key (required)

OPTIONS:
  --dry-run         Show analysis without calling AI (planned)
  --interactive     Generate multiple candidates to choose from (planned)
      `)
  }
}

main().catch((err) => {
  if (err.message?.includes('OPENAI_API_KEY')) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.')
    console.error('Export it: export OPENAI_API_KEY=sk-...')
  } else {
    console.error('Error:', err.message)
  }
  process.exit(1)
})

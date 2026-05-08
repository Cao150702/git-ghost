#!/usr/bin/env node
import { getStagedDiff, parseDiff, generateCommitMessage, formatCommit } from './analyzer'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'scan'

  switch (command) {
    case 'scan': {
      console.log('👻 Git Ghost: 正在分析暂存区改动...\n')

      const diff = getStagedDiff()
      const summary = parseDiff(diff)

      // Show summary
      console.log('📁 检测到改动的文件：')
      summary.files.forEach(f => console.log(`   - ${f}`))
      console.log(`\n📊 +${summary.addedLines} / -${summary.deletedLines} 行`)
      console.log(`🏷️  推断类型：${summary.likelyType}`)
      console.log(`🔑 关键词：${summary.keywords.join(', ')}`)

      // Generate commit message
      console.log('\n🤖 正在生成 commit message...')
      const msg = await generateCommitMessage(summary)
      const formatted = formatCommit(msg)

      console.log(`\n✅ 推荐的 commit message：\n`)
      console.log(`   ${formatted}`)
      break
    }

    case 'explain': {
      const commitHash = args[1]
      if (!commitHash) {
        console.error('用法：gg explain <commit-hash>')
        process.exit(1)
      }

      const { execSync } = require('child_process')
      const diff = execSync(`git show ${commitHash}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
      const summary = parseDiff(diff)

      console.log(`\n📝 Commit ${commitHash.slice(0, 7)} 的解释：`)
      console.log(`   改动文件：${summary.files.join(', ')}`)
      console.log(`   推断类型：${summary.likelyType}`)
      console.log(`   变更规模：+${summary.addedLines} / -${summary.deletedLines} 行`)
      break
    }

    default:
      console.log('Git Ghost 👻 — AI 驱动的 Git 提交信息生成器')
      console.log('\n用法：')
      console.log('  gg scan          分析暂存区，生成 commit message')
      console.log('  gg explain <hash> 用自然语言解释某次 commit')
      console.log('\n环境变量：')
      console.log('  OPENAI_API_KEY    你的 OpenAI API Key')
  }
}

main().catch(console.error)

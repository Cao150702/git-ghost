# Git Ghost 👻

> "让每一次 commit 都有意义——AI 驱动的 Git 提交信息生成器"

## 问题定义

**现状**：90% 的 commit message 都是 `fix`、`update`、`改了点东西`。
**后果**：
1. `git blame` 毫无意义
2. 回滚时不知道哪个 commit 是修什么的
3. 团队协作时，PR 历史无法追溯

**根因**：
- 写好的 commit message 需要思考，开发者懒得想
- Conventional Commits 格式好，但没人记得住规范
- 多文件 diff 的语义，人类很难快速总结

---

## 产品方案

Git Ghost 是一个 CLI 工具，分析 `git diff` 的语义，自动生成符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的提交信息。

```bash
# 使用方式
gg scan    # 分析暂存区，生成 commit message
gg pr      # 分析 PR 的两个分支差异，生成 PR 描述
```

### 核心功能

| 功能 | 说明 |
|------|------|
| `gg scan` | 分析 `git diff --staged`，生成 commit message |
| `gg pr` | 分析 PR diff，生成 PR 描述和标题 |
| `gg explain` | 输入任意 commit hash，用自然语言解释这次改动 |
| `--dry-run` | 只展示，不自动提交 |
| `--interactive` | 生成多个候选，让用户选 |

---

## AI 协作记录

详见 `/docs/ai-dialogue/`：

- [01-initial-problem.md](docs/ai-dialogue/01-initial-problem.md) — 问题定义过程
- [02-diff-analysis-design.md](docs/ai-dialogue/02-diff-analysis-design.md) — diff 语义分析方案设计
- [03-prompt-iteration.md](docs/ai-dialogue/03-prompt-iteration.md) — Prompt 迭代记录

---

## 技术栈

- **Language**: TypeScript（Node.js CLI）
- **AI**: OpenAI GPT-4o-mini（成本低，速度快）
- **Parse**: 自建 diff 解析器（识别文件路径、增删行数、关键词）
- **Output**: 结构化 JSON → 格式化 commit message

---

## 安装

```bash
npm install -g git-ghost
# 或
npx git-ghost scan
```

---

## 使用示例

```bash
# 1. 暂存改动
git add src/components/Button.tsx

# 2. 生成 commit message
gg scan

# 输出：
# ✅ 检测到改动：
#   - src/components/Button.tsx (+, 12 lines / -, 3 lines)
# 
# ✅ 推荐 commit message：
#   feat(ui): add loading state to Button component
#
# 是否使用这条消息提交？[Y/n]

# 3. 生成 PR 描述
gg pr origin/main...feature/button-loading

# 输出：结构化 PR 描述（ Markdown 格式）
```

---

## 项目结构

```
src/
├── index.ts          # CLI 入口
├── analyzer.ts       # git diff 解析器
├── generator.ts      # AI 调用 + prompt 模板
├── formatter.ts      # 输出格式化
└── types.ts          # TypeScript 类型定义
```

---

## 为什么这个项目能展示我的能力

| 能力维度 | 展示方式 |
|---------|---------|
| 问题定义 | README 对"为什么 commit message 烂"的根因分析 |
| 逻辑思维 | diff 解析 → 语义理解 → 结构化输出的 pipeline 设计 |
| 产品能力 | 不止生成 commit message，还有 `gg pr`、`gg explain` |
| AI协作 | `/docs/ai-dialogue/` 展示 prompt 迭代过程 |

---

## Author

[@Cao150702](https://github.com/Cao150702)

# Diff 语义分析方案设计 — Git Ghost

## 日期：2026-05-08

---

## 问题：如何低成本理解 diff 语义？

### 初版方案（被 AI 否定）

**我的想法**：直接把 `git diff` 的原始输出发给 AI。

**AI 的反馈**：
> "原始 diff 太大了。一个中等规模的 PR 可能有 500 行 diff，直接发给 AI：
> 1. Token 成本高（500 行 ≈ 2000 tokens）
> 2. 噪音多（import 排序变化、formatting 变化干扰语义判断）
> 3. 超上下文风险
> 
> 建议：本地先解析 diff，只把结构化摘要发给 AI。"

---

## 改进方案：两级分析

### 第一级：本地解析（规则）

```typescript
// src/analyzer.ts
// 解析 diff，提取结构化信息

interface DiffSummary {
  files: string[];           // 改了哪些文件
  fileTypes: string[];       // .ts / .tsx / .sol / ...
  addedLines: number;
  deletedLines: number;
  keywords: string[];        // 从 diff 里提取关键词
  likelyType: 'feat' | 'fix' | 'refactor' | 'chore';
}
```

**关键词映射规则**：
```
增删行包含 "useState/useEffect"     → likelyType = 'feat' (React 新功能)
增删行包含 "console.log/debugger"   → likelyType = 'fix' (调试相关)
增删行包含 "TODO/FIXME"            → likelyType = 'chore'
增删行包含 "test/describe/it("     → likelyType = 'test'
文件是 package.json                 → likelyType = 'chore'
```

### 第二级：AI 分析（语义）

把 `DiffSummary` 发给 AI，生成 commit message。

**Prompt**：
```
基于以下 diff 摘要，生成 Conventional Commits 格式的 commit message：

文件：src/components/Button.tsx, src/hooks/useLoading.ts
文件类型：.tsx, .ts
增加行数：12
删除行数：3
关键词：loading, spinner, useState

请输出 JSON：
{
  "type": "feat",
  "scope": "ui",
  "subject": "...",
  "body": "..."
}
```

**效果**：
- Token 消耗降低 90%（从 2000 → 200）
- 输出格式稳定（JSON Mode）
- 语义准确度高

---

## 这个文档展示的能力

1. **我有成本意识** —— 知道直接发 diff 给 AI 太浪费
2. **我会系统设计** —— 两级分析（规则 + AI），不是"全部用 AI"
3. **我理解 AI 的局限** —— 知道什么时候用规则，什么时候用 AI

**这才是面试官想看到的"AI 协作能力"——不是"会用 AI API"，而是"知道怎么把 AI 用在刀刃上"。**

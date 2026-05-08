# 初始问题定义 — Git Ghost

## 日期：2026-05-08

---

## 我的初始想法

> "每次 commit 都要想 message，很烦。而且团队里大家的 commit message 格式不统一，历史记录很难看。能不能用 AI 自动生成？"

---

## 与 AI 的对话（关键问答）

### Q1：AI 怎么理解 diff 的语义？

**我的疑问**：`git diff` 输出是一堆 `+` 和 `-`，AI 真的能理解语义吗？

**AI 的回答**：
> "直接把原始 diff 喂给 AI 是浪费 token，而且大 diff 会超上下文。正确做法是：
> 1. 先本地解析 diff（提取文件路径、增删行数、关键词）
> 2. 把结构化摘要发给 AI
> 3. AI 只需要基于摘要生成 message"

**我的决策**：采纳。先做 diff 解析器，再接 AI。

---

### Q2：Conventional Commits 规范，AI 真的会遵守吗？

**我的担心**：AI 容易自由发挥，可能不遵守 `feat(ui): xxx` 格式。

**AI 的建议**：
> "用 JSON Mode（Structured Output）+ Zod 校验。让 AI 输出结构化 JSON，你再格式化成 commit message。这样格式 100% 稳定。"

**我的决策**：采纳。输出链路：
```
diff → 解析器 → 结构化摘要 → AI → JSON → 格式化 → commit message
```

---

### Q3：`gg pr` 功能有必要吗？

**我的想法**：既然能做 commit message，能不能也生成 PR 描述？

**AI 的反对**：
> "PR 描述和 commit message 是两种文体。commit message 是'做了什么'，PR 描述是'为什么做'和'怎么验证'。如果混在一起，两个都做不好。"

**我的反思**：AI 说得对。需要两套不同的 prompt。

**最终决策**：`gg scan` 和 `gg pr` 用不同的 prompt 模板。

---

## 这个文档的意义

展示：
1. **我能提出好问题** —— 不是"帮我做"，而是"这个技术难点怎么解"
2. **我听取 AI 的技术建议** —— 但不是盲从
3. **我理解产品边界** —— PR 描述和 commit message 是两种文体，不该混为一谈

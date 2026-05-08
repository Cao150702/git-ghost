# Prompt 迭代记录 — Git Ghost

## V1（失败）：直接让 AI 写 commit message

```
分析以下 diff，写一个 commit message。
```

**问题**：
- 格式不稳定（有时写英文，有时写中文）
- 长度不可控（有时一句话，有时写三段）
- 不遵守 Conventional Commits

---

## V2（改进）：加格式约束 + JSON Mode

```
分析以下 diff 摘要，输出 JSON：
{
  "type": "feat|fix|chore|refactor",
  "scope": "简短范围，如 ui, api, auth",
  "subject": "50字以内的描述",
  "body": "补充说明（可选）"
}
```

**效果**：格式稳定了，但 `scope` 经常写错（应该是 `ui` 却写成 `frontend`）。

---

## V3（改进）：加示例

```
...
示例：
输入：{ "files": ["src/components/Button.tsx"], "keywords": ["loading", "spinner"] }
输出：{ "type": "feat", "scope": "ui", "subject": "add loading state to Button" }
```

**效果**：`scope` 准确率明显提升。

---

## V4（最终版）：加"推理链隐藏模式"

```
第一步（不输出）：分析 diff 摘要，判断：
- 这是新功能还是修 bug？（看增删内容）
- 影响范围是全局还是局部？
- 有没有 breaking change？

第二步：基于以上分析，输出 JSON。
```

**效果**：AI 的"思考质量"提升，输出更准确。

---

## 关键学习

1. **JSON Mode 是必须的** —— 自由文本输出不可控
2. **示例 > 规则** —— 给一个完整示例，比写 5 条规则更有效
3. **推理链隐藏** —— 让 AI "先想再做"，但不要输出思考过程

---

## 这个文档的意义

展示 **Prompt Engineering 不是"玄学"，而是有方法论的迭代过程**。

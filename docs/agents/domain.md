# Domain Docs

工程技能在探索本仓库时如何消费领域文档。

## 探索前先读

- 根目录 **`CONTEXT.md`** —— 本仓库是 single-context，只有这一份领域术语表
- **`docs/adr/`** —— 读与当前工作区域相关的 ADR（编号 0001~0010）

若文件不存在，静默继续；不要预先建议创建。`/domain-modeling` 技能会在术语或决策真正落定时惰性创建它们。

## 文件结构（single-context）

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-monorepo-and-modular-monolith.md
│   └── …
├── product/          ← PRD 与 upgrade-spec（issue 拆解源头）
└── apps/             ← api / consumer-web / admin-web
```

## 使用术语表的词汇

输出中出现领域概念时（issue 标题、重构提案、假设、测试名），使用 `CONTEXT.md` 定义的术语，不漂移到术语表明确标注 _Avoid_ 的同义词（如：说「家庭视图」不说「家长视图/学生视图」，说「合作方」不说「渠道商个人」）。

若概念不在术语表中，这是个信号：要么你在发明项目不用的语言（重新考虑），要么存在真实缺口（记录给 `/domain-modeling`）。

## 标记 ADR 冲突

若输出与既有 ADR 矛盾，显式提出而不是静默覆盖：

> _与 ADR-0008（监护人展示总开关）冲突 —— 但值得重开，因为……_

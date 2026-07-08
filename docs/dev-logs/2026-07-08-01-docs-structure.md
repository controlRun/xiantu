# 2026-07-08 开发记录：文档目录与开发记录规范

## 目标

将开发方案写入 `docs` 路径下，并将每次开发记录按 Markdown 文件拆分保存。

## 完成内容

- 创建文档目录：

```text
docs/
```

- 创建开发方案文档：

```text
docs/development-plan.md
```

- 创建开发记录目录：

```text
docs/dev-logs/
```

- 按开发批次补充记录：

```text
docs/dev-logs/2026-07-07-01-game-outline.md
docs/dev-logs/2026-07-07-02-project-bootstrap.md
docs/dev-logs/2026-07-07-03-lan-access.md
docs/dev-logs/2026-07-08-01-docs-structure.md
```

- 创建文档索引：

```text
docs/README.md
```

## 文档规范

后续每次开发完成后，在 `docs/dev-logs/` 下新增一份记录，命名格式建议：

```text
YYYY-MM-DD-序号-主题.md
```

示例：

```text
2026-07-08-02-cultivation-system.md
```

每份开发记录建议包含：

- 目标
- 完成内容
- 涉及文件
- 验证结果
- 后续计划

## 后续

下一次功能开发完成后，继续按该规范追加新的 Markdown 开发记录。

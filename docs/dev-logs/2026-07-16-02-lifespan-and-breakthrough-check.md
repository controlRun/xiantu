# 2026-07-16 开发记录：寿元消耗与突破检查优化

## 问题

当前游戏中，修炼、炼丹、历练、秘境、宗门任务等动作不会消耗寿元，导致寿元属性没有实际压力。

同时，突破按钮在条件不足时直接禁用，虽然界面有缺失项，但玩家点击突破时无法获得一次明确的缺失项提醒。

## 完成内容

### 寿元消耗

- 新增 `src/systems/timeSystem.ts`。
- 使用天数作为行动耗时，折算到玩家年龄。
- 保持原有 `age / lifespan` 结构，不额外破坏旧存档。
- 界面新增剩余寿元显示。

当前耗时：

```text
修炼一次：7 天
静心参悟：15 天
服用聚气丹：1 天
突破成功 / 失败：30 天
外出历练：3 天
调息恢复：1 天
炼制聚气丹：3 天
炼制筑基丹：10 天
探索秘境：5 天，伏击事件额外接入战斗耗时
拜入宗门：15 天
宗门任务：7 天
宗门兑换：1 天
学习功法：10 天
```

### 突破检查优化

- 突破按钮不再因条件不足而不可点击。
- 点击突破时会先调用完整突破检查。
- 若条件不足，会集中提示所有缺失项。
- 主修炼面板新增明确的：
  - `突破条件已满足`
  - `突破缺失项`

### 界面优化

- 寿元显示支持小数年龄。
- 角色面板显示：
  - 当前年龄 / 寿元上限
  - 剩余寿元
- 突破条件提示视觉更清晰。

## 涉及文件

```text
src/App.tsx
src/styles.css
src/systems/timeSystem.ts
src/systems/cultivationSystem.ts
src/systems/battleSystem.ts
src/systems/alchemySystem.ts
src/systems/explorationSystem.ts
src/systems/sectSystem.ts
src/systems/manualSystem.ts
docs/README.md
docs/development-plan.md
```

## 验证

- `npm.cmd run build`：通过。

## 后续

后续可以继续扩展：

- 寿元耗尽后的死亡 / 轮回机制。
- 延寿丹药。
- 闭关长修，一次性消耗多年寿元换取大量修为。
- 突破前确认弹窗，明确展示成功率与消耗。

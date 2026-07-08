# 2026-07-08 开发记录：秘境探索事件系统

## 目标

继续开发下一部分，补上秘境探索雏形：

```text
秘境事件 -> 采集 / 宝箱 / 灵泉 / 伏击 / 感悟 -> 事件奖励与风险
```

## 完成内容

### 秘境事件数据

- 新增 `src/data/exploreEvents.ts`。
- 当前事件：
  - 雾中药圃
  - 封尘石匣
  - 地脉灵泉
  - 古修残念
  - 妖兽伏击
- 事件配置包含：
  - 事件类型
  - 描述
  - 最低境界阶位
  - 权重
  - 气血变化
  - 灵力变化
  - 灵石奖励
  - 修为奖励
  - 掉落表
  - 心境提升概率

### 探索系统

- 新增 `src/systems/explorationSystem.ts`。
- 支持按当前境界筛选可触发事件。
- 支持按权重随机事件。
- 支持普通事件结算：
  - 修为
  - 灵石
  - 掉落物
  - 心境
  - 气血变化
  - 灵力变化
- 支持伏击事件接入现有战斗系统。

### 界面接入

- 主操作区新增 `探索秘境` 按钮。
- 新增 `探索记录` 面板。
- 面板展示：
  - 事件
  - 类型
  - 灵石收益
  - 修为收益
  - 心境变化
  - 气血 / 灵力变化
  - 探索日志

## 涉及文件

```text
src/types/game.ts
src/data/exploreEvents.ts
src/systems/explorationSystem.ts
src/App.tsx
src/styles.css
docs/README.md
docs/development-plan.md
```

## 验证

- `npm.cmd run build`：通过。

## 后续

下一步建议进入：

```text
门派系统 -> 加入宗门 -> 宗门任务 -> 贡献点 -> 藏经阁兑换
```

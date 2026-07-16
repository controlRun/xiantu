# 2026-07-16 开发记录：功法学习与被动加成

## 目标

继续开发下一部分，补上功法系统：

```text
功法书 -> 学习功法 -> 永久被动加成 -> 宗门兑换功法
```

## 完成内容

### 功法数据

- 新增 `src/data/manuals.ts`。
- 当前功法：
  - 引气诀
  - 青云心法
  - 丹霞控火诀
  - 游身步
- 功法配置包含：
  - 对应物品 ID
  - 名称
  - 描述
  - 所属宗门
  - 被动加成

### 功法物品

- 扩展 `src/data/items.ts`。
- 新增功法书物品：
  - 青云心法
  - 丹霞控火诀
  - 游身步

### 学习系统

- 新增 `src/systems/manualSystem.ts`。
- 支持从背包中学习功法书。
- 学习后：
  - 消耗对应功法书。
  - 写入 `learnedManualIds`。
  - 永久生效。
- 重复学习会被拦截。

### 被动加成

功法加成已接入：

- 修炼收益
- 突破概率
- 炼丹成功率
- 战斗攻击
- 战斗防御

### 宗门兑换

- 宗门商店新增功法兑换：
  - 青云门：青云心法
  - 丹霞谷：丹霞控火诀
  - 散修盟：游身步

### 存档更新

- 玩家数据新增 `learnedManualIds`。
- 旧存档读取时自动补齐为空数组。

### 界面接入

- 背包内功法书显示 `学习` 按钮。
- 新增 `功法` 面板。
- 功法面板展示：
  - 已学功法数量
  - 当前总加成
  - 已学功法列表
  - 单本功法效果

## 涉及文件

```text
src/types/game.ts
src/data/items.ts
src/data/manuals.ts
src/data/sects.ts
src/data/initialPlayer.ts
src/systems/manualSystem.ts
src/systems/cultivationSystem.ts
src/systems/battleSystem.ts
src/systems/alchemySystem.ts
src/utils/saveLoad.ts
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
装备系统 -> 装备掉落 -> 装备属性 -> 强化消耗
```

# 2026-07-08 开发记录：玩家数据模型细化

## 目标

开发第 2 部分：

```text
玩家数据模型细化
补上境界表、物品背包、灵根、修为成长和突破条件
```

## 完成内容

### 玩家模型

- 将存档结构升级到 `schemaVersion = 2`。
- 玩家数据新增：
  - `realmId`
  - `spiritualRoot`
  - `cultivation.lastGain`
  - 结构化 `inventory`
- 保留寿元、气血、灵力、灵石、五项资质、门派标识等基础字段。

### 灵根系统

- 新增 `src/data/spiritualRoots.ts`。
- 支持五行灵根：
  - 金
  - 木
  - 水
  - 火
  - 土
- 支持灵根品阶：
  - 杂灵根
  - 凡品灵根
  - 真灵根
  - 地灵根
  - 天灵根
- 灵根会影响：
  - 修炼倍率
  - 突破概率修正

### 境界表

- 新增 `src/data/realms.ts`。
- 当前开放：
  - 凡人
  - 炼气一层至炼气九层
  - 筑基初期
  - 筑基中期
  - 筑基后期
- 每个境界配置：
  - 境界名称
  - 大境界
  - 排序
  - 下个境界
  - 所需修为
  - 基础突破概率
  - 心境要求
  - 灵石消耗
  - 材料消耗
  - 突破奖励

### 物品与背包

- 新增 `src/data/items.ts`。
- 新增 `src/systems/inventorySystem.ts`。
- 当前物品：
  - 灵息草
  - 低阶妖核
  - 聚气丹
  - 筑基丹
  - 引气诀
- 背包支持：
  - 物品 ID
  - 数量
  - 消耗材料
  - 判断材料是否足够
  - 格式化突破材料显示
- `聚气丹` 已可在背包中直接服用，用于提升当前修为。

### 修为成长

- 新增 `src/systems/cultivationSystem.ts`。
- 修炼收益由以下因素影响：
  - 基础收益
  - 根骨
  - 心境
  - 灵根修炼倍率
- 修炼时会自动封顶到当前境界的突破所需修为。

### 突破条件

- 突破检查包含：
  - 是否开放下个境界
  - 修为是否足够
  - 心境是否足够
  - 灵石是否足够
  - 材料是否足够
- 突破概率由以下因素影响：
  - 当前境界基础概率
  - 根骨
  - 悟性
  - 气运
  - 灵根突破修正
- 突破成功：
  - 晋升到下个境界
  - 消耗材料和灵石
  - 增加寿元、气血、灵力
  - 当前修为归零，进入新境界修炼条
- 突破失败：
  - 消耗材料和灵石
  - 损失部分修为
  - 保持当前境界

### 存档迁移

- `src/utils/saveLoad.ts` 增加旧存档迁移。
- 旧版 v1 存档读取后会补齐：
  - `realmId`
  - `spiritualRoot`
  - 新版 `cultivation`
  - 新版 `inventory`
- 继续沿用原本的本地存档键，避免浏览器已有存档完全失联。

### 界面接入

- 主界面展示：
  - 当前境界
  - 下个境界
  - 修为进度
  - 单次修炼收益
  - 突破概率
  - 突破材料
  - 缺失条件
  - 灵根与资质
  - 背包列表
- `突破` 按钮会根据条件自动启用或禁用。

## 涉及文件

```text
src/types/game.ts
src/data/initialPlayer.ts
src/data/items.ts
src/data/realms.ts
src/data/spiritualRoots.ts
src/systems/cultivationSystem.ts
src/systems/inventorySystem.ts
src/utils/saveLoad.ts
src/App.tsx
src/styles.css
```

## 验证

- `npm.cmd run build`：通过。

## 后续

下一步建议进入：

```text
丹药使用 -> 简单战斗 -> 怪物掉落 -> 修炼资源循环
```

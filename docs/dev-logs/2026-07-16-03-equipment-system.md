# 2026-07-16 开发记录：装备系统与战斗加成

## 目标

继续开发下一部分，补上装备系统雏形：

```text
装备物品 -> 掉落获得 -> 背包穿戴 -> 装备栏 -> 战斗攻防加成
```

## 完成内容

### 装备数据

- 新增 `src/data/equipment.ts`。
- 当前装备：
  - 铁木剑：武器，提升攻击。
  - 云纹法袍：法袍，提升防御。
  - 凝神玉佩：饰物，提升攻击与防御。
- 装备槽位：
  - 武器
  - 法袍
  - 饰物

### 装备物品

- 扩展 `src/data/items.ts`。
- 新增装备类物品：
  - 铁木剑
  - 云纹法袍
  - 凝神玉佩

### 掉落来源

- 扩展普通怪物掉落：
  - 山野恶狼概率掉落铁木剑。
  - 雾隐狐妖概率掉落云纹法袍。
  - 岩鳞蛇和落魄邪修概率掉落凝神玉佩。
- 扩展秘境宝箱：
  - 封尘石匣概率掉落云纹法袍。

### 穿戴系统

- 新增 `src/systems/equipmentSystem.ts`。
- 支持从背包穿戴装备。
- 穿戴后：
  - 消耗背包中的装备物品。
  - 写入对应装备槽。
  - 同槽位旧装备自动回到背包。
  - 消耗 1 天寿元。

### 战斗加成

- 战斗系统接入装备加成。
- 装备会影响：
  - 玩家战斗攻击。
  - 玩家战斗防御。

### 存档更新

- 玩家数据新增 `equipment`。
- 旧存档读取时自动补齐为空装备栏。

### 界面接入

- 背包中装备物品显示 `穿戴` 按钮。
- 新增 `装备` 面板。
- 面板展示：
  - 武器
  - 法袍
  - 饰物
  - 当前装备总攻击 / 防御加成

## 涉及文件

```text
src/types/game.ts
src/data/items.ts
src/data/equipment.ts
src/data/monsters.ts
src/data/exploreEvents.ts
src/data/initialPlayer.ts
src/systems/equipmentSystem.ts
src/systems/battleSystem.ts
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
装备强化 -> 强化等级 -> 材料消耗 -> 战斗数值成长
```

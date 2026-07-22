/**
 * 战场布局常量 —— 所有战斗组件共享的几何参数。
 * 画布加宽至 900×480，双方隔深渊对峙，站台高悬，其下为万丈深渊。
 */

export const VIEW_W = 900;
export const VIEW_H = 480;

/** 双方水平位置（距离拉开至 ~680px） */
export const PLAYER_X = 110;
export const ENEMY_X = 790;

/** 人物缩放（调小对战双方） */
export const FIGURE_SCALE = 0.72;

/** 站台顶面高度（较旧版抬高约一倍） */
export const PLATFORM_TOP_Y = 312;
export const PLATFORM_WIDTH = 112;

/** 玩家身体中心（箭矢碰撞、血条锚点） */
export const PLAYER_BODY_Y = 255;
/** 弓把位置（箭矢出发点） */
export const BOW_ORIGIN = { x: PLAYER_X + 29, y: 256 };

/** 敌方身体中心 */
export const ENEMY_BODY_Y = 247;
/** 敌方箭矢出发点 */
export const ENEMY_BOW_ORIGIN = { x: ENEMY_X - 25, y: 248 };

/** 碰撞检测：目标身上一前一后两个检测点 + 半径 */
export const PLAYER_HIT_RADIUS = 30;
export const ENEMY_HIT_RADIUS = 32;
export const HIT_SECOND_POINT_OFFSET = 34; // 第二检测点相对身体中心的垂直偏移（向上为负）

// Campaign tuning is kept here so economy and encounter rules can run without WebGL.
export const COSTS = { fence: 15, tower: 35, lantern: 10 };
export const NAMES = { fence: '木栅栏', tower: '瞭望塔', lantern: '营地灯' };
export const DAY_LENGTH = 150;
export const ENEMY_TYPES = {
  walker: { name: '游荡者', hp: 5, speed: 1.05, damage: 4, scale: 1, bounty: 2, armor: 0 },
  runner: { name: '疾行者', hp: 4, speed: 2, damage: 3, scale: .82, bounty: 3, armor: 0 },
  brute: { name: '破阵者', hp: 20, speed: .7, damage: 12, scale: 1.45, bounty: 5, armor: .6 },
  alpha: { name: '林中巨影', hp: 130, speed: .55, damage: 22, scale: 2.25, bounty: 25, armor: 1 },
};
export const WAVES = [
  { name: '林间脚步', hint: '北径来袭 · 先在房车北侧部署瞭望塔。', groups: [['walker', 10, 0, 1.5]] },
  { name: '两面夹击', hint: '北径与西径 · 疾行者速度快，营地灯能减速。', groups: [['walker', 8, 0, 1], ['runner', 8, 1, .8]] },
  { name: '沉重回响', hint: '东岸与北径 · 破阵者擅长拆墙，步枪和升级塔克制护甲。', groups: [['walker', 8, 2, 1], ['brute', 4, 0, 2], ['runner', 8, 2, .7]] },
  { name: '风暴前夕', hint: '三路袭扰 · 数量更多，信号弹能争取重新布位的时间。', groups: [['runner', 10, 1, .7], ['walker', 12, 0, .8], ['brute', 4, 2, 2]] },
  { name: '最后的长夜', hint: '北方巨影 · 集火巨影，留意两翼疾行者。守过这一夜等待救援。', groups: [['brute', 4, 0, 1.6], ['runner', 12, 1, .7], ['alpha', 1, 0, 4], ['walker', 16, 2, .7]] },
];
export const PERKS = {
  marksman: { name: '林地神射手', damageMultiplier: 1.35, currentText: '自动射击伤害 +35%。', text: '所有武器伤害 +35%，步枪更擅长突破重甲。' },
  engineer: { name: '营造专家', damageMultiplier: 1.35, currentText: '瞭望塔伤害 +35%。维修加成随维修功能开放。', text: '瞭望塔伤害 +35%，维修恢复量 +50%。' },
  scavenger: { name: '拾荒老手', logBonus: 5, currentText: '倒木每次 +5 木材；后续黎明额外 +15 木材、+3 零件（零件用途待开放）。', text: '倒木每次 +5 木材；黎明额外 +15 木材、+3 零件。' },
  survivor: { name: '余火守望', currentText: '角色生命上限 +25，立即补满。角色受伤与冲刺尚未开放，暂不增加营地耐久。', text: '最大生命 +25，冲刺恢复更快；立即补满生命。' },
};
export const WEAPONS = {
  carbine: { name: '巡林卡宾枪', range: 9, damage: 2, interval: .44, text: '均衡 · 持续射击' },
  shotgun: { name: '双管霰弹枪', range: 6, damage: 3, interval: .95, text: '近距 · 同时命中最多 3 个目标' },
  rifle: { name: '猎人步枪', range: 13, damage: 6, interval: 1.05, text: '远距 · 高单发伤害' },
};
export const EXPEDITIONS = [
  { id: 'mill', name: '旧伐木场', tag: '建设补给', time: 35, text: '沿旧林道搬回可用木料。耗时 35 秒，获得 35 木材、3 零件。', wood: 35, scrap: 3, injury: 0 },
  { id: 'clinic', name: '废弃救护站', tag: '医疗储备', time: 40, text: '绕过倒塌路障搜寻药箱。耗时 40 秒，获得 2 医疗包、5 零件。', medkits: 2, scrap: 5, injury: 0 },
  { id: 'station', name: '山脊中继站', tag: '高风险 · 科技', time: 50, text: '穿过碎石坡带回电子元件。耗时 50 秒，损失 20 生命，获得 12 零件、15 木材。', wood: 15, scrap: 12, injury: 20 },
];
export function newGame() { return { day: 1, phase: 'day', elapsed: 0, wood: 80, scrap: 8, health: 100, playerHp: 100, stamina: 100, medkits: 2, kills: 0, paused: false, over: false, won: false, weapon: 'carbine', unlocked: ['carbine'], perks: [], perkPending: false, expeditionDay: 0, flareCooldown: 0 }; }
export const maxHp = s => 100 + (s.perks.includes('survivor') ? 25 : 0);
export const active = s => !s.over && !s.paused;
export function canBuild(s, type) { return Object.hasOwn(COSTS, type) && active(s) && s.phase === 'day' && s.wood >= COSTS[type]; }
export function buy(s, type) { if (!canBuild(s, type)) return false; s.wood -= COSTS[type]; return true; }
export function advance(s, cleared = false) {
  if (!active(s) || (s.phase === 'night' && !cleared) || s.perkPending) return false;
  s.elapsed = 0;
  if (s.phase === 'day') s.phase = 'night';
  else if (s.day === WAVES.length) { s.won = true; s.over = true; }
  else { s.phase = 'day'; s.day++; s.wood += 35 + (s.perks.includes('scavenger') ? 15 : 0); s.scrap += 6 + (s.perks.includes('scavenger') ? 3 : 0); s.health = Math.min(100, s.health + 12); s.playerHp = maxHp(s); s.stamina = 100; s.flareCooldown = 0; s.perkPending = s.perks.length < Object.keys(PERKS).length; }
  return true;
}
export function damageCamp(s, amount) { if (!Number.isFinite(amount) || amount < 0 || s.over) return; s.health = Math.max(0, s.health - amount); if (!s.health) s.over = true; }
export const waveSize = day => WAVES[Math.min(WAVES.length, Math.max(1, day)) - 1].groups.reduce((n, g) => n + g[1], 0);
export function wavePlan(day) { return WAVES[day - 1].groups.flatMap(([type, count, lane, spacing], group) => Array.from({ length: count }, (_, i) => ({ type, lane, delay: i === 0 && group > 0 ? 6 : spacing }))); }
export function overlaps(x, z, objects, radius = 1) { return objects.some(o => Math.hypot(x - o.x, z - o.z) < radius + o.r); }
export const attackDamage = (s, base, tower = false) => base * (s.perks.includes(tower ? 'engineer' : 'marksman') ? PERKS[tower ? 'engineer' : 'marksman'].damageMultiplier : 1);
export const logYield = s => 10 + (s.perks.includes('scavenger') ? PERKS.scavenger.logBonus : 0);
export function choosePerk(s, id) { if (s.over || s.phase !== 'day' || !s.perkPending || !Object.hasOwn(PERKS, id) || s.perks.includes(id)) return false; s.perks.push(id); s.perkPending = false; s.playerHp = maxHp(s); return true; }
export function expedition(s, id) {
  const e = EXPEDITIONS.find(e => e.id === id);
  if (!e || !active(s) || s.phase !== 'day' || s.expeditionDay === s.day || s.elapsed + e.time >= DAY_LENGTH || s.playerHp <= e.injury) return false;
  s.elapsed += e.time; s.expeditionDay = s.day; s.wood += e.wood || 0; s.scrap += e.scrap || 0; s.medkits += e.medkits || 0; s.playerHp -= e.injury; return true;
}
export function unlockWeapon(s, id) {
  if (!active(s) || s.phase !== 'day' || !Object.hasOwn(WEAPONS, id) || s.unlocked.includes(id) || s.scrap < 10) return false;
  s.scrap -= 10; s.unlocked.push(id); s.weapon = id; return true;
}
export function heal(s) { if (!active(s) || s.medkits < 1 || s.playerHp >= maxHp(s)) return false; s.medkits--; s.playerHp = Math.min(maxHp(s), s.playerHp + 60); return true; }
export function repair(s, building = null) {
  const hp = building ? building.hp : s.health, max = building ? building.maxHp : 100;
  if (!active(s) || s.phase !== 'day' || s.wood < 10 || hp >= max) return false;
  s.wood -= 10; const amount = (building ? 90 : 30) * (s.perks.includes('engineer') ? 1.5 : 1);
  if (building) building.hp = Math.min(max, hp + amount); else s.health = Math.min(100, hp + amount); return true;
}
export function upgrade(s, b) {
  if (!active(s) || s.phase !== 'day' || b.level >= 3 || s.wood < 20 * b.level || s.scrap < 4 * b.level) return false;
  s.wood -= 20 * b.level; s.scrap -= 4 * b.level; b.level++; b.maxHp += 100; b.hp = b.maxHp; return true;
}

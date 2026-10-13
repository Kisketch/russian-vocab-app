/* 情景插画：手写内联 SVG，无外部图片依赖。
   每个词条通过 scene 字段引用一幅插画，实现「图文结合」记忆。
   统一 viewBox 0 0 240 180。 */
(function () {
  'use strict';

  var P = {
    sky: '#eaf2fb', ground: '#dfe7da', sun: '#ffcf5c',
    skin: '#f2c8a2', skin2: '#e3ad84',
    hair: '#5b4636', hair2: '#8a6a4f',
    ink: '#33415c', slate: '#7a8699', line: '#ffffff',
    blue: '#4a6fa5', blue2: '#7ea0cf', red: '#e07a5f',
    green: '#7ba58a', teal: '#4b8f8c', cream: '#f6efe3',
    wood: '#c8a165', dark: '#3d405b', gold: '#f2b441',
    pink: '#e8a0a8', purple: '#8b7ea8'
  };

  function bag(open, attrs, inner) {
    return '<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" role="img">' +
      '<rect width="240" height="180" rx="14" fill="' + (attrs.bg || P.sky) + '"/>' +
      inner + '</svg>';
  }

  function person(x, y, scale, body, hairColor, opts) {
    opts = opts || {};
    var s = scale || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      // body
      '<path d="M-22 70 C-22 40 -14 30 0 30 C14 30 22 40 22 70 Z" fill="' + body + '"/>' +
      // arms
      (opts.wave ? '<path d="M18 42 L38 18" stroke="' + P.skin2 + '" stroke-width="9" stroke-linecap="round"/>' :
        '<path d="M-18 44 L-24 66" stroke="' + P.skin2 + '" stroke-width="9" stroke-linecap="round"/>') +
      '<path d="M18 44 L26 66" stroke="' + P.skin2 + '" stroke-width="9" stroke-linecap="round"/>' +
      // head
      '<circle cx="0" cy="12" r="17" fill="' + P.skin2 + '"/>' +
      '<path d="M-17 10 C-15 -4 15 -4 17 10 C14 2 8 -1 0 -1 C-8 -1 -14 2 -17 10 Z" fill="' + (hairColor || P.hair) + '"/>' +
      '<circle cx="-6" cy="13" r="1.8" fill="' + P.dark + '"/>' +
      '<circle cx="6" cy="13" r="1.8" fill="' + P.dark + '"/>' +
      '<path d="M-4 19 Q0 23 4 19" stroke="' + P.dark + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</g>';
  }

  var scenes = {

    /* 相识问候：两个人挥手 + 对话气泡 */
    greet: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<circle cx="196" cy="42" r="26" fill="' + P.sun + '" opacity=".55"/>' +
      '<rect x="0" y="132" width="240" height="48" rx="14" fill="' + P.ground + '"/>' +
      '<path d="M28 96 h58 a10 10 0 0 1 10 10 v14 a10 10 0 0 1 -10 10 h-44 l-12 12 v-12 h-2 a10 10 0 0 1 -10 -10 v-14 a10 10 0 0 1 10 -10 z" fill="#fff"/>' +
      '<g fill="' + P.blue + '">' +
      '<circle cx="42" cy="111" r="3"/><circle cx="57" cy="111" r="3"/><circle cx="72" cy="111" r="3"/></g>' +
      person(72, 44, 0.92, P.blue, P.hair, { wave: true }) +
      person(160, 44, 0.92, P.red, P.hair2) +
      '<g class="rv-float"><path d="M196 156 l0 -10" stroke="' + P.dark + '" stroke-width="2"/></g>',

    /* 人物形象：半身肖像 */
    person: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<circle cx="120" cy="150" r="86" fill="' + P.blue2 + '" opacity=".28"/>' +
      '<path d="M58 180 C58 138 82 118 120 118 C158 118 182 138 182 180 Z" fill="' + P.teal + '"/>' +
      '<rect x="112" y="118" width="16" height="26" fill="' + P.skin + '"/>' +
      '<circle cx="120" cy="86" r="38" fill="' + P.skin2 + '"/>' +
      '<path d="M82 80 C84 50 156 50 158 80 C150 62 138 56 120 56 C102 56 90 62 82 80 Z" fill="' + P.hair + '"/>' +
      '<circle cx="106" cy="86" r="3.4" fill="' + P.dark + '"/>' +
      '<circle cx="134" cy="86" r="3.4" fill="' + P.dark + '"/>' +
      '<path d="M108 104 Q120 114 132 104" stroke="' + P.dark + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>',

    /* 家庭：三口人 */
    family: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<rect x="0" y="140" width="240" height="40" rx="14" fill="' + P.green + '" opacity=".5"/>' +
      person(58, 40, 0.72, P.red, P.hair) +
      person(120, 34, 0.86, P.blue, P.hair2) +
      person(184, 48, 0.6, P.gold, P.hair),

    /* 大学：带柱子的教学楼 */
    university: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<rect x="0" y="146" width="240" height="34" rx="14" fill="' + P.ground + '"/>' +
      '<rect x="40" y="112" width="160" height="40" fill="' + P.cream + '"/>' +
      '<path d="M28 114 L120 74 L212 114 Z" fill="' + P.teal + '"/>' +
      '<path d="M120 74 l0 -16" stroke="' + P.dark + '" stroke-width="2"/>' +
      '<path d="M120 58 l26 6 l-26 6 z" fill="' + P.red + '"/>' +
      '<g fill="' + P.slate + '">' +
      '<rect x="52" y="118" width="14" height="34" rx="2"/><rect x="76" y="118" width="14" height="34" rx="2"/>' +
      '<rect x="100" y="118" width="14" height="34" rx="2"/><rect x="124" y="118" width="14" height="34" rx="2"/>' +
      '<rect x="148" y="118" width="14" height="34" rx="2"/><rect x="172" y="118" width="14" height="34" rx="2"/></g>' +
      '<rect x="104" y="130" width="32" height="22" rx="3" fill="' + P.wood + '"/>',

    /* 书籍：翻开的课本 */
    book: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<g transform="translate(120 104)">' +
      '<path d="M-84 26 L-4 8 L-4 -22 L-84 -4 Z" fill="#ffffff"/>' +
      '<path d="M84 26 L4 8 L4 -22 L84 -4 Z" fill="#ffffff"/>' +
      '<path d="M-84 26 L-4 8 L4 8 L84 26 L84 36 L-4 18 L-84 36 Z" fill="' + P.slate + '" opacity=".35"/>' +
      '<g stroke="' + P.slate + '" stroke-width="2.4" opacity=".7">' +
      '<path d="M-70 4 L-18 8"/><path d="M-70 14 L-30 17"/><path d="M-66 24 L-24 27"/>' +
      '<path d="M70 4 L18 8"/><path d="M70 14 L30 17"/><path d="M66 24 L24 27"/></g>' +
      '</g>' +
      '<g class="rv-float"><path d="M120 40 l6 -12 l6 12 l6 -10 l0 16 l-24 0 z" fill="' + P.red + '" opacity=".9"/></g>',

    /* 工作：办公桌 + 电脑 */
    work: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<rect x="0" y="140" width="240" height="40" rx="14" fill="' + P.wood + '"/>' +
      '<rect x="26" y="96" width="188" height="10" rx="3" fill="' + P.slate + '"/>' +
      '<rect x="80" y="46" width="80" height="52" rx="4" fill="' + P.dark + '"/>' +
      '<rect x="88" y="54" width="64" height="38" rx="2" fill="' + P.blue2 + '"/>' +
      '<rect x="112" y="98" width="16" height="6" rx="2" fill="' + P.dark + '"/>' +
      '<rect x="86" y="104" width="68" height="8" rx="4" fill="' + P.slate + '"/>' +
      '<g><rect x="186" y="104" width="26" height="34" rx="4" fill="#ffffff"/>' +
      '<path d="M186 114 h26" stroke="' + P.red + '" stroke-width="4"/>' +
      '<g opacity=".6"><path d="M196 96 q4 -10 0 -16" stroke="' + P.slate + '" stroke-width="2" fill="none"/></g></g>' +
      '<circle cx="54" cy="122" r="12" fill="#ffffff"/><circle cx="54" cy="122" r="8" fill="' + P.wood + '"/>',

    /* 医疗健康：十字与药片 */
    health: '<rect width="240" height="180" rx="14" fill="#fdf1f0"/>' +
      '<circle cx="90" cy="90" r="58" fill="#ffffff"/>' +
      '<path d="M74 46 h32 v30 h30 v32 h-30 v30 h-32 v-30 h-30 v-32 h30 z" fill="' + P.red + '"/>' +
      '<g transform="translate(150 112) rotate(-38)">' +
      '<rect x="-30" y="-14" width="60" height="28" rx="14" fill="' + P.blue + '"/>' +
      '<path d="M0 -14 v28" stroke="#fff" stroke-width="4"/>' +
      '<path d="M-30 0 h22" stroke="#fff" stroke-width="0" />' +
      '<rect x="-30" y="-14" width="30" height="28" rx="14" fill="#ffffff" opacity=".45"/></g>' +
      '<g fill="' + P.teal + '" opacity=".5"><circle cx="196" cy="44" r="7"/><circle cx="212" cy="66" r="4"/></g>',

    /* 住宅：带烟囱的房子 */
    house: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<rect x="0" y="140" width="240" height="40" rx="14" fill="' + P.green + '"/>' +
      '<rect x="52" y="76" width="136" height="66" fill="' + P.cream + '"/>' +
      '<path d="M40 78 L120 30 L200 78 Z" fill="' + P.red + '"/>' +
      '<rect x="158" y="40" width="16" height="30" fill="' + P.slate + '"/>' +
      '<g class="rv-float" opacity=".55"><circle cx="166" cy="26" r="8" fill="#fff"/><circle cx="176" cy="18" r="6" fill="#fff"/></g>' +
      '<rect x="76" y="96" width="34" height="30" rx="3" fill="' + P.blue2 + '"/>' +
      '<path d="M93 96 v30 M76 111 h34" stroke="#fff" stroke-width="2.5"/>' +
      '<rect x="132" y="98" width="34" height="44" rx="3" fill="' + P.wood + '"/>' +
      '<circle cx="140" cy="120" r="2.6" fill="' + P.dark + '"/>',

    /* 城市：天际线 */
    city: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<g fill="' + P.slate + '" opacity=".85">' +
      '<rect x="18" y="72" width="34" height="80" rx="3"/>' +
      '<rect x="58" y="46" width="40" height="106" rx="3"/>' +
      '<rect x="104" y="88" width="30" height="64" rx="3"/>' +
      '<rect x="140" y="58" width="36" height="94" rx="3"/>' +
      '<rect x="182" y="80" width="40" height="72" rx="3"/></g>' +
      '<g fill="' + P.gold + '" opacity=".9">' +
      '<rect x="26" y="84" width="7" height="9"/><rect x="38" y="84" width="7" height="9"/>' +
      '<rect x="26" y="104" width="7" height="9"/><rect x="38" y="104" width="7" height="9"/>' +
      '<rect x="66" y="58" width="8" height="10"/><rect x="80" y="58" width="8" height="10"/>' +
      '<rect x="66" y="84" width="8" height="10"/><rect x="80" y="110" width="8" height="10"/>' +
      '<rect x="148" y="70" width="8" height="10"/><rect x="162" y="70" width="8" height="10"/>' +
      '<rect x="148" y="98" width="8" height="10"/><rect x="190" y="94" width="8" height="10"/>' +
      '<rect x="204" y="94" width="8" height="10"/></g>' +
      '<rect x="0" y="152" width="240" height="28" rx="14" fill="' + P.dark + '" opacity=".8"/>' +
      '<g stroke="#fff" stroke-width="3" opacity=".8"><path d="M20 166 h24"/><path d="M60 166 h24"/><path d="M100 166 h24"/><path d="M140 166 h24"/><path d="M180 166 h24"/></g>',

    /* 公交/电车 */
    transport: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<rect x="0" y="140" width="240" height="40" rx="14" fill="' + P.dark + '" opacity=".85"/>' +
      '<rect x="30" y="60" width="176" height="76" rx="12" fill="' + P.blue + '"/>' +
      '<rect x="42" y="72" width="42" height="30" rx="4" fill="' + P.blue2 + '"/>' +
      '<rect x="94" y="72" width="42" height="30" rx="4" fill="' + P.blue2 + '"/>' +
      '<rect x="146" y="72" width="46" height="30" rx="4" fill="' + P.blue2 + '"/>' +
      '<rect x="42" y="112" width="26" height="14" rx="3" fill="' + P.gold + '" opacity=".9"/>' +
      '<circle cx="86" cy="136" r="14" fill="' + P.dark + '"/><circle cx="86" cy="136" r="6" fill="' + P.slate + '"/>' +
      '<circle cx="168" cy="136" r="14" fill="' + P.dark + '"/><circle cx="168" cy="136" r="6" fill="' + P.slate + '"/>' +
      '<path d="M206 60 l0 24 l16 -10 z" fill="' + P.gold + '"/>',

    /* 旅行：飞机与行李箱 */
    travel: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<g fill="#fff" opacity=".85"><circle cx="40" cy="36" r="12"/><circle cx="56" cy="30" r="16"/><circle cx="72" cy="38" r="10"/></g>' +
      '<g class="rv-float" transform="translate(120 62)">' +
      '<path d="M0 0 L58 22 L58 32 L0 20 Z" fill="#ffffff"/>' +
      '<path d="M0 20 L58 32 L58 40 L0 28 Z" fill="' + P.slate + '" opacity=".6"/>' +
      '<path d="M-6 4 L4 6 L4 22 L-6 22 Z" fill="' + P.blue + '"/>' +
      '<circle cx="46" cy="30" r="5" fill="' + P.blue + '"/></g>' +
      '<g transform="translate(96 118)">' +
      '<rect x="-34" y="0" width="68" height="46" rx="8" fill="' + P.red + '"/>' +
      '<rect x="-6" y="-10" width="12" height="14" rx="4" fill="none" stroke="' + P.dark + '" stroke-width="4"/>' +
      '<rect x="-2" y="0" width="76" height="0" />' +
      '<path d="M-34 22 h68" stroke="' + P.cream + '" stroke-width="5"/>' +
      '<path d="M0 22 v24" stroke="' + P.cream + '" stroke-width="5"/>' +
      '<circle cx="-16" cy="44" r="5" fill="' + P.dark + '"/><circle cx="16" cy="44" r="5" fill="' + P.dark + '"/></g>',

    /* 餐饮：汤碗、面包与餐具 */
    food: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<ellipse cx="120" cy="150" rx="94" ry="14" fill="' + P.wood + '" opacity=".25"/>' +
      '<path d="M46 92 C46 132 80 140 120 140 C160 140 194 132 194 92 Z" fill="#ffffff"/>' +
      '<ellipse cx="120" cy="92" rx="74" ry="20" fill="' + P.green + '" opacity=".35"/>' +
      '<ellipse cx="120" cy="92" rx="74" ry="20" fill="none" stroke="' + P.teal + '" stroke-width="3"/>' +
      '<g opacity=".7"><circle cx="98" cy="90" r="4" fill="' + P.green + '"/><circle cx="126" cy="96" r="5" fill="' + P.green + '"/><circle cx="146" cy="88" r="3.5" fill="' + P.green + '"/></g>' +
      '<g transform="translate(190 76) rotate(18)">' +
      '<rect x="-4" y="0" width="8" height="52" rx="4" fill="' + P.slate + '"/>' +
      '<path d="M-10 0 q10 -22 20 0 z" fill="' + P.slate + '"/></g>' +
      '<path d="M34 60 q26 -18 52 0 q-26 22 -52 0 z" fill="' + P.gold + '" opacity=".85"/>',

    /* 时间：时钟 */
    clock: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<circle cx="120" cy="90" r="64" fill="#ffffff" stroke="' + P.dark + '" stroke-width="8"/>' +
      '<g stroke="' + P.slate + '" stroke-width="3" stroke-linecap="round">' +
      '<path d="M120 38 v8"/><path d="M172 90 h-8"/><path d="M120 142 v-8"/><path d="M68 90 h8"/></g>' +
      '<path d="M120 90 L120 52" stroke="' + P.dark + '" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M120 90 L152 108" stroke="' + P.red + '" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="120" cy="90" r="6" fill="' + P.dark + '"/>',

    /* 购物：临街店铺 */
    shop: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<rect x="0" y="146" width="240" height="34" rx="14" fill="' + P.ground + '"/>' +
      '<rect x="36" y="52" width="168" height="98" rx="6" fill="' + P.cream + '"/>' +
      '<path d="M24 60 L120 26 L216 60 Z" fill="' + P.teal + '"/>' +
      '<rect x="28" y="60" width="184" height="22" rx="6" fill="' + P.teal + '"/>' +
      '<g fill="' + P.cream + '"><rect x="44" y="66" width="18" height="10" rx="3"/><rect x="76" y="66" width="18" height="10" rx="3"/><rect x="108" y="66" width="18" height="10" rx="3"/><rect x="140" y="66" width="18" height="10" rx="3"/><rect x="172" y="66" width="18" height="10" rx="3"/></g>' +
      '<rect x="76" y="96" width="88" height="54" rx="4" fill="' + P.blue2 + '"/>' +
      '<path d="M120 96 v54" stroke="' + P.cream + '" stroke-width="3"/>' +
      '<rect x="104" y="112" width="32" height="10" rx="5" fill="' + P.gold + '"/>' +
      '<rect x="60" y="104" width="12" height="46" rx="3" fill="' + P.red + '" opacity=".8"/>',

    /* 天气：太阳、云与雨 */
    weather: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<circle cx="72" cy="56" r="26" fill="' + P.sun + '"/>' +
      '<g stroke="' + P.sun + '" stroke-width="4" stroke-linecap="round" opacity=".8">' +
      '<path d="M72 16 v-8"/><path d="M112 56 h8"/><path d="M96 26 l6 -6"/><path d="M48 26 l-6 -6"/></g>' +
      '<g transform="translate(120 84)">' +
      '<path d="M-46 22 a22 22 0 0 1 4 -43 a28 28 0 0 1 52 -8 a20 20 0 0 1 8 51 z" fill="#ffffff"/>' +
      '<path d="M-30 40 a18 18 0 0 1 6 -35 a22 22 0 0 1 41 -6 a16 16 0 0 1 6 41 z" fill="' + P.slate + '" opacity=".25"/></g>' +
      '<g fill="' + P.blue2 + '">' +
      '<path d="M96 118 l-6 20 l6 0 l-6 20 z" opacity=".8" transform="translate(0 0)"/>' +
      '<rect x="110" y="122" width="5" height="18" rx="2.5" transform="rotate(12 112 130)"/>' +
      '<rect x="132" y="126" width="5" height="18" rx="2.5" transform="rotate(12 134 134)"/>' +
      '<rect x="154" y="122" width="5" height="18" rx="2.5" transform="rotate(12 156 130)"/></g>',

    /* 自然：树木与山丘 */
    nature: '<rect width="240" height="180" rx="14" fill="' + P.sky + '"/>' +
      '<circle cx="192" cy="44" r="24" fill="' + P.sun + '" opacity=".8"/>' +
      '<path d="M0 150 q60 -46 120 -14 q60 -32 120 14 v30 h-240 z" fill="' + P.green + '" opacity=".65"/>' +
      '<rect x="104" y="92" width="14" height="60" rx="4" fill="' + P.wood + '"/>' +
      '<g class="rv-float">' +
      '<circle cx="111" cy="86" r="34" fill="' + P.teal + '"/>' +
      '<circle cx="82" cy="98" r="24" fill="' + P.teal + '" opacity=".85"/>' +
      '<circle cx="140" cy="96" r="26" fill="' + P.teal + '" opacity=".85"/></g>' +
      '<rect x="0" y="150" width="240" height="30" rx="14" fill="' + P.green + '"/>',

    /* 通讯：手机与信封 */
    contact: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<g transform="translate(78 96)">' +
      '<rect x="-34" y="-62" width="68" height="112" rx="12" fill="' + P.dark + '"/>' +
      '<rect x="-28" y="-54" width="56" height="94" rx="6" fill="' + P.blue2 + '"/>' +
      '<g fill="#ffffff" opacity=".9"><rect x="-18" y="-40" width="34" height="6" rx="3"/><rect x="-18" y="-26" width="24" height="6" rx="3"/><rect x="-18" y="-12" width="30" height="6" rx="3"/><rect x="-18" y="2" width="20" height="6" rx="3"/></g>' +
      '<rect x="-10" y="20" width="20" height="6" rx="3" fill="' + P.teal + '"/></g>' +
      '<g transform="translate(158 62) rotate(10)">' +
      '<rect x="-44" y="-28" width="88" height="56" rx="6" fill="#ffffff" stroke="' + P.slate + '" stroke-width="3"/>' +
      '<path d="M-44 -28 L0 6 L44 -28" fill="none" stroke="' + P.slate + '" stroke-width="3"/>' +
      '<circle cx="30" cy="-14" r="9" fill="' + P.red + '"/></g>',

    /* 文化艺术：舞台幕布与音符 */
    culture: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<path d="M0 26 h240 v-26 h-240 z" fill="' + P.dark + '" opacity=".85"/>' +
      '<path d="M28 26 C28 66 58 60 58 26 Z" fill="' + P.red + '"/>' +
      '<path d="M212 26 C212 66 182 60 182 26 Z" fill="' + P.red + '"/>' +
      '<rect x="0" y="26" width="240" height="12" rx="4" fill="' + P.gold + '"/>' +
      '<rect x="46" y="42" width="148" height="106" rx="4" fill="#ffffff" opacity=".9"/>' +
      '<circle cx="96" cy="88" r="16" fill="' + P.cream + '" stroke="' + P.dark + '" stroke-width="3"/>' +
      '<path d="M110 88 L110 44 L146 38 L146 48 L118 54 L118 88 Z" fill="' + P.dark + '"/>' +
      '<circle cx="92" cy="96" r="10" fill="' + P.dark + '"/><circle cx="112" cy="92" r="10" fill="' + P.dark + '"/>' +
      '<rect x="0" y="148" width="240" height="32" rx="14" fill="' + P.teal + '" opacity=".7"/>',

    /* 礼物：礼盒 */
    gift: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<g transform="translate(120 96)">' +
      '<rect x="-56" y="-24" width="112" height="72" rx="8" fill="' + P.red + '"/>' +
      '<rect x="-64" y="-40" width="128" height="20" rx="6" fill="' + P.pink + '"/>' +
      '<rect x="-12" y="-40" width="24" height="72" fill="' + P.gold + '"/>' +
      '<path d="M0 -40 C-24 -40 -34 -70 -14 -66 C-2 -64 -2 -52 0 -44 Z" fill="' + P.gold + '"/>' +
      '<path d="M0 -40 C24 -40 34 -70 14 -66 C2 -64 2 -52 0 -44 Z" fill="' + P.gold + '"/></g>' +
      '<g opacity=".6"><circle cx="34" cy="44" r="5" fill="' + P.purple + '"/><circle cx="206" cy="58" r="7" fill="' + P.teal + '"/><circle cx="196" cy="140" r="5" fill="' + P.gold + '"/><circle cx="44" cy="136" r="6" fill="' + P.blue + '"/></g>',

    /* 节日：烟花与彩纸 */
    holiday: '<rect width="240" height="180" rx="14" fill="' + P.dark + '"/>' +
      '<g stroke="' + P.gold + '" stroke-width="3" stroke-linecap="round" opacity=".9">' +
      '<g transform="translate(80 62)"><path d="M0 0 v-26"/><path d="M0 0 l18 -18"/><path d="M0 0 l26 0"/><path d="M0 0 l18 18"/><path d="M0 0 l-18 18"/><path d="M0 0 l-26 0"/><path d="M0 0 l-18 -18"/><path d="M0 0 v26"/></g>' +
      '<g transform="translate(170 44) scale(0.7)" stroke="' + P.pink + '"><path d="M0 0 v-26"/><path d="M0 0 l18 -18"/><path d="M0 0 l26 0"/><path d="M0 0 l18 18"/><path d="M0 0 l-18 18"/><path d="M0 0 l-26 0"/><path d="M0 0 l-18 -18"/></g></g>' +
      '<g fill="' + P.sun + '" opacity=".9"><circle cx="122" cy="96" r="4"/><circle cx="140" cy="86" r="3"/><circle cx="106" cy="106" r="3"/></g>' +
      '<g><rect x="30" y="140" width="180" height="26" rx="6" fill="' + P.cream + '" opacity=".15"/></g>' +
      '<g><rect x="70" y="120" width="100" height="20" rx="4" fill="' + P.teal + '"/>' +
      '<path d="M100 120 q20 -18 40 0" fill="none" stroke="' + P.cream + '" stroke-width="4"/>' +
      '<path d="M120 108 l0 -22" stroke="' + P.red + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M120 86 l8 10 l-8 6 l-8 -6 z" fill="' + P.sun + '"/></g>',

    generic: '<rect width="240" height="180" rx="14" fill="' + P.cream + '"/>' +
      '<circle cx="120" cy="90" r="52" fill="#ffffff" stroke="' + P.slate + '" stroke-width="4"/>' +
      '<path d="M96 90 h48 M96 106 h30" stroke="' + P.slate + '" stroke-width="5" stroke-linecap="round"/>'
  };

  var cache = {};

  window.RVScenes = {
    get: function (key) {
      if (!key || !scenes[key]) key = 'generic';
      if (!cache[key]) cache[key] = bag(true, {}, scenes[key]);
      return cache[key];
    },
    keys: function () { return Object.keys(scenes); }
  };
})();

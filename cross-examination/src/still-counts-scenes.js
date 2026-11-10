// Original SVG scenes for Still Counts. Artwork is local and deterministic.
// Paired cases share geometry: only the detail named in the case is changed.
const C = { ink: '#202024', blue: '#4761E8', orange: '#F56B38', paper: '#FFF9EE',
  pale: '#EBE5D9', yellow: '#F6DC7A', bread: '#E9B26D', crust: '#AE693E',
  pink: '#E9A2AE', green: '#9DAF83', meat: '#95533C', white: '#FFFFFF' };
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill, r = 8, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, extra = '') => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${extra}/>`;
const circle = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const text = (x, y, value, size = 12, color = C.ink, extra = '') => `<text x="${x}" y="${y}" fill="${color}" stroke="none" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="800" text-anchor="middle" ${extra}>${value}</text>`;
const badge = (x, y, value, fill = C.yellow, w = 100) => `<g transform="translate(${x} ${y})">${rect(-w / 2, -14, w, 28, fill, 4)}${text(0, 5, value, 11)}</g>`;
const heart = (x, y, s = 1, fill = C.orange) => `<g transform="translate(${x} ${y}) scale(${s})">${path('M0 9C-24-6-16-24-5-17L0-12 5-17C16-24 24-6 0 9Z', fill)}</g>`;
const tick = (x, y, s = 1, color = C.blue) => `<g transform="translate(${x} ${y}) scale(${s})" stroke="${color}" stroke-width="4">${path('M-7 0-1 6 10-8')}</g>`;
const spark = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" stroke="${C.orange}" stroke-width="2.5">${line(-8, 0, 8, 0)}${line(0, -8, 0, 8)}</g>`;
const ground = () => `<ellipse cx="240" cy="231" rx="160" ry="13" fill="${C.ink}" opacity=".07" stroke="none"/>`;
const plate = () => `<ellipse cx="240" cy="219" rx="151" ry="24" fill="${C.paper}"/><ellipse cx="240" cy="215" rx="128" ry="13" fill="${C.pale}" stroke="none"/>`;
const group = (content, transform = '') => `<g${transform ? ` transform="${transform}"` : ''}>${content}</g>`;

function breadLayer(y, { toasted = false, cookie = false } = {}) {
  if (cookie) return `${rect(147, y, 186, 31, C.crust, 16)}${rect(147, y - 8, 186, 28, C.bread, 15)}${[166, 196, 227, 259, 294, 317].map((x, i) => circle(x, y + (i % 2 ? 6 : 0), 3.6, C.meat, 'stroke="none"')).join('')}`;
  return `${path(`M154 ${y + 24}Q136 ${y + 4}155 ${y - 9}Q181 ${y - 25}240 ${y - 25}Q299 ${y - 25}325 ${y - 9}Q344 ${y + 4}326 ${y + 24}Z`, toasted ? C.crust : C.bread)}${path(`M161 ${y + 14}Q148 ${y + 1}163 ${y - 6}Q190 ${y - 18}240 ${y - 18}Q290 ${y - 18}317 ${y - 6}Q332 ${y + 1}319 ${y + 14}Z`, toasted ? '#BC8050' : C.paper, 'stroke-width="2"')}`;
}

function burger(sausage = false) {
  return `${plate()}${rect(132, 176, 216, 32, C.bread, 14)}${path('M132 172Q150 156 169 169L190 157 213 171 238 158 260 172 282 156 307 170 330 160 348 174V184H132Z', C.green)}${sausage ? rect(123, 142, 234, 31, C.orange, 16) + line(145, 150, 334, 150, 'stroke="#D3482D" stroke-width="3"') : rect(128, 142, 224, 36, C.meat, 16)}${path('M127 137H354L323 159 280 145 243 161 200 146 164 157Z', C.yellow)}${path('M135 128C135 42 344 42 344 128Z', C.bread)}${path('M154 111Q238 54 323 110', 'none', 'stroke="#F6D2A4" stroke-width="5"')}${[[180, 91], [216, 77], [256, 82], [291, 98], [232, 106]].map(([x, y]) => line(x, y, x + 6, y - 3, 'stroke="#FFF2CE" stroke-width="4"')).join('')}`;
}

function hotdog(mode) {
  const cut = mode !== 'joined', gap = mode === 'cut' ? 12 : 0;
  return `${plate()}<g class="hotdog ${cut ? 'bun-is-cut' : 'bun-is-joined'}">${path('M126 149C107 107 142 82 191 87L321 117C365 128 370 161 340 177L185 182Z', C.bread)}${path('M139 138C124 121 146 104 177 111L324 145C345 150 346 168 324 172L173 165Z', C.crust, 'stroke-width="2"')}${rect(139, 113, 207, 37, C.orange, 19, 'transform="rotate(12 240 140)"')}${path('M159 120L179 137 201 130 221 146 243 138 264 154 288 147 309 161', 'none', 'stroke="#F6DC7A" stroke-width="7"')}${group(path('M122 147Q155 134 184 148L329 178Q351 184 343 200Q333 218 303 212L152 183Q119 177 122 147Z', C.bread) + path('M140 159L316 195', 'none', 'stroke="#F4CF9B" stroke-width="5"'), `translate(0 ${gap})`)}${cut ? path(`M128 ${148 + gap}L168 ${156 + gap}`, 'none', 'stroke="#FFF9EE" stroke-width="7"') + line(127, 146 + gap, 168, 154 + gap, 'stroke-width="2" stroke-dasharray="3 4"') : path('M126 149Q113 165 138 176', 'none', 'stroke="#AE693E" stroke-width="5"')}</g>${badge(348, 69, mode === 'joined' ? 'JOINED' : mode === 'cut' ? 'CUT APART' : 'STILL CUT', C.paper, 94)}`;
}

function sweetSandwich({ bread = false, jam = false } = {}) {
  return `${plate()}${breadLayer(179, { cookie: !bread })}${rect(149, 132, 182, 48, jam ? '#B95167' : C.paper, 7)}${jam ? path('M161 145Q190 137 216 148T271 144 319 149', 'none', 'stroke="#E29CB0" stroke-width="6"') : path('M159 147Q185 137 204 148T250 146 291 148 321 145', 'none', 'stroke="#D6C4D8" stroke-width="5"')}${breadLayer(126, { cookie: !bread })}`;
}

function cheeseSandwich(rotate = false, toast = false) {
  const item = `${breadLayer(173)}${toast ? breadLayer(142, { toasted: true }) : path('M145 142H335L314 172 284 159 251 177 215 159 181 169Z', C.yellow)}${breadLayer(toast ? 112 : 121)}`;
  return `${plate()}<g class="cheese-sandwich ${rotate ? 'is-rotated' : ''}" transform="rotate(${rotate ? 90 : 0} 240 142)">${item}</g>`;
}

function lasagna() {
  return `${plate()}${path('M145 111L258 76 343 115 231 152Z', C.yellow)}${path('M145 111L231 152V218L145 174Z', C.crust)}${path('M231 152L343 115V179L231 218Z', '#D89D55')}${[141, 163, 185].map(y => `${path(`M147 ${y}L231 ${y + 40}L340 ${y + 4}`, 'none', 'stroke="#F6DC7A" stroke-width="10"')}${path(`M147 ${y - 9}L231 ${y + 31}L340 ${y - 5}`, 'none', 'stroke="#B34E32" stroke-width="9"')}`).join('')}${path('M145 111L258 76 343 115 231 152Z', '#F3C16C')}${[ [186, 113], [247, 109], [283, 115], [231, 130] ].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="6" fill="${C.orange}" stroke="none"/>`).join('')}${path('M205 99L218 105M272 93L282 99M298 124L308 128', 'none', 'stroke="#71865F" stroke-width="4"')}`;
}

function laptop(inner = '', { screen = '#E8ECFD' } = {}) {
  return `${rect(111, 57, 258, 153, C.paper, 12)}${rect(124, 70, 232, 124, screen, 5)}${circle(240, 64, 2, C.ink, 'stroke="none"')}${inner}${path('M111 210H369L393 228Q391 236 378 237H102Q89 236 87 228Z', C.pale)}${path('M209 211H271L279 221H201Z', C.paper, 'stroke-width="2"')}`;
}

function invoice(label = 'PAID', x = 325, y = 148) {
  return group(`${path('M-34-47H34V46L23 40 12 46 0 40-12 46-23 40-34 46Z', C.paper)}${text(0, -25, label, 12)}${line(-20, -10, 20, -10, 'stroke-width="2"')}${line(-20, 2, 9, 2, 'stroke-width="2"')}${line(-20, 14, 15, 14, 'stroke-width="2"')}${text(0, 33, '$', 20, C.orange)}`, `translate(${x} ${y}) rotate(9)`);
}

function video(paid = false, custom = false) {
  return `${ground()}${laptop(`${circle(240, 128, 31, C.blue)}${path('M233 111L255 128 233 145Z', C.white, 'stroke="none"')}${text(240, 178, custom ? 'MADE FOR YOU' : 'PRERECORDED', 10, '#59618A')}`)}${badge(160, 54, custom ? 'CUSTOM' : paid ? 'PAID' : 'FREE', C.yellow, 95)}${paid || custom ? invoice(custom ? 'ORDER' : 'PAID') : ''}`;
}

function person(x, y, color = C.blue, scale = 1, variant = false) {
  return group(`${path('M-26 51Q-27 15 0 15Q27 15 26 51Z', color)}${circle(0, -3, 19, C.paper)}${path(variant ? 'M-19-7Q-21-31 0-27Q23-28 20-4L13-14Q-3-7-16-14Z' : 'M-18-11Q-15-29 4-25Q24-23 20-5L9-13Q-6-6-18-11Z', C.ink)}`, `translate(${x} ${y}) scale(${scale})`);
}

function chat(hidden = false, agreed = false) {
  const screen = `${person(162, 110, C.blue, .75)}${person(314, 110, C.orange, .75, true)}${rect(177, 98, 126, 34, C.white, 9)}${text(240, 119, 'OAT MILK?', 11)}${rect(187, 143, 110, 29, C.yellow, 8)}${text(242, 162, 'AISLE FOUR.', 10)}`;
  return `${ground()}${laptop(screen)}${badge(148, 57, 'FRIENDLY', C.paper, 95)}${hidden ? `${group(path('M-85-34H-22L-9-21H86V56H-85Z', C.orange) + path('M-85-16H86L72 56H-85Z', '#F58E68'), 'translate(240 155)')}${text(240, 183, 'PRIVATE THREAD', 12)}` : `${badge(240, 202, 'PARTNER CAN READ', C.yellow, 160)}`}${agreed ? group(`${rect(-59, -27, 118, 54, C.paper, 4)}${text(0, -8, 'AGREED', 12)}${tick(0, 10, .9)}`, 'translate(340 78) rotate(9)') : ''}`;
}

function dating(deleted = false) {
  return `${ground()}${rect(160, 33, 160, 207, C.ink, 20)}${rect(170, 47, 140, 178, C.paper, 11)}${deleted ? `${rect(188, 75, 104, 92, C.pale, 8)}${line(200, 88, 280, 154, 'stroke="#A8A298" stroke-width="3"')}${line(280, 88, 200, 154, 'stroke="#A8A298" stroke-width="3"')}` : `${rect(188, 75, 104, 92, '#DFE4FF', 8)}${person(240, 115, C.blue, .8)}`}${badge(240, 54, deleted ? 'DELETED' : 'ACTIVE', deleted ? C.pale : C.yellow, 100)}${text(240, 191, '0 MESSAGES', 12)}${text(240, 211, '0 MEETINGS', 10, '#6E6A65')}`;
}

function flirt() {
  return `${ground()}${person(151, 116, C.blue, 1.2)}${person(324, 116, C.orange, 1.2, true)}${rect(87, 191, 306, 18, C.crust, 5)}${line(109, 211, 109, 238)}${line(372, 211, 372, 238)}${path('M219 140H261L253 183H227Z', C.yellow)}${line(233, 133, 247, 170, 'stroke="#FFF9EE"')}${heart(237, 91, .8)}${badge(327, 59, '$0', C.paper, 65)}${line(308, 49, 345, 67, 'stroke="#F56B38" stroke-width="3"')}`;
}

function robot(x = 240, y = 124, s = 1) {
  return group(`${rect(-35, -25, 70, 52, C.paper, 10)}${line(0, -25, 0, -37)}${circle(0, -41, 5, C.orange)}${circle(-13, -3, 5, C.blue, 'stroke="none"')}${circle(13, -3, 5, C.blue, 'stroke="none"')}${line(-11, 13, 11, 13, 'stroke-width="2"')}${rect(-45, -9, 10, 20, C.pale, 3)}${rect(35, -9, 10, 20, C.pale, 3)}`, `translate(${x} ${y}) scale(${s})`);
}

function aiRomance() {
  return `${ground()}${person(126, 162, C.orange, 1.25)}${rect(220, 46, 145, 186, C.ink, 18)}${rect(231, 59, 123, 159, '#E7EBFF', 9)}${robot(292, 115, .85)}${badge(292, 63, 'AI CHAT', C.paper, 88)}${heart(292, 183, .9)}${heart(186, 115, .65)}${line(178, 170, 215, 151, 'stroke-dasharray="5 7"')}`;
}

function actorKiss() {
  return `${ground()}${person(202, 157, C.blue, 1.1)}${person(278, 157, C.orange, 1.1, true)}${heart(240, 113, .55)}${group(`${rect(-65, -24, 130, 53, C.ink, 5)}${rect(-65, -41, 130, 20, C.paper, 2)}${[-49, -17, 15, 47].map(x => path(`M${x}-41L${x + 17}-41 ${x + 5}-21 ${x - 12}-21Z`, C.ink, 'stroke="none"')).join('')}${text(0, 0, 'SCENE 08', 13, C.white)}${text(0, 18, 'TAKE 02', 10, C.white)}`, 'translate(240 65) rotate(-6)')}${badge(355, 207, 'SCRIPTED', C.yellow, 100)}`;
}

function dream() {
  return `${ground()}${rect(105, 184, 270, 40, C.crust, 8)}${rect(120, 146, 239, 48, C.paper, 12)}${circle(156, 159, 23, '#E7BB97')}${path('M179 143H330Q354 145 354 192H176Z', C.blue)}${path('M199 52Q187 34 207 24Q222 13 236 28Q253 12 270 28Q294 22 300 42Q326 50 310 70Q296 88 277 77Q253 98 233 80Q207 91 199 74Q180 72 189 55Z', C.paper)}${heart(251, 56, .85)}${circle(203, 104, 8, C.paper)}${circle(183, 125, 4, C.paper)}${text(364, 112, 'Z', 25, C.blue, 'transform="rotate(12 364 112)"')}${text(340, 136, 'z', 17, C.blue)}`;
}

function report(mode = 'human') {
  const ai = mode !== 'human';
  const paper = `${rect(-62, -81, 124, 161, C.paper, 5)}${rect(-44, -60, 62, 10, C.blue, 2, 'stroke="none"')}${[-30, -9, 12, 33].map(y => line(-43, y, 36, y, 'stroke="#A7A196" stroke-width="3"')).join('')}${path('M-42 59L-23 44-4 50 17 36 41 42', 'none', 'stroke="#4761E8" stroke-width="4"')}${mode === 'checked' ? [-30, -9, 12, 33].map(y => tick(46, y, .6)).join('') : ''}${mode === 'typo' ? `${line(-25, -13, 11, -13, 'stroke="#F56B38" stroke-width="3"')}${text(20, -18, '*', 22, C.orange)}` : ''}`;
  return `${ground()}${rect(83, 222, 314, 12, C.crust, 4)}${group(paper, 'translate(252 137) rotate(6)')}${ai ? `${robot(119, 144, .65)}${badge(329, 68, mode === 'checked' ? 'REVIEWED' : mode === 'typo' ? '1 TYPO' : 'UNREAD', mode === 'checked' ? '#DEE4FF' : C.yellow, 105)}` : `${person(115, 155, C.blue, 1.1)}${path('M136 190Q165 177 185 187', 'none', 'stroke="#E7BB97" stroke-width="13"')}${line(181, 190, 211, 166, 'stroke="#F56B38" stroke-width="7"')}`}`;
}

function problem(x = 313, y = 72, solved = false) {
  return group(`${rect(-55, -32, 110, 64, C.paper, 12)}${circle(-25, 0, 8, C.yellow)}${line(-16, 0, 14, 0)}${path('M7-6L14 0 7 6')}${solved ? tick(32, 0, 1) : rect(22, -10, 21, 21, '#DDE3FF', 3)}`, `translate(${x} ${y})`);
}

function walking(groceries = false) {
  return `${ground()}${path('M63 220Q140 204 210 221T417 218', 'none', 'stroke="#B8B39F" stroke-width="2"')}${path('M82 202V153M68 164Q54 146 70 138Q84 136 87 151M85 182Q107 158 114 175Q116 188 88 194', 'none', 'stroke="#9DAF83" stroke-width="6"')}${person(222, 116, C.blue, 1.15)}${path('M207 174L190 215 172 229M235 174L263 197 270 228', 'none', 'stroke-width="12"')}${path('M194 136L168 157M249 139L274 159', 'none', 'stroke="#E7BB97" stroke-width="12"')}${problem()}${circle(272, 108, 5, C.paper)}${circle(259, 119, 3, C.paper)}${groceries ? `${path('M263 158H323L318 215H268Z', C.bread)}${path('M279 159V147Q294 130 309 147V159')}${path('M279 154L278 130M299 153L311 126', 'none', 'stroke="#9DAF83" stroke-width="8"')}${badge(376, 173, 'SHOP STOP', C.paper, 90)}` : ''}`;
}

function television() {
  return `${rect(242, 66, 153, 112, C.ink, 10)}${rect(251, 76, 135, 85, '#E8EBFE', 4)}${person(289, 112, C.orange, .57)}${person(345, 112, C.blue, .57, true)}${line(286, 181, 278, 196)}${line(351, 181, 361, 196)}${text(319, 153, 'HA. HA. HA.', 9)}${line(293, 58, 278, 38)}${line(335, 58, 353, 40)}`;
}

function mouseTV() {
  return `${ground()}${television()}${rect(77, 190, 333, 12, C.crust, 3)}${rect(92, 136, 99, 57, C.paper, 6)}${circle(110, 153, 5, C.green, 'stroke="none"')}${text(149, 157, 'ACTIVE', 9)}${path('M211 172Q191 166 197 153Q203 140 222 150Q234 160 224 174Z', C.pale)}${path('M207 145Q210 132 201 127', 'none', 'stroke-width="2"')}${path('M185 175L176 170M230 179L241 176', 'none', 'stroke="#F56B38" stroke-width="3"')}${badge(148, 85, 'VERY ONLINE', C.yellow, 122)}`;
}

function nap() {
  return `${ground()}${rect(96, 190, 279, 14, C.crust, 3)}${person(184, 148, C.blue, 1.1)}${path('M178 170Q206 143 236 161L258 185H174Z', C.blue)}${circle(225, 164, 23, '#E7BB97')}${rect(224, 184, 91, 8, C.paper, 2)}${problem(305, 65, true)}${circle(254, 104, 6, C.paper)}${circle(242, 120, 3, C.paper)}${text(130, 103, 'Z', 25, C.blue)}${text(154, 122, 'z', 17, C.blue)}`;
}

function mandatoryFun() {
  return `${ground()}${rect(236, 51, 157, 116, C.ink, 8)}${rect(245, 60, 139, 85, '#DEE4FF', 3)}${text(314, 89, 'TEAM SPIRIT', 12)}${line(260, 110, 366, 110, 'stroke="#4761E8" stroke-width="5"')}${line(276, 125, 350, 125, 'stroke="#F56B38" stroke-width="4"')}${person(151, 140, C.orange, 1.25)}${line(178, 160, 208, 130, 'stroke="#E7BB97" stroke-width="11"')}${group(`${rect(-6, -1, 12, 38, C.ink, 5)}${circle(0, -7, 14, C.pale)}${line(-10, -9, 10, -9, 'stroke-width="2"')}`, 'translate(211 116) rotate(18)')}${badge(313, 186, 'ATTENDANCE REQUIRED', C.yellow, 176)}${text(92, 79, '♪', 31, C.blue)}${text(202, 61, '♫', 26, C.orange)}`;
}

function gameCall() {
  return `${ground()}${laptop(`${[147, 219, 291].map((x, i) => `${rect(x, 90, 58, 59, i === 0 ? C.pale : '#D0D8FA', 5)}${i === 0 ? path('M161 110H183V126H161ZM183 114L192 109V127L183 122', C.ink, 'stroke-width="2"') + line(155, 101, 195, 140, 'stroke="#F56B38"') : person(x + 29, 117, i === 1 ? C.blue : C.orange, .4)}`).join('')}${text(240, 178, 'STATUS CALL', 11)}`)}${group(`${path('M-57-20Q-64-42-38-43H38Q64-42 57-20L70 19Q74 40 52 36L25 15H-25L-52 36Q-74 40-70 19Z', C.orange)}${line(-42, -20, -42, 3, 'stroke-width="6"')}${line(-53, -9, -31, -9, 'stroke-width="6"')}${circle(38, -15, 5, C.blue)}${circle(52, -1, 5, C.yellow)}`, 'translate(240 205) rotate(-6)')}`;
}

function automation() {
  return `${ground()}${rect(125, 103, 152, 115, C.blue, 13)}${rect(143, 118, 116, 18, C.ink, 3)}${rect(159, 73, 87, 71, C.paper, 4)}${[91, 103, 115].map(y => line(172, y, 232, y, 'stroke-width="2"')).join('')}${tick(202, 129, .8)}${robot(201, 177, .55)}${person(346, 159, C.orange, 1)}${path('M320 189L300 206 348 220', 'none', 'stroke-width="10"')}${path('M317 134Q335 111 361 134', 'none', 'stroke="#E7BB97" stroke-width="10"')}${badge(193, 52, 'DELIVERED', C.yellow, 113)}${spark(304, 81)}`;
}

function pubDiscussion() {
  return `${ground()}${person(138, 147, C.blue, 1.1)}${person(342, 147, C.orange, 1.1, true)}${rect(90, 195, 300, 15, C.crust, 5)}${line(115, 212, 115, 238)}${line(363, 212, 363, 238)}${[186, 287].map(x => `${rect(x - 13, 157, 27, 37, C.yellow, 4)}${path(`M${x + 14} 165Q${x + 34} 163 ${x + 31} 178Q${x + 28} 187 ${x + 14} 181`)}${rect(x - 14, 153, 29, 9, C.paper, 4)}`).join('')}${problem(240, 70, true)}${path('M158 162L194 179M325 161L292 180', 'none', 'stroke="#E7BB97" stroke-width="10"')}`;
}

const scenes = {
  burger: () => burger(),
  'hotdog-joined': () => hotdog('joined'),
  'hotdog-cut': () => hotdog('cut'),
  'icecream-cookie': () => sweetSandwich(),
  'cheese-flat': () => cheeseSandwich(),
  'cheese-rotated': () => cheeseSandwich(true),
  'sausage-burger-bun': () => burger(true),
  'cookie-jam': () => sweetSandwich({ jam: true }),
  'toast-sandwich': () => cheeseSandwich(false, true),
  'hotdog-touching': () => hotdog('touching'),
  'icecream-bread': () => sweetSandwich({ bread: true }),
  lasagna,
  'video-free': () => video(),
  'video-paid': () => video(true),
  'ex-open': () => chat(),
  'ex-hidden': () => chat(true),
  'flirt-drink': flirt,
  'dating-idle': () => dating(),
  'custom-video': () => video(true, true),
  'ex-agreed': () => chat(true, true),
  'ai-romance': aiRomance,
  'actor-kiss': actorKiss,
  'dating-deleted': () => dating(true),
  dream,
  'report-human': () => report('human'),
  'report-ai-checked': () => report('checked'),
  'report-ai-unchecked': () => report('unread'),
  'walk-thinking': () => walking(),
  'walk-groceries': () => walking(true),
  'mouse-tv': mouseTV,
  'ai-typo': () => report('typo'),
  'nap-solution': nap,
  'mandatory-fun': mandatoryFun,
  'game-call': gameCall,
  automation,
  'pub-discussion': pubDiscussion,
};

export const SCENE_IDS = Object.freeze(Object.keys(scenes));

export function sceneSVG(sceneId, { mini = false } = {}) {
  const draw = Object.hasOwn(scenes, sceneId) ? scenes[sceneId] : null;
  if (!draw) throw new Error(`Unknown Still Counts scene: ${sceneId}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280" class="scene-svg${mini ? ' scene-mini' : ''}" aria-hidden="true" focusable="false"><g fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${mini ? '' : `${spark(88, 80, .65)}${spark(393, 132, .5)}`}${draw()}</g></svg>`;
}

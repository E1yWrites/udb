// Names for the basic keycodes (QMK `KC_*`, the HID keyboard and consumer usages)
// that UDB lets a user assign. Values and names are from QMK quantum/keycodes.h
// (commit 7a1bbf37, GPL-2.0-or-later). They are the same in every VIA protocol
// version. Anything else is shown as a hex number and is never offered.

export interface Keycode {
  code: number;
  name: string;
  /** A few characters for the keycap. */
  short: string;
  group: string;
}

const list: Keycode[] = [];
const add = (group: string, rows: [code: number, name: string, short?: string][]) => {
  for (const [code, name, short] of rows) list.push({ code, name, short: short ?? name, group });
};

add('Special', [
  [0x00, 'None', '–'],
  [0x01, 'Transparent (use the layer below)', 'Trns'],
]);
add('Letters', Array.from({ length: 26 }, (_, i): [number, string] => [0x04 + i, String.fromCharCode(65 + i)]));
add('Numbers', Array.from({ length: 10 }, (_, i): [number, string] => [0x1e + i, String((i + 1) % 10)]));
add('Editing', [
  [0x28, 'Enter', 'Ent'],
  [0x29, 'Escape', 'Esc'],
  [0x2a, 'Backspace', 'Bksp'],
  [0x2b, 'Tab'],
  [0x2c, 'Space', 'Spc'],
  [0x39, 'Caps Lock', 'Caps'],
  [0x49, 'Insert', 'Ins'],
  [0x4c, 'Delete', 'Del'],
]);
add('Punctuation', [
  [0x2d, '- (minus)', '-'],
  [0x2e, '= (equals)', '='],
  [0x2f, '[ (left bracket)', '['],
  [0x30, '] (right bracket)', ']'],
  [0x31, '\\ (backslash)', '\\'],
  [0x32, '# (non-US hash)', '#'],
  [0x33, '; (semicolon)', ';'],
  [0x34, "' (quote)", "'"],
  [0x35, '` (grave)', '`'],
  [0x36, ', (comma)', ','],
  [0x37, '. (period)', '.'],
  [0x38, '/ (slash)', '/'],
  [0x64, '\\ (non-US backslash)', '\\|'],
]);
add('Function keys', [
  ...Array.from({ length: 12 }, (_, i): [number, string] => [0x3a + i, `F${i + 1}`]),
  ...Array.from({ length: 12 }, (_, i): [number, string] => [0x68 + i, `F${i + 13}`]),
]);
add('Navigation', [
  [0x46, 'Print Screen', 'PrtSc'],
  [0x47, 'Scroll Lock', 'ScrLk'],
  [0x48, 'Pause'],
  [0x4a, 'Home'],
  [0x4b, 'Page Up', 'PgUp'],
  [0x4d, 'End'],
  [0x4e, 'Page Down', 'PgDn'],
  [0x4f, 'Right', '→'],
  [0x50, 'Left', '←'],
  [0x51, 'Down', '↓'],
  [0x52, 'Up', '↑'],
  [0x65, 'Menu (application)', 'Menu'],
]);
add('Keypad', [
  [0x53, 'Num Lock', 'Num'],
  [0x54, 'Keypad /', 'KP/'],
  [0x55, 'Keypad *', 'KP*'],
  [0x56, 'Keypad -', 'KP-'],
  [0x57, 'Keypad +', 'KP+'],
  [0x58, 'Keypad Enter', 'KPEnt'],
  ...Array.from({ length: 9 }, (_, i): [number, string, string] => [0x59 + i, `Keypad ${i + 1}`, `KP${i + 1}`]),
  [0x62, 'Keypad 0', 'KP0'],
  [0x63, 'Keypad .', 'KP.'],
  [0x67, 'Keypad =', 'KP='],
]);
add('Modifiers', [
  [0xe0, 'Left Ctrl', 'LCtl'],
  [0xe1, 'Left Shift', 'LSft'],
  [0xe2, 'Left Alt', 'LAlt'],
  [0xe3, 'Left GUI (Windows)', 'LGui'],
  [0xe4, 'Right Ctrl', 'RCtl'],
  [0xe5, 'Right Shift', 'RSft'],
  [0xe6, 'Right Alt', 'RAlt'],
  [0xe7, 'Right GUI (Windows)', 'RGui'],
]);
add('Media and system', [
  [0xa5, 'System Power', 'Pwr'],
  [0xa6, 'System Sleep', 'Sleep'],
  [0xa7, 'System Wake', 'Wake'],
  [0xa8, 'Mute'],
  [0xa9, 'Volume Up', 'Vol+'],
  [0xaa, 'Volume Down', 'Vol-'],
  [0xab, 'Next Track', 'Next'],
  [0xac, 'Previous Track', 'Prev'],
  [0xad, 'Media Stop', 'Stop'],
  [0xae, 'Play/Pause', 'Play'],
  [0xaf, 'Media Select', 'Media'],
  [0xb0, 'Eject'],
  [0xb1, 'Mail'],
  [0xb2, 'Calculator', 'Calc'],
  [0xb3, 'My Computer', 'MyPC'],
  [0xb4, 'Browser Search', 'Srch'],
  [0xb5, 'Browser Home', 'Home'],
  [0xb6, 'Browser Back', 'Back'],
  [0xb7, 'Browser Forward', 'Fwd'],
  [0xb8, 'Browser Stop', 'Stop'],
  [0xb9, 'Browser Refresh', 'Rfsh'],
  [0xba, 'Browser Favorites', 'Fav'],
  [0xbb, 'Fast Forward', 'FF'],
  [0xbc, 'Rewind', 'Rew'],
  [0xbd, 'Brightness Up', 'Br+'],
  [0xbe, 'Brightness Down', 'Br-'],
]);

export const KEYCODES: readonly Keycode[] = list;
const byCode = new Map(list.map((k) => [k.code, k]));

/** Keycodes grouped for a picker, in table order. */
export const KEYCODE_GROUPS: readonly { group: string; keys: Keycode[] }[] = [...new Set(list.map((k) => k.group))].map((group) => ({
  group,
  keys: list.filter((k) => k.group === group),
}));

const hex = (code: number) => `0x${code.toString(16).toUpperCase().padStart(4, '0')}`;

/** The key's name, or its number when UDB doesn't name it (layer, macro, quantum and other keys). */
export const keycodeName = (code: number) => byCode.get(code)?.name ?? hex(code);
export const keycodeShort = (code: number) => byCode.get(code)?.short ?? hex(code);
export const isNamed = (code: number) => byCode.has(code);

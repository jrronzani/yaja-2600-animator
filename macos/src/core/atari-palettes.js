const NTSC_ROWS = [
  "000000 4A4A4A 6F6F6F 8E8E8E AAAAAA C0C0C0 D6D6D6 ECECEC",
  "484800 69690F 86861D A2A22A BBBB35 D2D240 E8E84A FCFC54",
  "7C2C00 904811 A26221 B47A30 C3903D D2A44A DFB755 ECC860",
  "901C00 A33915 B55328 C66C3A D5824A E39759 F0AA67 FCBC74",
  "940000 A71A1A B83232 C84848 D65C5C E46F6F F08080 FC9090",
  "840064 97197A A8308F B846A2 C659B3 D46CC3 E07CD2 EC8CE0",
  "500084 68199A 7D30AD 9246C0 A459D0 B56CE0 C57CEE D48CFC",
  "140090 331AA3 4E32B5 6848C6 7F5CD5 956FE3 A980F0 BC90FC",
  "000094 181AA7 2D32B8 4248C8 545CD6 656FE4 7580F0 8490FC",
  "001C88 183B9D 2D57B0 4272C2 548AD2 65A0E1 75B5EF 84C8FC",
  "003064 185080 2D6D98 4288B0 54A0C5 65B7D9 75CCEB 84E0FC",
  "004030 18624E 2D8169 429E82 54B899 65D1AE 75E7C2 84FCD4",
  "004400 1A661A 328432 48A048 5CBA5C 6FD26F 80E880 90FC90",
  "143C00 355F18 527E2D 6E9C42 87B754 9ED065 B4E775 C8FC84",
  "303800 505916 6D762B 88923E A0AB4F B7C25F CCD86E E0EC7C",
  "482C00 694D14 866A26 A28638 BB9F47 D2B656 E8CC63 FCE070"
];

const PAL_ROWS = [
  "0B0B0B 333333 595959 7B7B7B 999999 B6B6B6 CFCFCF E6E6E6",
  "0B0B0B 333333 595959 7B7B7B 999999 B6B6B6 CFCFCF E6E6E6",
  "3B2400 664700 8B7000 AC9200 C5AE36 DEC85E F7E27F FFF19E",
  "004500 006F00 3B9200 65B009 85CA3D A3E364 BFFC84 D5FFA5",
  "590000 802700 A15700 BC7937 D6985F EEB381 FFCE9E FFDCBD",
  "004900 007200 169216 45AF45 6BC96B 8BE38B A9FBA9 C5FFC5",
  "640012 890821 A73D4D C26472 DC8491 F4A3AE FFBECA FFDAE0",
  "003D29 006A48 048E63 3CAA84 62C5A2 83DFBE A1F8D9 BEFFE9",
  "550046 88006E A5318D C159AA DA7CC5 F39ADF FFB9F3 FFD4F6",
  "003651 005A7D 117E9C 429CB8 68B7D2 88D2EB A6EBFF C3FFFF",
  "4C007C 75009D 932EB8 AF57D2 CA7AEB E499FF ECB7FF F3D4FF",
  "002D83 003EA4 2D65BF 5685DA 79A2F2 99BFFF B7DBFF D3F5FF",
  "220096 5200B6 7538CF 945FE8 B181FF C5A0FF D6BDFF E8DAFF",
  "00009A 241DB6 504AD0 746FE9 928EFF B1ADFF CECAFF E9E5FF",
  "0B0B0B 333333 595959 7B7B7B 999999 B6B6B6 CFCFCF E6E6E6",
  "0B0B0B 333333 595959 7B7B7B 999999 B6B6B6 CFCFCF E6E6E6"
];

const LEGACY_PAL_ROWS = {
  0: "000000 404040 6C6C6C 909090 B0B0B0 C8C8C8 DCDCDC ECECEC",
  1: "003C70 1C5888 3874A0 508CB4 68A4C8 7CB8DC 90CCE8 A4E0FC",
  2: "805800 947020 A8843C BC9C58 CCAC70 DCC084 ECD09C FCE0B0",
  3: "580070 6C2088 803CA0 9458B4 A470C8 B484DC C49CEC D4B0FC",
  4: "445C00 5C7820 74903C 8CAC58 A0C070 B0D484 C0E89C D4FCB0",
  5: "002070 1C3C88 3858A0 5074B4 6888C8 7CA0DC 90B4EC A4C8FC",
  6: "703400 885020 A0683C B48458 C89870 DCAC84 ECC09C FCD4B0",
  7: "3C0080 542094 6C3CA4 8058BC 9470CC A884DC B89CEC C8B0FC",
  8: "006414 208034 3C9850 58B06C 70C484 84D89C 9CE8B4 B0FCC8",
  9: "000088 20209C 3C3CB0 5858C0 7070D0 8484E0 9C9CEC B0B0FC",
  A: "700014 882034 A03C50 B4586C C87084 DC849C EC9CB4 FCB0C8",
  C: "005C5C 207474 3C8C8C 58A4A4 70B8B8 84C8C8 9CDCDC B0ECEC",
  E: "70005C 842074 943C88 A8589C B470B0 C484C0 D09CD0 E0B0E0"
};

function rowsToPalette(rows) {
  const entries = Array.isArray(rows) ? rows.map((row, hue) => [hue.toString(16).toUpperCase(), row]) : Object.entries(rows);
  return Object.fromEntries(entries.flatMap(([hue, row]) => row.split(" ").map((hex, index) => [`$${hue}${(index * 2).toString(16).toUpperCase()}`, `#${hex}`])));
}

export const ATARI_NTSC = Object.freeze(rowsToPalette(NTSC_ROWS));
export const ATARI_PAL = Object.freeze(rowsToPalette(PAL_ROWS));
export const LEGACY_YAJA_PAL = Object.freeze(rowsToPalette(LEGACY_PAL_ROWS));
export const NTSC_DISPLAY_CODES = Object.freeze(Object.keys(ATARI_NTSC));
export const PAL_DISPLAY_CODES = Object.freeze([0, ...Array.from({ length: 12 }, (_, i) => i + 2)].flatMap(hue => Array.from({ length: 8 }, (_, luma) => `$${hue.toString(16).toUpperCase()}${(luma * 2).toString(16).toUpperCase()}`)));

export function paletteForRegion(region) { return region === "PAL" ? ATARI_PAL : ATARI_NTSC; }
export function displayCodesForRegion(region) { return region === "PAL" ? PAL_DISPLAY_CODES : NTSC_DISPLAY_CODES; }

function srgbToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function hexToLab(hex) {
  const r = srgbToLinear(parseInt(hex.slice(1, 3), 16));
  const g = srgbToLinear(parseInt(hex.slice(3, 5), 16));
  const b = srgbToLinear(parseInt(hex.slice(5, 7), 16));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = value => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const LAB_CACHE = new Map();
function lab(hex) { if (!LAB_CACHE.has(hex)) LAB_CACHE.set(hex, hexToLab(hex)); return LAB_CACHE.get(hex); }

export function nearestPaletteCode(hex, region) {
  const source = lab(hex);
  const palette = paletteForRegion(region);
  const codes = displayCodesForRegion(region);
  let best = codes[0], bestDistance = Infinity;
  for (const code of codes) {
    const candidate = lab(palette[code]);
    const distance = (source[0] - candidate[0]) ** 2 + (source[1] - candidate[1]) ** 2 + (source[2] - candidate[2]) ** 2;
    if (distance < bestDistance) { best = code; bestDistance = distance; }
  }
  return best;
}

export function convertColorCode(code, fromRegion, toRegion, sourcePalette = paletteForRegion(fromRegion)) {
  const hex = sourcePalette[String(code || "").toUpperCase()] || sourcePalette.$00 || "#000000";
  return nearestPaletteCode(hex, toRegion);
}

export function migrateLegacyPalCode(code) { return convertColorCode(code, "PAL", "PAL", LEGACY_YAJA_PAL); }

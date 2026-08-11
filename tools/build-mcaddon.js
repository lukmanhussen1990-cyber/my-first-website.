#!/usr/bin/env node
/**
 * Builds BeautifulBase.mcaddon from the generator logic that lives in
 * minecraft-house-generator.html, so the page and the shipped add-on can
 * never drift apart. Everything above the "Isometric preview" section of
 * that file is pure logic with no DOM access, so we slice it out and run it.
 *
 *   node tools/build-mcaddon.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const HTML = path.join(ROOT, "minecraft-house-generator.html");
const OUT = path.join(ROOT, "BeautifulBase.mcaddon");
const PACK_DIR = "BeautifulBase_BP/";

/* ---- pull the generator out of the page ------------------------- */
function loadGenerator(){
  const html = fs.readFileSync(HTML, "utf8");
  const open = html.lastIndexOf("<script>");
  const body = html.slice(open + "<script>".length);
  const cut = body.indexOf("6. Isometric preview");
  if(open < 0 || cut < 0) throw new Error("could not locate the generator block in the HTML");
  const src = body.slice(0, body.lastIndexOf("/* ==============", cut));
  const factory = new Function(
    src + "\nreturn {buildHouse, toCommands, clearCommands, zipStore, uuid, THEMES, SIZES};"
  );
  return factory();
}

/* ---- a 64x64 PNG pack icon, no canvas needed -------------------- */
function pngIcon(){
  const W = 64, H = 64;
  const px = Buffer.alloc(W * H * 3);
  const put = (x, y, hex) => {
    if(x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    px[i] = (hex >> 16) & 255; px[i+1] = (hex >> 8) & 255; px[i+2] = hex & 255;
  };
  const rect = (x, y, w, h, hex) => {
    for(let j = y; j < y + h; j++) for(let i = x; i < x + w; i++) put(i, j, hex);
  };
  rect(0, 0, W, H, 0x1a2016);                       // background
  rect(14, 30, 36, 24, 0xb8945f);                   // wall
  for(let i = 0; i < 11; i++) rect(9 + i*2, 30 - i*2, 46 - i*4, 4, 0x4d3218);  // roof
  rect(28, 40, 8, 14, 0x3b2a17);                    // door
  rect(18, 34, 6, 6, 0xbfe0ec);                     // windows
  rect(40, 34, 6, 6, 0xbfe0ec);
  rect(30, 25, 4, 4, 0xf0a63c);                     // chimney light

  const raw = Buffer.alloc(H * (W * 3 + 1));
  for(let y = 0; y < H; y++){
    raw[y * (W * 3 + 1)] = 0;                       // filter: none
    px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }

  const crcTable = [];
  for(let n = 0; n < 256; n++){
    let c = n;
    for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  const crc = buf => {
    let c = 0xFFFFFFFF;
    for(const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td), 0);
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, {level: 9})),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---- the houses shipped inside the add-on ----------------------- */
const VARIANTS = [
  {fn:"beautiful_base", theme:"oak",   size:"standard", note:"Oakwood Cottage, two floors — the default"},
  {fn:"base_cottage",   theme:"oak",   size:"cozy",     note:"Oakwood Cottage, single floor"},
  {fn:"base_manor",     theme:"stone", size:"grand",    note:"Stonebrick Manor, 17x13, two floors"},
  {fn:"base_lodge",     theme:"dark",  size:"standard", note:"Darkwood Lodge, two floors"}
];

const BASE_OPTS = {
  ids: "modern",
  furnish: true, lights: true, farm: true, yard: true, chimney: true, clear: true
};

async function main(){
  const gen = loadGenerator();
  const enc = new TextEncoder();
  const files = [];
  const report = [];

  let widest = null, widestOpts = null, widestVol = -1;

  for(const v of VARIANTS){
    const opts = Object.assign({}, BASE_OPTS, {theme: v.theme, size: v.size});
    const build = gen.buildHouse(opts);
    const lines = gen.toCommands(build, opts);
    files.push({
      name: PACK_DIR + "functions/" + v.fn + ".mcfunction",
      data: enc.encode(lines.join("\n") + "\n")
    });
    const b = build.bounds();
    const vol = (b.x2 - b.x1) * (b.y2 - b.y1) * (b.z2 - b.z1);
    if(vol > widestVol){ widestVol = vol; widest = build; widestOpts = opts; }
    report.push({
      fn: v.fn,
      blocks: build.m.size,
      commands: lines.filter(l => l && l[0] !== "#").length
    });
  }

  /* clear_base is sized to the largest variant so it erases any of them */
  files.push({
    name: PACK_DIR + "functions/clear_base.mcfunction",
    data: enc.encode(gen.clearCommands(widest, widestOpts).join("\n") + "\n")
  });

  const manifest = {
    format_version: 2,
    header: {
      name: "Beautiful Base",
      description:
        "Instant survival houses.\n" +
        VARIANTS.map(v => "/function " + v.fn + " - " + v.note).join("\n") +
        "\n/function clear_base - erase the build",
      uuid: gen.uuid(),
      version: [1, 0, 0],
      min_engine_version: [1, 19, 0]
    },
    modules: [{
      type: "data",
      uuid: gen.uuid(),
      version: [1, 0, 0],
      description: "House building functions"
    }]
  };

  files.unshift(
    {name: PACK_DIR + "manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2))},
    {name: PACK_DIR + "pack_icon.png", data: new Uint8Array(pngIcon())}
  );

  const blob = gen.zipStore(files);
  const bytes = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(OUT, bytes);

  console.log("wrote " + path.basename(OUT) + "  (" + (bytes.length / 1024).toFixed(1) + " KB)");
  for(const r of report){
    console.log("  " + r.fn.padEnd(16) + r.blocks.toString().padStart(6) + " blocks  " +
                r.commands.toString().padStart(4) + " commands");
  }
}

main().catch(e => { console.error(e); process.exit(1); });

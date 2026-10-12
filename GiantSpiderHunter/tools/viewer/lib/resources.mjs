// Resource pack loading: client entities, geometries, animations, animation controllers,
// render controllers and textures (PNG/TGA). Several RP roots can be layered (later wins).

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseGeometryFile } from './geometry.mjs';

// Bedrock JSON allows // and /* */ comments and trailing commas in some files.
export function readJsonLoose(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  try {
    return JSON.parse(txt);
  } catch {
    let out = '';
    let i = 0;
    let inStr = false;
    while (i < txt.length) {
      const c = txt[i];
      if (inStr) {
        out += c;
        if (c === '\\') { out += txt[i + 1] ?? ''; i += 2; continue; }
        if (c === '"') inStr = false;
        i++;
        continue;
      }
      if (c === '"') { inStr = true; out += c; i++; continue; }
      if (c === '/' && txt[i + 1] === '/') { while (i < txt.length && txt[i] !== '\n') i++; continue; }
      if (c === '/' && txt[i + 1] === '*') { const j = txt.indexOf('*/', i + 2); i = j < 0 ? txt.length : j + 2; continue; }
      out += c;
      i++;
    }
    out = out.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(out);
  }
}

function walk(dir, exts) {
  const res = [];
  if (!fs.existsSync(dir)) return res;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) res.push(...walk(p, exts));
    else if (exts.some((e) => ent.name.toLowerCase().endsWith(e))) res.push(p);
  }
  return res.sort();
}

// ------------------------------------------------------------------ images
export function decodeTGA(buf) {
  const idLen = buf[0];
  const cmapType = buf[1];
  const type = buf[2];
  const cmapLen = buf.readUInt16LE(5);
  const cmapDepth = buf[7];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16];
  const desc = buf[17];
  if (![2, 10, 3, 11].includes(type)) throw new Error(`unsupported TGA type ${type}`);
  let off = 18 + idLen + (cmapType ? cmapLen * Math.ceil(cmapDepth / 8) : 0);
  const gray = type === 3 || type === 11;
  const bytesPP = bpp / 8;
  const npx = width * height;
  const raw = Buffer.alloc(npx * bytesPP);
  if (type === 2 || type === 3) buf.copy(raw, 0, off, off + raw.length);
  else {
    let p = 0;
    while (p < raw.length) {
      const h = buf[off++];
      const count = (h & 0x7f) + 1;
      if (h & 0x80) {
        const px = buf.subarray(off, off + bytesPP);
        off += bytesPP;
        for (let k = 0; k < count; k++) { px.copy(raw, p); p += bytesPP; }
      } else {
        buf.copy(raw, p, off, off + count * bytesPP);
        off += count * bytesPP;
        p += count * bytesPP;
      }
    }
  }
  const data = Buffer.alloc(npx * 4);
  const topOrigin = (desc & 0x20) !== 0;
  const rightOrigin = (desc & 0x10) !== 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sy = topOrigin ? y : height - 1 - y;
      const sx = rightOrigin ? width - 1 - x : x;
      const s = (sy * width + sx) * bytesPP;
      const d = (y * width + x) * 4;
      if (gray) {
        data[d] = data[d + 1] = data[d + 2] = raw[s];
        data[d + 3] = bytesPP > 1 ? raw[s + 1] : 255;
      } else {
        data[d] = raw[s + 2];
        data[d + 1] = raw[s + 1];
        data[d + 2] = raw[s];
        data[d + 3] = bytesPP === 4 ? raw[s + 3] : 255;
      }
    }
  }
  return { width, height, data };
}

export function loadImage(file) {
  const buf = fs.readFileSync(file);
  if (file.toLowerCase().endsWith('.tga')) return decodeTGA(buf);
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: Buffer.from(png.data) };
}

export function encodePNG(img) {
  const png = new PNG({ width: img.width, height: img.height });
  Buffer.from(img.data).copy(png.data);
  return PNG.sync.write(png);
}

// ------------------------------------------------------------------ resource pack
export class ResourcePacks {
  constructor(roots, warn = () => {}) {
    this.roots = roots.map((r) => path.resolve(r));
    this.warn = warn;
    this.entities = new Map(); // identifier -> {description, file, format}
    this.geometries = new Map(); // id -> model
    this.animations = new Map(); // id -> {def, file}
    this.controllers = new Map(); // id -> {def, file}
    this.renderControllers = new Map(); // id -> {def, file}
    this.files = { entity: [], geometry: [], animation: [], controller: [], render: [] };
    for (const root of this.roots) this._load(root);
  }

  _safe(file, fn) {
    try { fn(readJsonLoose(file)); } catch (e) { this.warn(`failed to load ${file}: ${e.message}`); }
  }

  _load(root) {
    for (const f of walk(path.join(root, 'entity'), ['.json'])) {
      this.files.entity.push(f);
      this._safe(f, (j) => {
        const ce = j['minecraft:client_entity'];
        if (!ce || !ce.description) return;
        const id = String(ce.description.identifier || '').toLowerCase();
        if (id) this.entities.set(id, { description: ce.description, file: f, format: j.format_version });
      });
    }
    for (const f of walk(path.join(root, 'models'), ['.json'])) {
      this.files.geometry.push(f);
      this._safe(f, (j) => { for (const [id, m] of parseGeometryFile(j, f)) this.geometries.set(id, m); });
    }
    for (const f of walk(path.join(root, 'animations'), ['.json'])) {
      this.files.animation.push(f);
      this._safe(f, (j) => { for (const [id, a] of Object.entries(j.animations || {})) this.animations.set(id.toLowerCase(), { def: a, file: f, id }); });
    }
    for (const f of walk(path.join(root, 'animation_controllers'), ['.json'])) {
      this.files.controller.push(f);
      this._safe(f, (j) => { for (const [id, c] of Object.entries(j.animation_controllers || {})) this.controllers.set(id.toLowerCase(), { def: c, file: f, id }); });
    }
    for (const f of walk(path.join(root, 'render_controllers'), ['.json'])) {
      this.files.render.push(f);
      this._safe(f, (j) => { for (const [id, c] of Object.entries(j.render_controllers || {})) this.renderControllers.set(id.toLowerCase(), { def: c, file: f, id }); });
    }
  }

  // texture path like "textures/entity/spider/spider" (no extension)
  resolveTexture(texPath) {
    const exts = ['', '.png', '.tga', '.jpg', '.jpeg'];
    for (const root of [...this.roots].reverse()) {
      for (const e of exts) {
        const p = path.join(root, texPath + e);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      }
    }
    if (fs.existsSync(texPath)) return texPath;
    return null;
  }

  addAnimationFile(file) {
    this._safe(file, (j) => { for (const [id, a] of Object.entries(j.animations || {})) this.animations.set(id.toLowerCase(), { def: a, file, id }); });
  }
  addControllerFile(file) {
    this._safe(file, (j) => { for (const [id, c] of Object.entries(j.animation_controllers || {})) this.controllers.set(id.toLowerCase(), { def: c, file, id }); });
  }
  addGeometryFile(file) {
    this._safe(file, (j) => { for (const [id, m] of parseGeometryFile(j, file)) this.geometries.set(id, m); });
  }
}

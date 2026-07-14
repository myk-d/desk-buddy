var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow } from "electron";
import { execSync, exec } from "child_process";
import { join, dirname } from "path";
import https from "https";
import { SerialPort } from "serialport";
import { fileURLToPath } from "url";
import { autoUpdater } from "electron-updater";
import { randomUUID } from "crypto";
import { writeFileSync, existsSync, readFileSync } from "fs";
class ESPError extends Error {
}
/*! pako 2.2.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */
const Z_FIXED$1 = 4;
const Z_BINARY = 0;
const Z_TEXT = 1;
const Z_UNKNOWN$1 = 2;
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
const STORED_BLOCK = 0;
const STATIC_TREES = 1;
const DYN_TREES = 2;
const MIN_MATCH$1 = 3;
const MAX_MATCH$1 = 258;
const LENGTH_CODES$1 = 29;
const LITERALS$1 = 256;
const L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
const D_CODES$1 = 30;
const BL_CODES$1 = 19;
const HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
const MAX_BITS$1 = 15;
const Buf_size = 16;
const MAX_BL_BITS = 7;
const END_BLOCK = 256;
const REP_3_6 = 16;
const REPZ_3_10 = 17;
const REPZ_11_138 = 18;
const extra_lbits = (
  /* extra bits for each length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
);
const extra_dbits = (
  /* extra bits for each distance code */
  new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
);
const extra_blbits = (
  /* extra bits for each bit length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
);
const bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
const DIST_CODE_LEN = 512;
const static_ltree = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
const static_dtree = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
const _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
const _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
const base_length = new Array(LENGTH_CODES$1);
zero$1(base_length);
const base_dist = new Array(D_CODES$1);
zero$1(base_dist);
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
let static_l_desc;
let static_d_desc;
let static_bl_desc;
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
const d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
const put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
const send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
};
const send_code = (s, c, tree) => {
  send_bits(
    s,
    tree[c * 2],
    tree[c * 2 + 1]
    /*.Len*/
  );
};
const bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
const bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};
const gen_bitlen = (s, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) {
      continue;
    }
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
};
const gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(MAX_BITS$1 + 1);
  let code = 0;
  let bits;
  let n;
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }
  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
};
const tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(MAX_BITS$1 + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
};
const init_block = (s) => {
  let n;
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] = 0;
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] = 0;
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] = 0;
  }
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
const bi_windup = (s) => {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
};
const smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
const pqdownheap = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
const compress_block = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0) {
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 255;
      dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
      lc = s.pending_buf[s.sym_buf + sx++];
      if (dist === 0) {
        send_code(s, lc, ltree);
      } else {
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (sx < s.sym_next);
  }
  send_code(s, END_BLOCK, ltree);
};
const build_tree = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) {
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] = 0;
    }
  }
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree) {
      s.static_len -= stree[node * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }
  node = elems;
  do {
    n = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[
      1
      /*SMALLEST*/
    ] = s.heap[s.heap_len--];
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
    m = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[
      1
      /*SMALLEST*/
    ] = node++;
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[
    1
    /*SMALLEST*/
  ];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
};
const scan_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2]++;
      }
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
const send_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
const build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
const send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) {
    send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  }
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
const detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) {
    if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
};
let static_init_done = false;
const _tr_init$1 = (s) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
};
const _tr_stored_block$1 = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) {
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  }
  s.pending += stored_len;
};
const _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
const _tr_flush_block$1 = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block$1(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) {
    bi_windup(s);
  }
};
const _tr_tally$1 = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) {
    s.dyn_ltree[lc * 2]++;
  } else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var _tr_init_1 = _tr_init$1;
var _tr_stored_block_1 = _tr_stored_block$1;
var _tr_flush_block_1 = _tr_flush_block$1;
var _tr_tally_1 = _tr_tally$1;
var _tr_align_1 = _tr_align$1;
var trees = {
  _tr_init: _tr_init_1,
  _tr_stored_block: _tr_stored_block_1,
  _tr_flush_block: _tr_flush_block_1,
  _tr_tally: _tr_tally_1,
  _tr_align: _tr_align_1
};
const adler32 = (adler, buf, len, pos) => {
  let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2e3 ? 2e3 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
};
var adler32_1 = adler32;
const makeTable = () => {
  let c, table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c;
  }
  return table;
};
const crcTable = new Uint32Array(makeTable());
const crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) {
    crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  }
  return crc ^ -1;
};
var crc32_1 = crc32;
var messages = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
};
var constants$2 = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
const { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
const {
  Z_NO_FLUSH: Z_NO_FLUSH$2,
  Z_PARTIAL_FLUSH,
  Z_FULL_FLUSH: Z_FULL_FLUSH$1,
  Z_FINISH: Z_FINISH$3,
  Z_BLOCK: Z_BLOCK$1,
  Z_OK: Z_OK$3,
  Z_STREAM_END: Z_STREAM_END$3,
  Z_STREAM_ERROR: Z_STREAM_ERROR$2,
  Z_DATA_ERROR: Z_DATA_ERROR$2,
  Z_BUF_ERROR: Z_BUF_ERROR$2,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_FILTERED,
  Z_HUFFMAN_ONLY,
  Z_RLE,
  Z_FIXED,
  Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_UNKNOWN,
  Z_DEFLATED: Z_DEFLATED$2
} = constants$2;
const MAX_MEM_LEVEL = 9;
const MAX_WBITS$1 = 15;
const DEF_MEM_LEVEL = 8;
const LENGTH_CODES = 29;
const LITERALS = 256;
const L_CODES = LITERALS + 1 + LENGTH_CODES;
const D_CODES = 30;
const BL_CODES = 19;
const HEAP_SIZE = 2 * L_CODES + 1;
const MAX_BITS = 15;
const MIN_MATCH = 3;
const MAX_MATCH = 258;
const MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
const PRESET_DICT = 32;
const INIT_STATE = 42;
const GZIP_STATE = 57;
const EXTRA_STATE = 69;
const NAME_STATE = 73;
const COMMENT_STATE = 91;
const HCRC_STATE = 103;
const BUSY_STATE = 113;
const FINISH_STATE = 666;
const BS_NEED_MORE = 1;
const BS_BLOCK_DONE = 2;
const BS_FINISH_STARTED = 3;
const BS_FINISH_DONE = 4;
const OS_CODE = 3;
const err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};
const rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
const zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
};
const slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;
  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
  n = wsize;
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
};
let HASH = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
const INSERT_STRING = (s, str) => {
  let h;
  if (s.legacy_hash) {
    h = s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
  } else {
    const w = s.window;
    const value = w[str] | w[str + 1] << 8 | w[str + 2] << 16 | w[str + 3] << 24;
    h = s.ins_h = Math.imul(value, 66521) + 66521 >>> 16 & s.hash_mask;
  }
  const hash_head = s.prev[str & s.w_mask] = s.head[h];
  s.head[h] = str;
  return hash_head;
};
const flush_pending = (strm) => {
  const s = strm.state;
  let len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
};
const flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
const put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
const putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
};
const read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
const longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
};
const fill_window = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (!s.legacy_hash) {
      if (s.lookahead + s.insert > MIN_MATCH) {
        str = s.strstart - s.insert;
        while (s.insert) {
          INSERT_STRING(s, str);
          str++;
          s.insert--;
          if (s.lookahead + s.insert <= MIN_MATCH) {
            break;
          }
        }
      }
    } else if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        INSERT_STRING(s, str);
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
};
const deflate_stored = (s, flush) => {
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
  let len, left, have, last = 0;
  let used = s.strm.avail_in;
  do {
    len = 65535;
    have = s.bi_valid + 42 >> 3;
    if (s.strm.avail_out < have) {
      break;
    }
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;
    if (len > left + s.strm.avail_in) {
      len = left + s.strm.avail_in;
    }
    if (len > have) {
      len = have;
    }
    if (len < min_block && (len === 0 && flush !== Z_FINISH$3 || flush === Z_NO_FLUSH$2 || len !== left + s.strm.avail_in)) {
      break;
    }
    last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending(s.strm);
    if (left) {
      if (left > len) {
        left = len;
      }
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);
  used -= s.strm.avail_in;
  if (used) {
    if (used >= s.w_size) {
      s.matches = 2;
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    } else {
      if (s.window_size - s.strstart <= used) {
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) {
          s.matches++;
        }
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
      }
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  if (last) {
    return BS_FINISH_DONE;
  }
  if (flush !== Z_NO_FLUSH$2 && flush !== Z_FINISH$3 && s.strm.avail_in === 0 && s.strstart === s.block_start) {
    return BS_BLOCK_DONE;
  }
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2) {
      s.matches++;
    }
    have += s.w_size;
    if (s.insert > s.strstart) {
      s.insert = s.strstart;
    }
  }
  if (have > s.strm.avail_in) {
    have = s.strm.avail_in;
  }
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  have = s.bi_valid + 42 >> 3;
  have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block || (left || flush === Z_FINISH$3) && flush !== Z_NO_FLUSH$2 && s.strm.avail_in === 0 && left <= have) {
    len = left > have ? have : left;
    last = flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};
const deflate_fast = (s, flush) => {
  let hash_head;
  let bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      hash_head = INSERT_STRING(s, s.strstart);
    }
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          hash_head = INSERT_STRING(s, s.strstart);
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        if (s.legacy_hash) {
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
        }
      }
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
const deflate_slow = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      hash_head = INSERT_STRING(s, s.strstart);
    }
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
        s.match_length = MIN_MATCH - 1;
      }
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          hash_head = INSERT_STRING(s, s.strstart);
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush) {
        flush_block_only(s, false);
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
const deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
const deflate_huff = (s, flush) => {
  let bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
const configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),
  /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),
  /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),
  /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),
  /* 3 */
  new Config(4, 4, 16, 16, deflate_slow),
  /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),
  /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),
  /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),
  /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),
  /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)
  /* 9 max compression */
];
const lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED$2;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.legacy_hash = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
  this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
  this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new Uint16Array(MAX_BITS + 1);
  this.heap = new Uint16Array(2 * L_CODES + 1);
  zero(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new Uint16Array(2 * L_CODES + 1);
  zero(this.depth);
  this.sym_buf = 0;
  this.lit_bufsize = 0;
  this.sym_next = 0;
  this.sym_end = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
const deflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const s = strm.state;
  if (!s || s.strm !== strm || s.status !== INIT_STATE && //#ifdef GZIP
  s.status !== GZIP_STATE && //#endif
  s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) {
    return 1;
  }
  return 0;
};
const deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm)) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;
  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) {
    s.wrap = -s.wrap;
  }
  s.status = //#ifdef GZIP
  s.wrap === 2 ? GZIP_STATE : (
    //#endif
    s.wrap ? INIT_STATE : BUSY_STATE
  );
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = -2;
  _tr_init(s);
  return Z_OK$3;
};
const deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === Z_OK$3) {
    lm_init(strm.state);
  }
  return ret;
};
const deflateSetHeader = (strm, head) => {
  if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$2;
  }
  strm.state.gzhead = head;
  return Z_OK$3;
};
const deflateInit2 = (strm, level, method, windowBits, memLevel, strategy, legacyHash) => {
  if (!strm) {
    return Z_STREAM_ERROR$2;
  }
  let wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED || windowBits === 8 && wrap !== 1) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  const s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.legacy_hash = legacyHash ? 1 : 0;
  s.hash_bits = memLevel + 7;
  if (!s.legacy_hash && s.hash_bits < 15) {
    s.hash_bits = 15;
  }
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);
  s.sym_buf = s.lit_bufsize;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
};
const deflateInit = (strm, level) => {
  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
};
const deflate$2 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== Z_FINISH$3) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$2 : Z_STREAM_ERROR$2);
  }
  const old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$3) {
    return err(strm, Z_BUF_ERROR$2);
  }
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$2);
  }
  if (s.status === INIT_STATE && s.wrap === 0) {
    s.status = BUSY_STATE;
  }
  if (s.status === INIT_STATE) {
    let header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
    let level_flags = -1;
    if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
      level_flags = 0;
    } else if (s.level < 6) {
      level_flags = 1;
    } else if (s.level === 6) {
      level_flags = 2;
    } else {
      level_flags = 3;
    }
    header |= level_flags << 6;
    if (s.strstart !== 0) {
      header |= PRESET_DICT;
    }
    header += 31 - header % 31;
    putShortMSB(s, header);
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    strm.adler = 1;
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (s.status === GZIP_STATE) {
    strm.adler = 0;
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) {
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else {
      put_byte(
        s,
        (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
      );
      put_byte(s, s.gzhead.time & 255);
      put_byte(s, s.gzhead.time >> 8 & 255);
      put_byte(s, s.gzhead.time >> 16 & 255);
      put_byte(s, s.gzhead.time >> 24 & 255);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, s.gzhead.os & 255);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 255);
        put_byte(s, s.gzhead.extra.length >> 8 & 255);
      }
      if (s.gzhead.hcrc) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
      }
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      let beg = s.pending;
      let left = (s.gzhead.extra.length & 65535) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
        beg = 0;
        left -= copy;
      }
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      strm.adler = 0;
    }
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
      }
      return Z_OK$3;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s);
      } else if (flush !== Z_BLOCK$1) {
        _tr_stored_block(s, 0, 0, false);
        if (flush === Z_FULL_FLUSH$1) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
  }
  if (flush !== Z_FINISH$3) {
    return Z_OK$3;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$3;
  }
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
};
const deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
};
const deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  const wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
    return Z_STREAM_ERROR$2;
  }
  if (wrap === 1) {
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      INSERT_STRING(s, str);
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$3;
};
var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2$1 = deflate$2;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = "pako deflate (from Nodeca project)";
var deflate_1$2 = {
  deflateInit: deflateInit_1,
  deflateInit2: deflateInit2_1,
  deflateReset: deflateReset_1,
  deflateResetKeep: deflateResetKeep_1,
  deflateSetHeader: deflateSetHeader_1,
  deflate: deflate_2$1,
  deflateEnd: deflateEnd_1,
  deflateSetDictionary: deflateSetDictionary_1,
  deflateInfo
};
const _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
var assign = function(obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) {
      continue;
    }
    if (typeof source !== "object") {
      throw new TypeError(source + "must be non-object");
    }
    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }
  return obj;
};
var flattenChunks = (chunks) => {
  let len = 0;
  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length;
  }
  const result = new Uint8Array(len);
  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i];
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var common = {
  assign,
  flattenChunks
};
let STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
const _utf8len = new Uint8Array(256);
for (let q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[255] = 1;
var string2buf = (str) => {
  if (typeof TextEncoder === "function" && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str);
  }
  let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + (c - 55296 << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
  }
  buf = new Uint8Array(buf_len);
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + (c - 55296 << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    if (c < 128) {
      buf[i++] = c;
    } else if (c < 2048) {
      buf[i++] = 192 | c >>> 6;
      buf[i++] = 128 | c & 63;
    } else if (c < 65536) {
      buf[i++] = 224 | c >>> 12;
      buf[i++] = 128 | c >>> 6 & 63;
      buf[i++] = 128 | c & 63;
    } else {
      buf[i++] = 240 | c >>> 18;
      buf[i++] = 128 | c >>> 12 & 63;
      buf[i++] = 128 | c >>> 6 & 63;
      buf[i++] = 128 | c & 63;
    }
  }
  return buf;
};
const buf2binstring = (buf, len) => {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }
  let result = "";
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
};
var buf2string = (buf, max) => {
  const len = max || buf.length;
  if (typeof TextDecoder === "function" && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max));
  }
  let i, out;
  const utf16buf = new Array(len * 2);
  for (out = 0, i = 0; i < len; ) {
    let c = buf[i++];
    if (c < 128) {
      utf16buf[out++] = c;
      continue;
    }
    let c_len = _utf8len[c];
    if (c_len > 4) {
      utf16buf[out++] = 65533;
      i += c_len - 1;
      continue;
    }
    c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i < len) {
      c = c << 6 | buf[i++] & 63;
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out++] = 65533;
      continue;
    }
    if (c < 65536) {
      utf16buf[out++] = c;
    } else {
      c -= 65536;
      utf16buf[out++] = 55296 | c >> 10 & 1023;
      utf16buf[out++] = 56320 | c & 1023;
    }
  }
  return buf2binstring(utf16buf, out);
};
var utf8border = (buf, max) => {
  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max;
  }
  if (pos === 0) {
    return max;
  }
  return pos + _utf8len[buf[pos]] > max ? pos : max;
};
var strings = {
  string2buf,
  buf2string,
  utf8border
};
function ZStream() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = "";
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
var zstream = ZStream;
const toString$1 = Object.prototype.toString;
const {
  Z_NO_FLUSH: Z_NO_FLUSH$1,
  Z_SYNC_FLUSH,
  Z_FULL_FLUSH,
  Z_FINISH: Z_FINISH$2,
  Z_OK: Z_OK$2,
  Z_STREAM_END: Z_STREAM_END$2,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFLATED: Z_DEFLATED$1
} = constants$2;
const defaultOptions$1 = {
  level: Z_DEFAULT_COMPRESSION,
  method: Z_DEFLATED$1,
  chunkSize: 16384,
  windowBits: 15,
  memLevel: 8,
  strategy: Z_DEFAULT_STRATEGY,
  legacyHash: true
};
function Deflate$1(options) {
  this.options = common.assign({}, defaultOptions$1, options || {});
  let opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = deflate_1$2.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy,
    opt.legacyHash
  );
  if (status !== Z_OK$2) {
    throw new Error(messages[status]);
  }
  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    let dict;
    if (typeof opt.dictionary === "string") {
      dict = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status = deflate_1$2.deflateSetDictionary(this.strm, dict);
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    this._dict_set = true;
  }
}
Deflate$1.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;
  if (this.ended) {
    return false;
  }
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
  if (typeof data === "string") {
    strm.input = strings.string2buf(data);
  } else if (toString$1.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    status = deflate_1$2.deflate(strm, _flush_mode);
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1$2.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$2;
    }
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Deflate$1.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Deflate$1.prototype.onEnd = function(status) {
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function deflate$1(input, options) {
  const deflator = new Deflate$1(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || messages[deflator.err];
  }
  return deflator.result;
}
var deflate_2 = deflate$1;
var deflate_1$1 = {
  deflate: deflate_2
};
const BAD$1 = 16209;
const TYPE$1 = 16191;
var inffast = function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op === 0) {
            output[_out++] = here & 65535;
          } else if (op & 16) {
            len = here & 65535;
            op &= 15;
            if (op) {
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op) - 1;
              hold >>>= op;
              bits -= op;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (; ; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op & 16) {
                  dist = here & 65535;
                  op &= 15;
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD$1;
                    break top;
                  }
                  hold >>>= op;
                  bits -= op;
                  op = _out - beg;
                  if (dist > op) {
                    op = dist - op;
                    if (op > whave) {
                      if (state.sane) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD$1;
                        break top;
                      }
                    }
                    from = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from += wsize - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op) {
                      from += wsize + wnext - op;
                      op -= wnext;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = 0;
                        if (wnext < len) {
                          op = wnext;
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from += wnext - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from++];
                      if (len > 1) {
                        output[_out++] = from_source[from++];
                      }
                    }
                  } else {
                    from = _out - dist;
                    do {
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from++];
                      if (len > 1) {
                        output[_out++] = output[from++];
                      }
                    }
                  }
                } else if ((op & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state.mode = BAD$1;
                  break top;
                }
                break;
              }
          } else if ((op & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dolen;
          } else if (op & 32) {
            state.mode = TYPE$1;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};
const MAXBITS = 15;
const ENOUGH_LENS$1 = 852;
const ENOUGH_DISTS$1 = 592;
const CODES$1 = 0;
const LENS$1 = 1;
const DISTS$1 = 2;
const lbase = new Uint16Array([
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
]);
const lext = new Uint8Array([
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  199,
  75
]);
const dbase = new Uint16Array([
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
]);
const dext = new Uint8Array([
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
]);
const inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0, max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let match;
  const count = new Uint16Array(MAXBITS + 1);
  const offs = new Uint16Array(MAXBITS + 1);
  let extra = null;
  let here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type === CODES$1) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;
  } else {
    base = dbase;
    extra = dext;
    match = 0;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
    return 1;
  }
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
        return 1;
      }
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }
  opts.bits = root;
  return 0;
};
var inftrees = inflate_table;
const CODES = 0;
const LENS = 1;
const DISTS = 2;
const {
  Z_FINISH: Z_FINISH$1,
  Z_BLOCK,
  Z_TREES,
  Z_OK: Z_OK$1,
  Z_STREAM_END: Z_STREAM_END$1,
  Z_NEED_DICT: Z_NEED_DICT$1,
  Z_STREAM_ERROR: Z_STREAM_ERROR$1,
  Z_DATA_ERROR: Z_DATA_ERROR$1,
  Z_MEM_ERROR: Z_MEM_ERROR$1,
  Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFLATED
} = constants$2;
const HEAD = 16180;
const FLAGS = 16181;
const TIME = 16182;
const OS = 16183;
const EXLEN = 16184;
const EXTRA = 16185;
const NAME = 16186;
const COMMENT = 16187;
const HCRC = 16188;
const DICTID = 16189;
const DICT = 16190;
const TYPE = 16191;
const TYPEDO = 16192;
const STORED = 16193;
const COPY_ = 16194;
const COPY = 16195;
const TABLE = 16196;
const LENLENS = 16197;
const CODELENS = 16198;
const LEN_ = 16199;
const LEN = 16200;
const LENEXT = 16201;
const DIST = 16202;
const DISTEXT = 16203;
const MATCH = 16204;
const LIT = 16205;
const CHECK = 16206;
const LENGTH = 16207;
const DONE = 16208;
const BAD = 16209;
const MEM = 16210;
const SYNC = 16211;
const ENOUGH_LENS = 852;
const ENOUGH_DISTS = 592;
const MAX_WBITS = 15;
const DEF_WBITS = MAX_WBITS;
const zswap32 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
function InflateState() {
  this.strm = null;
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new Uint16Array(320);
  this.work = new Uint16Array(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
const inflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
    return 1;
  }
  return 0;
};
const inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) {
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return Z_OK$1;
};
const inflateReset = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
const inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};
const inflateInit2 = (strm, windowBits) => {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  const state = new InflateState();
  strm.state = state;
  state.strm = strm;
  state.window = null;
  state.mode = HEAD;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$1) {
    strm.state = null;
  }
  return ret;
};
const inflateInit = (strm) => {
  return inflateInit2(strm, DEF_WBITS);
};
let virgin = true;
let lenfix, distfix;
const fixedtables = (state) => {
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);
    let sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }
    inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }
    inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};
const updatewindow = (strm, src, end, copy) => {
  let dist;
  const state = strm.state;
  if (state.window === null) {
    state.window = new Uint8Array(1 << state.wbits);
  }
  if (state.wsize === 0) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
  }
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
};
const inflate$2 = (strm, flush) => {
  let state;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = new Uint8Array(4);
  let opts;
  let n;
  const order = (
    /* permutation of code lengths */
    new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
  );
  if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.mode === TYPE) {
    state.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = Z_OK$1;
  inf_leave:
    for (; ; ) {
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            if (state.wbits === 0) {
              state.wbits = 15;
            }
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
          (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD;
            break;
          }
          if ((hold & 15) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          }
          if (len > 15 || len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << state.wbits;
          state.flags = 0;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD;
            break;
          }
          if (state.head) {
            state.head.text = hold >> 8 & 1;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        case TIME:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32_1(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        case OS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head) {
            state.head.extra = null;
          }
          state.mode = EXTRA;
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  state.head.extra = new Uint8Array(state.head.extra_len);
                }
                state.head.extra.set(
                  input.subarray(
                    next,
                    // extra field is limited to 65536 bytes
                    // - no need for additional size check
                    next + copy
                  ),
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
              }
              if (state.flags & 512 && state.wrap & 4) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
        case NAME:
          if (state.flags & 2048) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return Z_NEED_DICT$1;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE;
        case TYPE:
          if (flush === Z_BLOCK || flush === Z_TREES) {
            break inf_leave;
          }
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === Z_TREES) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case COPY_:
          state.mode = COPY;
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            output.set(input.subarray(next, next + copy), put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }
          if (state.mode === BAD) {
            break;
          }
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD;
            break;
          }
          state.mode = LEN_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case LEN_:
          state.mode = LEN;
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inffast(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (; ; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        case LENEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        case DIST:
          for (; ; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        case DISTEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
          state.mode = MATCH;
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (state.wrap & 4 && _out) {
              strm.adler = state.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
              state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
            }
            _out = left;
            if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        case DONE:
          ret = Z_STREAM_END$1;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR$1;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR$1;
        case SYNC:
        default:
          return Z_STREAM_ERROR$1;
      }
    }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH$1)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap & 4 && _out) {
    strm.adler = state.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
    state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR$1;
  }
  return ret;
};
const inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  let state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK$1;
};
const inflateGetHeader = (strm, head) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR$1;
  }
  state.head = head;
  head.done = false;
  return Z_OK$1;
};
const inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR$1;
  }
  state.havedict = 1;
  return Z_OK$1;
};
var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2$1 = inflate$2;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = "pako inflate (from Nodeca project)";
var inflate_1$2 = {
  inflateReset: inflateReset_1,
  inflateReset2: inflateReset2_1,
  inflateResetKeep: inflateResetKeep_1,
  inflateInit: inflateInit_1,
  inflateInit2: inflateInit2_1,
  inflate: inflate_2$1,
  inflateEnd: inflateEnd_1,
  inflateGetHeader: inflateGetHeader_1,
  inflateSetDictionary: inflateSetDictionary_1,
  inflateInfo
};
function GZheader() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = "";
  this.comment = "";
  this.hcrc = 0;
  this.done = false;
}
var gzheader = GZheader;
const toString = Object.prototype.toString;
const {
  Z_NO_FLUSH,
  Z_FINISH,
  Z_OK,
  Z_STREAM_END,
  Z_NEED_DICT,
  Z_STREAM_ERROR,
  Z_DATA_ERROR,
  Z_MEM_ERROR,
  Z_BUF_ERROR
} = constants$2;
const defaultOptions = {
  chunkSize: 1024 * 64,
  windowBits: 15,
  to: ""
};
function Inflate$1(options) {
  this.options = common.assign({}, defaultOptions, options || {});
  const opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = inflate_1$2.inflateInit2(
    this.strm,
    opt.windowBits
  );
  if (status !== Z_OK) {
    throw new Error(messages[status]);
  }
  this.header = new gzheader();
  inflate_1$2.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === "string") {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK) {
        throw new Error(messages[status]);
      }
    }
  }
}
Inflate$1.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;
  if (this.ended) return false;
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
  if (toString.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = inflate_1$2.inflate(strm, _flush_mode);
    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary);
      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR) {
        status = Z_NEED_DICT;
      }
    }
    while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap & 2 && strm.state.flags !== 0 && strm.input[strm.next_in] !== 0) {
      inflate_1$2.inflateReset(strm);
      status = inflate_1$2.inflate(strm, _flush_mode);
    }
    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status);
        this.ended = true;
        return false;
    }
    last_avail_out = strm.avail_out;
    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END || _flush_mode > 0) {
        if (this.options.to === "string") {
          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
          this.onData(utf8str);
        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
          strm.avail_out = 0;
          strm.next_out = 0;
        }
      }
    }
    if ((status === Z_OK || status === Z_BUF_ERROR) && last_avail_out === 0) continue;
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }
    if (strm.avail_in === 0) {
      if (_flush_mode === Z_FINISH) {
        status = inflate_1$2.inflateEnd(this.strm);
        this.onEnd(status === Z_OK ? Z_BUF_ERROR : status);
        this.ended = true;
        return false;
      }
      break;
    }
  }
  return true;
};
Inflate$1.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Inflate$1.prototype.onEnd = function(status) {
  if (status === Z_OK) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
var Inflate_1$1 = Inflate$1;
var inflate_1$1 = {
  Inflate: Inflate_1$1
};
const { deflate } = deflate_1$1;
const { Inflate } = inflate_1$1;
var deflate_1 = deflate;
var Inflate_1 = Inflate;
function padTo(data, alignment, padCharacter = 255) {
  const padMod = data.length % alignment;
  if (padMod !== 0) {
    const padding = new Uint8Array(alignment - padMod).fill(padCharacter);
    const paddedData = new Uint8Array(data.length + padding.length);
    paddedData.set(data);
    paddedData.set(padding, data.length);
    return paddedData;
  }
  return data;
}
const ESP_CHECKSUM_MAGIC = 239;
function checksum(data, state = ESP_CHECKSUM_MAGIC) {
  for (let i = 0; i < data.length; i++) {
    state ^= data[i];
  }
  return state;
}
function bstrToUi8(bStr) {
  const u8Array = new Uint8Array(bStr.length);
  for (let i = 0; i < bStr.length; i++) {
    u8Array[i] = bStr.charCodeAt(i);
  }
  return u8Array;
}
function sleep$1(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
class Transport {
  constructor(device, tracing = false, enableSlipReader = true) {
    this.device = device;
    this.tracing = tracing;
    this.slipReaderEnabled = false;
    this.baudrate = 0;
    this.traceLog = "";
    this.lastTraceTime = Date.now();
    this.buffer = new Uint8Array(0);
    this.onDeviceLostCallback = null;
    this.SLIP_END = 192;
    this.SLIP_ESC = 219;
    this.SLIP_ESC_END = 220;
    this.SLIP_ESC_ESC = 221;
    this._DTR_state = false;
    this.slipReaderEnabled = enableSlipReader;
  }
  /**
   * Set callback for when device is lost
   * @param {Function} callback Function to call when device is lost
   */
  setDeviceLostCallback(callback) {
    this.onDeviceLostCallback = callback;
  }
  /**
   * Update the device reference (used when re-selecting device after reset)
   * @param {typeof import("w3c-web-serial").SerialPort} newDevice New SerialPort device
   */
  updateDevice(newDevice) {
    this.device = newDevice;
    this.trace("Device reference updated");
  }
  /**
   * Request the serial device vendor ID and Product ID as string.
   * @returns {string} Return the device VendorID and ProductID from SerialPortInfo as formatted string.
   */
  getInfo() {
    const info = this.device.getInfo();
    return info.usbVendorId && info.usbProductId ? `WebSerial VendorID 0x${info.usbVendorId.toString(16)} ProductID 0x${info.usbProductId.toString(16)}` : "";
  }
  /**
   * Request the serial device product id from SerialPortInfo.
   * @returns {number | undefined} Return the product ID.
   */
  getPid() {
    return this.device.getInfo().usbProductId;
  }
  /**
   * Format received or sent data for tracing output.
   * @param {string} message Message to format as trace line.
   */
  trace(message) {
    const delta = Date.now() - this.lastTraceTime;
    const prefix = `TRACE ${delta.toFixed(3)}`;
    const traceMessage = `${prefix} ${message}`;
    console.log(traceMessage);
    this.traceLog += traceMessage + "\n";
  }
  async returnTrace() {
    try {
      await navigator.clipboard.writeText(this.traceLog);
      console.log("Text copied to clipboard!");
    } catch (err2) {
      console.error("Failed to copy text:", err2);
    }
  }
  hexify(s) {
    return Array.from(s).map((byte) => byte.toString(16).padStart(2, "0")).join("").padEnd(16, " ");
  }
  hexConvert(uint8Array, autoSplit = true) {
    if (autoSplit && uint8Array.length > 16) {
      let result = "";
      let s = uint8Array;
      while (s.length > 0) {
        const line = s.slice(0, 16);
        const asciiLine = String.fromCharCode(...line).split("").map((c) => c === " " || c >= " " && c <= "~" && c !== "  " ? c : ".").join("");
        s = s.slice(16);
        result += `
    ${this.hexify(line.slice(0, 8))} ${this.hexify(line.slice(8))} | ${asciiLine}`;
      }
      return result;
    } else {
      return this.hexify(uint8Array);
    }
  }
  /**
   * Format data packet using the Serial Line Internet Protocol (SLIP).
   * @param {Uint8Array} data Binary unsigned 8 bit array data to format.
   * @returns {Uint8Array} Formatted unsigned 8 bit data array.
   */
  slipWriter(data) {
    const outData = [];
    outData.push(192);
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 219) {
        outData.push(219, 221);
      } else if (data[i] === 192) {
        outData.push(219, 220);
      } else {
        outData.push(data[i]);
      }
    }
    outData.push(192);
    return new Uint8Array(outData);
  }
  /**
   * Write binary data to device using the WebSerial device writable stream.
   * @param {Uint8Array} data 8 bit unsigned data array to write to device.
   */
  async write(data) {
    const outData = this.slipWriter(data);
    if (this.device.writable) {
      const writer = this.device.writable.getWriter();
      if (this.tracing) {
        this.trace(`Write ${outData.length} bytes: ${this.hexConvert(outData)}`);
      }
      await writer.write(outData);
      writer.releaseLock();
    }
  }
  /**
   * Append a buffer array after another buffer array
   * @param {Uint8Array} arr1 - First array buffer.
   * @param {Uint8Array} arr2 - magic hex number to select ROM.
   * @returns {Uint8Array} Return a 8 bit unsigned array.
   */
  appendArray(arr1, arr2) {
    const combined = new Uint8Array(arr1.length + arr2.length);
    combined.set(arr1);
    combined.set(arr2, arr1.length);
    return combined;
  }
  /**
   * Read from serial device and append to buffer
   */
  async readLoop() {
    var _a;
    while (this.device.readable) {
      this.reader = (_a = this.device.readable) === null || _a === void 0 ? void 0 : _a.getReader();
      try {
        const { value, done } = await this.reader.read();
        if (done) {
          this.trace(`Serial port done`);
          break;
        }
        if (value && value.length) {
          const newValue = Uint8Array.from(value);
          this.buffer = this.appendArray(this.buffer, newValue);
        }
      } catch (error) {
        if (error instanceof Error) {
          const nonFatal = ["BufferOverrunError", "FramingError", "BreakError", "ParityError"];
          if (nonFatal.includes(error.name)) {
            this.trace(`Recoverable serial port error: ${error.message}`);
            continue;
          }
          this.trace(`Unrecoverable serial port error: ${error.message}`);
          break;
        }
        if (error instanceof DOMException) {
          if (this.onDeviceLostCallback) {
            this.onDeviceLostCallback();
          } else {
            this.trace(`Unrecoverable serial port error: ${error.message}`);
          }
          break;
        }
        this.trace(`Unrecoverable serial port error: ${error}`);
        break;
      } finally {
        this.reader.releaseLock();
      }
    }
    this.trace(`readLoop exited`);
  }
  flushInput() {
    this.buffer = new Uint8Array(0);
  }
  async flushOutput() {
    try {
      if (this.device.writable) {
        const writer = this.device.writable.getWriter();
        await writer.close();
        writer.releaseLock();
      }
    } catch (error) {
      this.trace(`Error while flushing output: ${error}`);
    }
  }
  // `inWaiting` returns the count of bytes in the buffer
  inWaiting() {
    return this.buffer.length;
  }
  // peek at the buffer without removing the data from the buffer
  peek() {
    return this.buffer;
  }
  /**
   * Detect if the data read from device is a Fatal or Guru meditation error.
   * @param {Uint8Array} input Data read from device
   */
  detectPanicHandler(input) {
    const guruMeditationRegex = /G?uru Meditation Error: (?:Core \d panic'ed \(([a-zA-Z ]*)\))?/;
    const fatalExceptionRegex = /F?atal exception \(\d+\): (?:([a-zA-Z ]*)?.*epc)?/;
    const inputString = new TextDecoder("utf-8").decode(input);
    const match = inputString.match(guruMeditationRegex) || inputString.match(fatalExceptionRegex);
    if (match) {
      const cause = match[1] || match[2];
      const msg = `Guru Meditation Error detected${cause ? ` (${cause})` : ""}`;
      throw new Error(msg);
    }
  }
  /**
   * Take a data array and return the first well formed packet after
   * replacing the escape sequence. Reads at least 8 bytes.
   * @param {number} timeout Timeout read data.
   * @returns {Uint8Array} Formatted packet using SLIP escape sequences.
   */
  async read(timeout) {
    let partialPacket = null;
    let isEscaping = false;
    let readBytes = null;
    while (true) {
      const timeStamp = Date.now();
      readBytes = new Uint8Array(0);
      while (Date.now() - timeStamp < timeout) {
        if (this.buffer.length > 0) {
          readBytes = this.buffer;
          this.buffer = new Uint8Array(0);
          break;
        } else {
          await sleep$1(1);
        }
      }
      if (!readBytes || readBytes.length === 0) {
        const msg = partialPacket === null ? "Serial data stream stopped: Possible serial noise or corruption." : "No serial data received.";
        if (this.tracing) {
          this.trace(msg);
        }
        throw new Error(msg);
      }
      if (this.tracing) {
        this.trace(`Read ${readBytes.length} bytes: ${this.hexConvert(readBytes)}`);
      }
      for (let i = 0; i < readBytes.length; i++) {
        const byte = readBytes[i];
        if (partialPacket === null) {
          if (byte === this.SLIP_END) {
            partialPacket = new Uint8Array(0);
          } else {
            if (this.tracing) {
              this.trace(`Read invalid data: ${this.hexConvert(readBytes)}`);
            }
            const remainingData = this.buffer;
            if (this.tracing) {
              this.trace(`Remaining data in serial buffer: ${this.hexConvert(remainingData)}`);
            }
            this.detectPanicHandler(new Uint8Array([...readBytes, ...remainingData || []]));
            throw new Error(`Invalid head of packet (0x${byte.toString(16)}): Possible serial noise or corruption.`);
          }
        } else if (isEscaping) {
          isEscaping = false;
          if (byte === this.SLIP_ESC_END) {
            partialPacket = this.appendArray(partialPacket, new Uint8Array([this.SLIP_END]));
          } else if (byte === this.SLIP_ESC_ESC) {
            partialPacket = this.appendArray(partialPacket, new Uint8Array([this.SLIP_ESC]));
          } else {
            if (this.tracing) {
              this.trace(`Read invalid data: ${this.hexConvert(readBytes)}`);
            }
            const remainingData = this.buffer;
            if (this.tracing) {
              this.trace(`Remaining data in serial buffer: ${this.hexConvert(remainingData)}`);
            }
            this.detectPanicHandler(new Uint8Array([...readBytes, ...remainingData || []]));
            throw new Error(`Invalid SLIP escape (0xdb, 0x${byte.toString(16)})`);
          }
        } else if (byte === this.SLIP_ESC) {
          isEscaping = true;
        } else if (byte === this.SLIP_END) {
          if (this.tracing) {
            this.trace(`Received full packet: ${this.hexConvert(partialPacket)}`);
          }
          if (i + 1 < readBytes.length) {
            const remainingBytes = readBytes.slice(i + 1);
            this.buffer = this.appendArray(remainingBytes, this.buffer);
          }
          return partialPacket;
        } else {
          partialPacket = this.appendArray(partialPacket, new Uint8Array([byte]));
        }
      }
    }
  }
  /**
   * Read from serial device without SLIP formatting. Calls onData for each chunk.
   * Stops when isClosed() returns true or the stream ends/errors.
   * @param {Function} onData Callback for each chunk of data read
   * @param {Function} isClosed Function that returns true when reading should stop (e.g. when console is closed)
   */
  async rawRead(onData, isClosed) {
    let reader;
    try {
      if (!this.device.readable) {
        return;
      }
      reader = this.device.readable.getReader();
      while (!isClosed()) {
        const { value, done } = await reader.read();
        if (done || !value)
          break;
        if (this.tracing) {
          this.trace(`Read ${value.length} bytes: ${this.hexConvert(value)}`);
        }
        onData(value);
      }
    } catch (error) {
      this.trace(`Error reading from serial port: ${error}`);
      if (error instanceof Error && error.name === "NetworkError" && error.message.includes("device has been lost")) {
        this.trace("Device lost detected (NetworkError)");
        if (this.onDeviceLostCallback) {
          this.onDeviceLostCallback();
        }
      }
    } finally {
      reader === null || reader === void 0 ? void 0 : reader.releaseLock();
    }
  }
  /**
   * Send the RequestToSend (RTS) signal to given state
   * # True for EN=LOW, chip in reset and False EN=HIGH, chip out of reset
   * @param {boolean} state Boolean state to set the signal
   */
  async setRTS(state) {
    await this.device.setSignals({ requestToSend: state });
    await this.setDTR(this._DTR_state);
  }
  /**
   * Send the dataTerminalReady (DTS) signal to given state
   * # True for IO0=LOW, chip in reset and False IO0=HIGH
   * @param {boolean} state Boolean state to set the signal
   */
  async setDTR(state) {
    this._DTR_state = state;
    await this.device.setSignals({ dataTerminalReady: state });
  }
  /**
   * Connect to serial device using the Webserial open method.
   * @param {number} baud Number baud rate for serial connection. Default is 115200.
   * @param {typeof import("w3c-web-serial").SerialOptions} serialOptions Serial Options for WebUSB SerialPort class.
   */
  async connect(baud = 115200, serialOptions = {}) {
    await this.device.open({
      baudRate: baud,
      dataBits: serialOptions === null || serialOptions === void 0 ? void 0 : serialOptions.dataBits,
      stopBits: serialOptions === null || serialOptions === void 0 ? void 0 : serialOptions.stopBits,
      bufferSize: serialOptions === null || serialOptions === void 0 ? void 0 : serialOptions.bufferSize,
      parity: serialOptions === null || serialOptions === void 0 ? void 0 : serialOptions.parity,
      flowControl: serialOptions === null || serialOptions === void 0 ? void 0 : serialOptions.flowControl
    });
    this.baudrate = baud;
  }
  /**
   * Wait for a given timeout ms for serial device unlock.
   * @param {number} timeout Timeout time in milliseconds (ms) to sleep
   */
  async waitForUnlock(timeout) {
    while (this.device.readable && this.device.readable.locked || this.device.writable && this.device.writable.locked) {
      await sleep$1(timeout);
    }
  }
  /**
   * Disconnect from serial device by running SerialPort.close() after streams unlock.
   */
  async disconnect() {
    var _a, _b;
    if ((_a = this.device.readable) === null || _a === void 0 ? void 0 : _a.locked) {
      await ((_b = this.reader) === null || _b === void 0 ? void 0 : _b.cancel());
    }
    await this.waitForUnlock(400);
    await this.device.close();
    this.reader = void 0;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
class ClassicReset {
  constructor(transport, resetDelay) {
    this.resetDelay = resetDelay;
    this.transport = transport;
  }
  async reset() {
    await this.transport.setDTR(false);
    await this.transport.setRTS(true);
    await sleep(100);
    await this.transport.setDTR(true);
    await this.transport.setRTS(false);
    await sleep(this.resetDelay);
    await this.transport.setDTR(false);
  }
}
class UsbJtagSerialReset {
  constructor(transport) {
    this.transport = transport;
  }
  async reset() {
    await this.transport.setRTS(false);
    await this.transport.setDTR(false);
    await sleep(100);
    await this.transport.setDTR(true);
    await this.transport.setRTS(false);
    await sleep(100);
    await this.transport.setRTS(true);
    await this.transport.setDTR(false);
    await this.transport.setRTS(true);
    await sleep(100);
    await this.transport.setRTS(false);
    await this.transport.setDTR(false);
  }
}
class HardReset {
  constructor(transport, usingUsbOtg = false) {
    this.transport = transport;
    this.usingUsbOtg = usingUsbOtg;
    this.transport = transport;
  }
  async reset() {
    if (this.usingUsbOtg) {
      await sleep(200);
      await this.transport.setRTS(false);
      await sleep(200);
    } else {
      await sleep(100);
      await this.transport.setRTS(false);
    }
  }
}
function validateCustomResetStringSequence(seqStr) {
  const commands = ["D", "R", "W"];
  const commandsList = seqStr.split("|");
  for (const cmd of commandsList) {
    const code = cmd[0];
    const arg = cmd.slice(1);
    if (!commands.includes(code)) {
      return false;
    }
    if (code === "D" || code === "R") {
      if (arg !== "0" && arg !== "1") {
        return false;
      }
    } else if (code === "W") {
      const delay = parseInt(arg);
      if (isNaN(delay) || delay <= 0) {
        return false;
      }
    }
  }
  return true;
}
class CustomReset {
  constructor(transport, sequenceString) {
    this.transport = transport;
    this.sequenceString = sequenceString;
    this.transport = transport;
  }
  async reset() {
    const resetDictionary = {
      D: async (arg) => await this.transport.setDTR(arg),
      R: async (arg) => await this.transport.setRTS(arg),
      W: async (delay) => await sleep(delay)
    };
    try {
      const isValidSequence = validateCustomResetStringSequence(this.sequenceString);
      if (!isValidSequence) {
        return;
      }
      const cmds = this.sequenceString.split("|");
      for (const cmd of cmds) {
        const cmdKey = cmd[0];
        const cmdVal = cmd.slice(1);
        if (cmdKey === "W") {
          await resetDictionary["W"](Number(cmdVal));
        } else if (cmdKey === "D" || cmdKey === "R") {
          await resetDictionary[cmdKey](cmdVal === "1");
        }
      }
    } catch (error) {
      throw new Error("Invalid custom reset sequence");
    }
  }
}
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var atobNode = function atob(str) {
  return Buffer.from(str, "base64").toString("binary");
};
const atob2 = /* @__PURE__ */ getDefaultExportFromCjs(atobNode);
async function getStubJsonByChipName(chipName, chipRevision) {
  let jsonStub;
  switch (chipName) {
    case "ESP32":
      jsonStub = await import("./stub_flasher_32-BMj1xGIg.js");
      break;
    case "ESP32-C2":
      jsonStub = await import("./stub_flasher_32c2-Dd1zqhFK.js");
      break;
    case "ESP32-C3":
      jsonStub = await import("./stub_flasher_32c3-INRttRNq.js");
      break;
    case "ESP32-C5":
      jsonStub = await import("./stub_flasher_32c5-C7TLFaBY.js");
      break;
    case "ESP32-C6":
      jsonStub = await import("./stub_flasher_32c6-BvXEc5tg.js");
      break;
    case "ESP32-C61":
      jsonStub = await import("./stub_flasher_32c61-CVW8oO-i.js");
      break;
    case "ESP32-H2":
      jsonStub = await import("./stub_flasher_32h2-CD7XcbRG.js");
      break;
    case "ESP32-P4":
      if (chipRevision && chipRevision < 300) {
        jsonStub = await import("./stub_flasher_32p4rc1-S0Ynhkw0.js");
      } else {
        jsonStub = await import("./stub_flasher_32p4-r8Wuesc3.js");
      }
      break;
    case "ESP32-S2":
      jsonStub = await import("./stub_flasher_32s2-BFFKWDjY.js");
      break;
    case "ESP32-S3":
      jsonStub = await import("./stub_flasher_32s3-CVHZHys1.js");
      break;
    case "ESP8266":
      jsonStub = await import("./stub_flasher_8266-Bo4tabB5.js");
      break;
  }
  if (jsonStub) {
    return {
      bss_start: jsonStub.bss_start,
      data: jsonStub.data,
      data_start: jsonStub.data_start,
      entry: jsonStub.entry,
      text: jsonStub.text,
      text_start: jsonStub.text_start,
      decodedData: decodeBase64Data(jsonStub.data),
      decodedText: decodeBase64Data(jsonStub.text)
    };
  }
  return;
}
function decodeBase64Data(dataStr) {
  const decoded = atob2(dataStr);
  const chardata = decoded.split("").map(function(x) {
    return x.charCodeAt(0);
  });
  return new Uint8Array(chardata);
}
class ROM {
  constructor() {
    this.FLASH_SIZES = {
      "1MB": 0,
      "2MB": 16,
      "4MB": 32,
      "8MB": 48,
      "16MB": 64,
      "32MB": 80,
      "64MB": 96,
      "128MB": 112
    };
    this.FLASH_FREQUENCY = {
      "80m": 15,
      "40m": 0,
      "26m": 1,
      "20m": 2
    };
  }
  /**
   * Get the chip erase size.
   * @param {number} offset - Offset to start erase.
   * @param {number} size - Size to erase.
   * @returns {number} The erase size of the chip as number.
   */
  getEraseSize(offset, size) {
    return size;
  }
}
class ESP8266ROM extends ROM {
  constructor() {
    super(...arguments);
    this.CHIP_NAME = "ESP8266";
    this.CHIP_DETECT_MAGIC_VALUE = [4293968129];
    this.EFUSE_RD_REG_BASE = 1072693328;
    this.UART_CLKDIV_REG = 1610612756;
    this.UART_CLKDIV_MASK = 1048575;
    this.XTAL_CLK_DIVIDER = 2;
    this.FLASH_WRITE_SIZE = 16384;
    this.BOOTLOADER_FLASH_OFFSET = 0;
    this.UART_DATE_REG_ADDR = 0;
    this.FLASH_SIZES = {
      "512KB": 0,
      "256KB": 16,
      "1MB": 32,
      "2MB": 48,
      "4MB": 64,
      "2MB-c1": 80,
      "4MB-c1": 96,
      "8MB": 128,
      "16MB": 144
    };
    this.FLASH_FREQUENCY = {
      "80m": 15,
      "40m": 0,
      "26m": 1,
      "20m": 2
    };
    this.MEMORY_MAP = [
      [1072693248, 1072693264, "DPORT"],
      [1073643520, 1073741824, "DRAM"],
      [1074790400, 1074823168, "IRAM"],
      [1075843088, 1076760592, "IROM"]
    ];
    this.SPI_REG_BASE = 1610613248;
    this.SPI_USR_OFFS = 28;
    this.SPI_USR1_OFFS = 32;
    this.SPI_USR2_OFFS = 36;
    this.SPI_MOSI_DLEN_OFFS = 0;
    this.SPI_MISO_DLEN_OFFS = 0;
    this.SPI_W0_OFFS = 64;
    this.getChipFeatures = async (loader) => {
      const features = ["WiFi"];
      if (await this.getChipDescription(loader) == "ESP8285")
        features.push("Embedded Flash");
      return features;
    };
  }
  async readEfuse(loader, offset) {
    const addr = this.EFUSE_RD_REG_BASE + 4 * offset;
    loader.debug("Read efuse " + addr);
    return await loader.readReg(addr);
  }
  async getChipDescription(loader) {
    const efuse3 = await this.readEfuse(loader, 2);
    const efuse0 = await this.readEfuse(loader, 0);
    const is8285 = (efuse0 & 1 << 4 | efuse3 & 1 << 16) != 0;
    return is8285 ? "ESP8285" : "ESP8266EX";
  }
  async getCrystalFreq(loader) {
    const uartDiv = await loader.readReg(this.UART_CLKDIV_REG) & this.UART_CLKDIV_MASK;
    const etsXtal = loader.transport.baudrate * uartDiv / 1e6 / this.XTAL_CLK_DIVIDER;
    let normXtal;
    if (etsXtal > 33) {
      normXtal = 40;
    } else {
      normXtal = 26;
    }
    if (Math.abs(normXtal - etsXtal) > 1) {
      loader.info("WARNING: Detected crystal freq " + etsXtal + "MHz is quite different to normalized freq " + normXtal + "MHz. Unsupported crystal in use?");
    }
    return normXtal;
  }
  _d2h(d) {
    const h = (+d).toString(16);
    return h.length === 1 ? "0" + h : h;
  }
  async readMac(loader) {
    let mac0 = await this.readEfuse(loader, 0);
    mac0 = mac0 >>> 0;
    let mac1 = await this.readEfuse(loader, 1);
    mac1 = mac1 >>> 0;
    let mac3 = await this.readEfuse(loader, 3);
    mac3 = mac3 >>> 0;
    const mac = new Uint8Array(6);
    if (mac3 != 0) {
      mac[0] = mac3 >> 16 & 255;
      mac[1] = mac3 >> 8 & 255;
      mac[2] = mac3 & 255;
    } else if ((mac1 >> 16 & 255) == 0) {
      mac[0] = 24;
      mac[1] = 254;
      mac[2] = 52;
    } else if ((mac1 >> 16 & 255) == 1) {
      mac[0] = 172;
      mac[1] = 208;
      mac[2] = 116;
    } else {
      loader.error("Unknown OUI");
    }
    mac[3] = mac1 >> 8 & 255;
    mac[4] = mac1 & 255;
    mac[5] = mac0 >> 24 & 255;
    return this._d2h(mac[0]) + ":" + this._d2h(mac[1]) + ":" + this._d2h(mac[2]) + ":" + this._d2h(mac[3]) + ":" + this._d2h(mac[4]) + ":" + this._d2h(mac[5]);
  }
  getEraseSize(offset, size) {
    return size;
  }
}
ESP8266ROM.IROM_MAP_START = 1075838976;
ESP8266ROM.IROM_MAP_END = 1076887552;
const esp8266 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ESP8266ROM
}, Symbol.toStringTag, { value: "Module" }));
const ESP_IMAGE_MAGIC = 233;
function alignFilePosition(position, size) {
  const align = size - 1 - position % size;
  return position + align;
}
function readUInt32LE(data, offset) {
  return data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24;
}
class ImageSegment {
  constructor(addr, data, fileOffs = null, flags = 0) {
    this.addr = addr;
    this.data = data;
    this.fileOffs = fileOffs;
    this.flags = flags;
    this.includeInChecksum = true;
    if (this.addr !== 0) {
      this.padToAlignment(4);
    }
  }
  copyWithNewAddr(newAddr) {
    return new ImageSegment(newAddr, this.data, 0);
  }
  splitImage(splitLen) {
    const result = new ImageSegment(this.addr, this.data.slice(0, splitLen), 0);
    this.data = this.data.slice(splitLen);
    this.addr += splitLen;
    this.fileOffs = null;
    return result;
  }
  toString() {
    let r = `len 0x${this.data.length.toString(16).padStart(5, "0")} load 0x${this.addr.toString(16).padStart(8, "0")}`;
    if (this.fileOffs !== null) {
      r += ` file_offs 0x${this.fileOffs.toString(16).padStart(8, "0")}`;
    }
    return r;
  }
  getMemoryType(image) {
    return image.ROM_LOADER.MEMORY_MAP.filter((mapRange) => mapRange[0] <= this.addr && this.addr < mapRange[1]).map((mapRange) => mapRange[2]);
  }
  padToAlignment(alignment) {
    this.data = padTo(this.data, alignment, 0);
  }
}
class ELFSection extends ImageSegment {
  constructor(name, addr, data, flags) {
    super(addr, data, null, flags);
    this.name = name;
  }
  toString() {
    return `${this.name} ${super.toString()}`;
  }
}
class BaseFirmwareImage {
  constructor(rom) {
    this.SEG_HEADER_LEN = 8;
    this.SHA256_DIGEST_LEN = 32;
    this.ELF_FLAG_WRITE = 1;
    this.ELF_FLAG_READ = 2;
    this.ELF_FLAG_EXEC = 4;
    this.segments = [];
    this.entrypoint = 0;
    this.elfSha256 = null;
    this.elfSha256Offset = 0;
    this.padToSize = 0;
    this.flashMode = 0;
    this.flashSizeFreq = 0;
    this.checksum = 0;
    this.datalength = 0;
    this.IROM_ALIGN = 0;
    this.MMU_PAGE_SIZE_CONF = [];
    this.ROM_LOADER = rom;
  }
  loadCommonHeader(data, offset, expectedMagic) {
    const magic = data[offset];
    const segments = data[offset + 1];
    this.flashMode = data[offset + 2];
    this.flashSizeFreq = data[offset + 3];
    this.entrypoint = readUInt32LE(data, offset + 4);
    if (magic !== expectedMagic) {
      throw new ESPError(`Invalid firmware image magic=0x${magic.toString(16)}`);
    }
    return segments;
  }
  verify() {
    if (this.segments.length > 16) {
      throw new ESPError(`Invalid segment count ${this.segments.length} (max 16). Usually this indicates a linker script problem.`);
    }
  }
  loadSegment(data, offset, isIromSegment = false) {
    const fileOffs = offset;
    const segmentAddr = readUInt32LE(data, offset);
    const segmentSize = readUInt32LE(data, offset + 4);
    this.warnIfUnusualSegment(segmentAddr, segmentSize, isIromSegment);
    const segmentData = data.slice(offset + 8, offset + 8 + segmentSize);
    if (segmentData.length < segmentSize) {
      throw new ESPError(`End of file reading segment 0x${segmentAddr.toString(16)}, length ${segmentSize} (actual length ${segmentData.length})`);
    }
    const segment = new ImageSegment(segmentAddr, segmentData, fileOffs);
    this.segments.push(segment);
    return segment;
  }
  warnIfUnusualSegment(offset, size, isIromSegment) {
    if (!isIromSegment) {
      if (offset > 1075838976 || offset < 1073610752 || size > 65536) {
        console.warn(`WARNING: Suspicious segment 0x${offset.toString(16)}, length ${size}`);
      }
    }
  }
  maybePatchSegmentData(data, filePos) {
    const segmentLen = data.length;
    if (this.elfSha256Offset >= filePos && this.elfSha256Offset < filePos + segmentLen) {
      const patchOffset = this.elfSha256Offset - filePos;
      if (patchOffset < this.SEG_HEADER_LEN || patchOffset + this.SHA256_DIGEST_LEN > segmentLen) {
        throw new ESPError(`Cannot place SHA256 digest on segment boundary(elf_sha256_offset=${this.elfSha256Offset}, file_pos=${filePos}, segment_size=${segmentLen})`);
      }
      const dataPatchOffset = patchOffset - this.SEG_HEADER_LEN;
      const targetArea = data.slice(dataPatchOffset, dataPatchOffset + this.SHA256_DIGEST_LEN);
      const isAllZeros = targetArea.every((byte) => byte === 0);
      if (!isAllZeros) {
        throw new ESPError(`Contents of segment at SHA256 digest offset 0x${this.elfSha256Offset.toString(16)} are not all zero. Refusing to overwrite.`);
      }
      if (!this.elfSha256 || this.elfSha256.length !== this.SHA256_DIGEST_LEN) {
        throw new ESPError("ELF SHA256 digest is not properly initialized");
      }
      const beforePatch = data.slice(0, dataPatchOffset);
      const afterPatch = data.slice(dataPatchOffset + this.SHA256_DIGEST_LEN);
      const newLength = beforePatch.length + this.elfSha256.length + afterPatch.length;
      const result = new Uint8Array(newLength);
      result.set(beforePatch, 0);
      result.set(this.elfSha256, beforePatch.length);
      result.set(afterPatch, beforePatch.length + this.elfSha256.length);
      return result;
    }
    return data;
  }
  saveSegment(output, offset, segment, checksumValue = null) {
    const segmentData = this.maybePatchSegmentData(segment.data, offset);
    const view = new DataView(output.buffer, offset);
    view.setUint32(0, segment.addr, true);
    view.setUint32(4, segmentData.length, true);
    output.set(segmentData, offset + 8);
    if (checksumValue !== null) {
      return checksum(segmentData, checksumValue);
    }
    return 0;
  }
  saveFlashSegment(output, offset, segment, checksumValue = null) {
    if (this.ROM_LOADER.CHIP_NAME === "ESP32") {
      const segmentEndPos = offset + segment.data.length + this.SEG_HEADER_LEN;
      const segmentLenRemainder = segmentEndPos % this.IROM_ALIGN;
      if (segmentLenRemainder < 36) {
        const paddedData = new Uint8Array(segment.data.length + (36 - segmentLenRemainder));
        paddedData.set(segment.data);
        paddedData.fill(0, segment.data.length);
        segment.data = paddedData;
      }
    }
    return this.saveSegment(output, offset, segment, checksumValue);
  }
  /**
   * Return ESPLoader checksum from end of just-read image
   * @param {Uint8Array} data image to read checksum from
   * @param {number} offset Current offset in image
   * @returns {number} checksum value
   */
  readChecksum(data, offset) {
    const alignedOffset = alignFilePosition(offset, 16);
    return data[alignedOffset];
  }
  /**
   * Calculate checksum of loaded image, based on segments in segment array.
   * @returns {number} checksum value
   */
  calculateChecksum() {
    let checksumValue = ESP_CHECKSUM_MAGIC;
    for (const seg of this.segments) {
      if (seg.includeInChecksum) {
        checksumValue = checksum(seg.data, checksumValue);
      }
    }
    return checksumValue;
  }
  appendChecksum(output, offset, checksumValue) {
    const alignedOffset = alignFilePosition(offset, 16);
    output[alignedOffset] = checksumValue;
  }
  writeCommonHeader(output, offset, segments) {
    output[offset] = ESP_IMAGE_MAGIC;
    output[offset + 1] = segments;
    output[offset + 2] = this.flashMode;
    output[offset + 3] = this.flashSizeFreq;
    const view = new DataView(output.buffer, offset + 4);
    view.setUint32(0, this.entrypoint, true);
  }
  isIromAddr(addr) {
    return ESP8266ROM.IROM_MAP_START <= addr && addr < ESP8266ROM.IROM_MAP_END;
  }
  getIromSegment() {
    const iromSegments = this.segments.filter((s) => this.isIromAddr(s.addr));
    if (iromSegments.length > 0) {
      if (iromSegments.length !== 1) {
        throw new ESPError(`Found ${iromSegments.length} segments that could be irom0. Bad ELF file?`);
      }
      return iromSegments[0];
    }
    return null;
  }
  getNonIromSegments() {
    const iromSegment = this.getIromSegment();
    return this.segments.filter((s) => s !== iromSegment);
  }
  sortSegments() {
    if (!this.segments.length) {
      return;
    }
    this.segments.sort((a, b) => a.addr - b.addr);
  }
  mergeAdjacentSegments() {
    if (!this.segments.length) {
      return;
    }
    const segments = [];
    for (let i = this.segments.length - 1; i > 0; i--) {
      const elem = this.segments[i - 1];
      const nextElem = this.segments[i];
      if (elem.getMemoryType(this).join(",") === nextElem.getMemoryType(this).join(",") && elem.includeInChecksum === nextElem.includeInChecksum && nextElem.addr === elem.addr + elem.data.length && (nextElem.flags & this.ELF_FLAG_EXEC) === (elem.flags & this.ELF_FLAG_EXEC)) {
        const mergedData = new Uint8Array(elem.data.length + nextElem.data.length);
        mergedData.set(elem.data);
        mergedData.set(nextElem.data, elem.data.length);
        elem.data = mergedData;
      } else {
        segments.unshift(nextElem);
      }
    }
    segments.unshift(this.segments[0]);
    this.segments = segments;
  }
  setMmuPageSize(size) {
    if (!this.MMU_PAGE_SIZE_CONF && size !== this.IROM_ALIGN) {
      console.warn(`WARNING: Changing MMU page size is not supported on ${this.ROM_LOADER.CHIP_NAME}! ` + (this.IROM_ALIGN !== 0 ? `Defaulting to ${this.IROM_ALIGN / 1024}KB.` : ""));
    } else if (this.MMU_PAGE_SIZE_CONF && !this.MMU_PAGE_SIZE_CONF.includes(size)) {
      const validSizes = this.MMU_PAGE_SIZE_CONF.map((x) => `${x / 1024}KB`).join(", ");
      throw new ESPError(`${size} bytes is not a valid ${this.ROM_LOADER.CHIP_NAME} page size, select from ${validSizes}.`);
    } else {
      this.IROM_ALIGN = size;
    }
  }
}
class ESP32FirmwareImage extends BaseFirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom);
    this.securePad = null;
    this.flashMode = 0;
    this.flashSizeFreq = 0;
    this.version = 1;
    this.WP_PIN_DISABLED = 238;
    this.wpPin = this.WP_PIN_DISABLED;
    this.clkDrv = 0;
    this.qDrv = 0;
    this.dDrv = 0;
    this.csDrv = 0;
    this.hdDrv = 0;
    this.wpDrv = 0;
    this.chipId = 0;
    this.minRev = 0;
    this.minRevFull = 0;
    this.maxRevFull = 0;
    this.storedDigest = null;
    this.calcDigest = null;
    this.dataLength = 0;
    this.IROM_ALIGN = 65536;
    this.ROM_LOADER = rom;
    this.appendDigest = appendDigest;
    this.ramOnlyHeader = ramOnlyHeader;
    if (loadFile !== null) {
      this.loadFromFile(loadFile);
    }
  }
  async loadFromFile(loadFile) {
    const start = 0;
    const binaryData = loadFile instanceof Uint8Array ? loadFile : bstrToUi8(loadFile);
    let offset = 0;
    const segments = this.loadCommonHeader(binaryData, offset, ESP_IMAGE_MAGIC);
    offset += 8;
    this.loadExtendedHeader(binaryData, offset);
    offset += 16;
    for (let i = 0; i < segments; i++) {
      const segment = this.loadSegment(binaryData, offset);
      offset += 8 + segment.data.length;
    }
    this.checksum = this.readChecksum(binaryData, offset);
    offset = alignFilePosition(offset, 16);
    if (this.appendDigest) {
      const end = offset;
      this.storedDigest = binaryData.slice(offset, offset + this.SHA256_DIGEST_LEN);
      const shaDigest = await crypto.subtle.digest("SHA-256", binaryData.slice(start, end));
      this.calcDigest = new Uint8Array(shaDigest);
      this.dataLength = end - start;
    }
    this.verify();
  }
  isFlashAddr(addr) {
    return this.ROM_LOADER.IROM_MAP_START <= addr && addr < this.ROM_LOADER.IROM_MAP_END || this.ROM_LOADER.DROM_MAP_START <= addr && addr < this.ROM_LOADER.DROM_MAP_END;
  }
  async save() {
    let totalSegments = 0;
    const output = new Uint8Array(1024 * 1024);
    let offset = 0;
    this.writeCommonHeader(output, offset, this.segments.length);
    offset += 8;
    this.saveExtendedHeader(output, offset);
    offset += 16;
    let checksum2 = ESP_CHECKSUM_MAGIC;
    const flashSegments = this.segments.filter((s) => this.isFlashAddr(s.addr)).sort((a, b) => a.addr - b.addr);
    const ramSegments = this.segments.filter((s) => !this.isFlashAddr(s.addr)).sort((a, b) => a.addr - b.addr);
    for (let i = 0; i < flashSegments.length; i++) {
      const segment = flashSegments[i];
      if (segment instanceof ELFSection && segment.name === ".flash.appdesc") {
        flashSegments.splice(i, 1);
        flashSegments.unshift(segment);
        break;
      }
    }
    for (let i = 0; i < ramSegments.length; i++) {
      const segment = ramSegments[i];
      if (segment instanceof ELFSection && segment.name === ".dram0.bootdesc") {
        ramSegments.splice(i, 1);
        ramSegments.unshift(segment);
        break;
      }
    }
    if (flashSegments.length > 0) {
      let lastAddr = flashSegments[0].addr;
      for (const segment of flashSegments.slice(1)) {
        if (Math.floor(segment.addr / this.IROM_ALIGN) === Math.floor(lastAddr / this.IROM_ALIGN)) {
          throw new ESPError(`Segment loaded at 0x${segment.addr.toString(16)} lands in same 64KB flash mapping as segment loaded at 0x${lastAddr.toString(16)}. Can't generate binary. Suggest changing linker script or ELF to merge sections.`);
        }
        lastAddr = segment.addr;
      }
    }
    if (this.ramOnlyHeader) {
      for (const segment of ramSegments) {
        checksum2 = this.saveSegment(output, offset, segment, checksum2);
        offset += 8 + segment.data.length;
        totalSegments++;
      }
      this.appendChecksum(output, offset, checksum2);
      offset = alignFilePosition(offset, 16);
      for (const segment of flashSegments.reverse()) {
        let padLen = this.getAlignmentDataNeeded(segment, offset);
        if (padLen > 0) {
          const align_min = this.ROM_LOADER.BOOTLOADER_FLASH_OFFSET - this.SEG_HEADER_LEN;
          if (padLen < align_min) {
            padLen += this.IROM_ALIGN;
          }
          padLen -= this.ROM_LOADER.BOOTLOADER_FLASH_OFFSET;
          const padSegment = new ImageSegment(0, new Uint8Array(padLen).fill(0), offset);
          checksum2 = this.saveSegment(output, offset, padSegment, checksum2);
          offset += 8 + padLen;
          totalSegments++;
        }
        this.saveFlashSegment(output, offset, segment);
        offset += 8 + segment.data.length;
        totalSegments++;
      }
    } else {
      while (flashSegments.length > 0) {
        const segment = flashSegments[0];
        const padLen = this.getAlignmentDataNeeded(segment, offset);
        if (padLen > 0) {
          if (ramSegments.length > 0 && padLen > this.SEG_HEADER_LEN) {
            const padSegment = ramSegments[0].splitImage(padLen);
            if (ramSegments[0].data.length === 0) {
              ramSegments.shift();
            }
            checksum2 = this.saveSegment(output, offset, padSegment, checksum2);
          } else {
            const padSegment = new ImageSegment(0, new Uint8Array(padLen).fill(0), offset);
            checksum2 = this.saveSegment(output, offset, padSegment, checksum2);
          }
          offset += 8 + padLen;
          totalSegments++;
        } else {
          if ((offset + 8) % this.IROM_ALIGN !== segment.addr % this.IROM_ALIGN) {
            throw new Error("Flash segment alignment mismatch");
          }
          checksum2 = this.saveFlashSegment(output, offset, segment, checksum2);
          flashSegments.shift();
          offset += 8 + segment.data.length;
          totalSegments++;
        }
      }
      for (const segment of ramSegments) {
        checksum2 = this.saveSegment(output, offset, segment, checksum2);
        offset += 8 + segment.data.length;
        totalSegments++;
      }
    }
    if (this.securePad) {
      if (!this.appendDigest) {
        throw new Error("secure_pad only applies if a SHA-256 digest is also appended to the image");
      }
      const alignPast = (offset + this.SEG_HEADER_LEN) % this.IROM_ALIGN;
      const checksumSpace = 16;
      let spaceAfterChecksum = 0;
      if (this.securePad === "1") {
        spaceAfterChecksum = 32 + 4 + 64 + 12;
      } else if (this.securePad === "2") {
        spaceAfterChecksum = 32;
      }
      const padLen = (this.IROM_ALIGN - alignPast - checksumSpace - spaceAfterChecksum) % this.IROM_ALIGN;
      const padSegment = new ImageSegment(0, new Uint8Array(padLen).fill(0), offset);
      checksum2 = this.saveSegment(output, offset, padSegment, checksum2);
      offset += 8 + padLen;
      totalSegments++;
    }
    if (!this.ramOnlyHeader) {
      this.appendChecksum(output, offset, checksum2);
      offset = alignFilePosition(offset, 16);
    }
    const imageLength = offset;
    if (this.ramOnlyHeader) {
      output[1] = ramSegments.length;
    } else {
      output[1] = totalSegments;
    }
    if (this.appendDigest) {
      const shaDigest = await crypto.subtle.digest("SHA-256", output.slice(0, imageLength));
      const digest = new Uint8Array(shaDigest);
      output.set(digest, imageLength);
      offset += 32;
    }
    if (this.padToSize) {
      if (offset % this.padToSize !== 0) {
        const padBy = this.padToSize - offset % this.padToSize;
        const padding = new Uint8Array(padBy);
        padding.fill(255);
        output.set(padding, offset);
        offset += padBy;
      }
    }
    return output;
  }
  loadExtendedHeader(data, offset) {
    const view = new DataView(data.buffer, offset);
    this.wpPin = view.getUint8(0);
    const driveConfig = view.getUint8(1);
    [this.clkDrv, this.qDrv] = this.splitByte(driveConfig);
    const dConfig = view.getUint8(2);
    [this.dDrv, this.csDrv] = this.splitByte(dConfig);
    const hdConfig = view.getUint8(3);
    [this.hdDrv, this.wpDrv] = this.splitByte(hdConfig);
    this.chipId = view.getUint8(4);
    if (this.chipId !== this.ROM_LOADER.IMAGE_CHIP_ID) {
      console.warn(`Unexpected chip id in image. Expected ${this.ROM_LOADER.IMAGE_CHIP_ID} but value was ${this.chipId}. Is this image for a different chip model?`);
    }
    this.minRev = view.getUint8(5);
    this.minRevFull = view.getUint16(6, true);
    this.maxRevFull = view.getUint16(8, true);
    const appendDigest = view.getUint8(15);
    if (appendDigest === 0 || appendDigest === 1) {
      this.appendDigest = appendDigest === 1;
    } else {
      throw new Error(`Invalid value for append_digest field (0x${appendDigest.toString(16)}). Should be 0 or 1.`);
    }
  }
  saveExtendedHeader(output, offset) {
    const headerBuffer = new ArrayBuffer(16);
    const view = new DataView(headerBuffer);
    view.setUint8(0, this.wpPin);
    view.setUint8(1, this.joinByte(this.clkDrv, this.qDrv));
    view.setUint8(2, this.joinByte(this.dDrv, this.csDrv));
    view.setUint8(3, this.joinByte(this.hdDrv, this.wpDrv));
    view.setUint8(4, this.ROM_LOADER.IMAGE_CHIP_ID);
    view.setUint8(5, this.minRev);
    view.setUint16(6, this.minRevFull, true);
    view.setUint16(8, this.maxRevFull, true);
    for (let i = 9; i < 15; i++) {
      view.setUint8(i, 0);
    }
    view.setUint8(15, this.appendDigest ? 1 : 0);
    output.set(new Uint8Array(headerBuffer), offset);
  }
  splitByte(n) {
    return [n & 15, n >> 4 & 15];
  }
  joinByte(ln, hn) {
    return ln & 15 | (hn & 15) << 4;
  }
  getAlignmentDataNeeded(segment, currentOffset) {
    const alignPast = segment.addr % this.IROM_ALIGN - this.SEG_HEADER_LEN;
    let padLen = this.IROM_ALIGN - currentOffset % this.IROM_ALIGN + alignPast;
    if (padLen === 0 || padLen === this.IROM_ALIGN) {
      return 0;
    }
    padLen -= this.SEG_HEADER_LEN;
    if (padLen < 0) {
      padLen += this.IROM_ALIGN;
    }
    return padLen;
  }
}
class ESP8266ROMFirmwareImage extends BaseFirmwareImage {
  constructor(rom, loadFile = null) {
    super(rom);
    this.version = 1;
    this.ROM_LOADER = rom;
    this.flashMode = 0;
    this.flashSizeFreq = 0;
    if (loadFile !== null) {
      this.loadFromFile(loadFile);
    }
  }
  loadFromFile(file) {
    const binaryData = file instanceof Uint8Array ? file : bstrToUi8(file);
    let offset = 0;
    const segments = this.loadCommonHeader(binaryData, offset, ESP_IMAGE_MAGIC);
    offset += 8;
    for (let i = 0; i < segments; i++) {
      const segment = this.loadSegment(binaryData, offset);
      offset += 8 + segment.data.length;
    }
    this.checksum = this.readChecksum(binaryData, offset);
    this.verify();
  }
  defaultOutputName(inputFile) {
    return inputFile + "-";
  }
}
class ESP8266V2FirmwareImage extends BaseFirmwareImage {
  constructor(rom, loadFile = null) {
    super(rom);
    this.version = 2;
    this.ROM_LOADER = rom;
    this.flashMode = 0;
    this.flashSizeFreq = 0;
    if (loadFile !== null) {
      this.loadFromFile(loadFile);
    }
  }
  async loadFromFile(fileStr) {
    const binaryData = fileStr instanceof Uint8Array ? fileStr : bstrToUi8(fileStr);
    let offset = 0;
    const segments = this.loadCommonHeader(binaryData, offset, ESP8266V2FirmwareImage.IMAGE_V2_MAGIC);
    offset += 8;
    if (segments !== ESP8266V2FirmwareImage.IMAGE_V2_SEGMENT) {
      console.warn(`Warning: V2 header has unexpected "segment" count ${segments} (usually 4)`);
    }
    const firstFlashMode = this.flashMode;
    const firstFlashSizeFreq = this.flashSizeFreq;
    const firstEntrypoint = this.entrypoint;
    const iromSegment = this.loadSegment(binaryData, offset, true);
    iromSegment.addr = 0;
    iromSegment.includeInChecksum = false;
    offset += 8 + iromSegment.data.length;
    const secondSegments = this.loadCommonHeader(binaryData, offset, ESP_IMAGE_MAGIC);
    offset += 8;
    if (firstFlashMode !== this.flashMode) {
      console.warn(`WARNING: Flash mode value in first header (0x${firstFlashMode.toString(16)}) disagrees with second (0x${this.flashMode.toString(16)}). Using second value.`);
    }
    if (firstFlashSizeFreq !== this.flashSizeFreq) {
      console.warn(`WARNING: Flash size/freq value in first header (0x${firstFlashSizeFreq.toString(16)}) disagrees with second (0x${this.flashSizeFreq.toString(16)}). Using second value.`);
    }
    if (firstEntrypoint !== this.entrypoint) {
      console.warn(`WARNING: Entrypoint address in first header (0x${firstEntrypoint.toString(16)}) disagrees with second header (0x${this.entrypoint.toString(16)}). Using second value.`);
    }
    for (let i = 0; i < secondSegments; i++) {
      const segment = this.loadSegment(binaryData, offset);
      offset += 8 + segment.data.length;
    }
    this.checksum = this.readChecksum(binaryData, offset);
    this.verify();
  }
  defaultOutputName(inputFile) {
    const iromSegment = this.getIromSegment();
    let iromOffs = 0;
    if (iromSegment !== null) {
      iromOffs = iromSegment.addr - ESP8266ROM.IROM_MAP_START;
    }
    const baseName = inputFile.replace(/\.[^/.]+$/, "");
    const alignedOffset = iromOffs & -4096;
    return `${baseName}-0x${alignedOffset.toString(16).padStart(5, "0")}.bin`;
  }
}
ESP8266V2FirmwareImage.IMAGE_V2_MAGIC = 234;
ESP8266V2FirmwareImage.IMAGE_V2_SEGMENT = 4;
class ESP32S2FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
class ESP32S3FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
class ESP32C3FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
class ESP32C2FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.MMU_PAGE_SIZE_CONF = [16384, 32768, 65536];
    this.ROM_LOADER = rom;
  }
}
class ESP32C6FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.MMU_PAGE_SIZE_CONF = [8192, 16384, 32768, 65536];
    this.ROM_LOADER = rom;
  }
}
class ESP32C61FirmwareImage extends ESP32C6FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
class ESP32C5FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
class ESP32P4FirmwareImage extends ESP32FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
class ESP32H2FirmwareImage extends ESP32C6FirmwareImage {
  constructor(rom, loadFile = null, appendDigest = true, ramOnlyHeader = false) {
    super(rom, loadFile, appendDigest, ramOnlyHeader);
    this.ROM_LOADER = rom;
  }
}
async function loadFirmwareImage(rom, imageData) {
  const binaryData = imageData instanceof Uint8Array ? imageData : bstrToUi8(imageData);
  const chipName = rom.CHIP_NAME.toLowerCase().replace(/[-()]/g, "");
  let firmwareImageClass;
  if (chipName !== "esp8266") {
    switch (chipName) {
      case "esp32":
        firmwareImageClass = ESP32FirmwareImage;
        break;
      case "esp32s2":
        firmwareImageClass = ESP32S2FirmwareImage;
        break;
      case "esp32s3":
        firmwareImageClass = ESP32S3FirmwareImage;
        break;
      case "esp32c3":
        firmwareImageClass = ESP32C3FirmwareImage;
        break;
      case "esp32c2":
        firmwareImageClass = ESP32C2FirmwareImage;
        break;
      case "esp32c6":
        firmwareImageClass = ESP32C6FirmwareImage;
        break;
      case "esp32c61":
        firmwareImageClass = ESP32C61FirmwareImage;
        break;
      case "esp32c5":
        firmwareImageClass = ESP32C5FirmwareImage;
        break;
      case "esp32h2":
        firmwareImageClass = ESP32H2FirmwareImage;
        break;
      case "esp32p4":
        firmwareImageClass = ESP32P4FirmwareImage;
        break;
      default:
        throw new ESPError(`Unsupported chip name: ${chipName}`);
    }
  } else {
    const magic = binaryData[0];
    if (magic === ESP_IMAGE_MAGIC) {
      firmwareImageClass = ESP8266ROMFirmwareImage;
    } else if (magic === ESP8266V2FirmwareImage.IMAGE_V2_MAGIC) {
      firmwareImageClass = ESP8266V2FirmwareImage;
    } else {
      throw new ESPError(`Invalid image magic number: ${magic}`);
    }
  }
  const image = new firmwareImageClass(rom);
  const imageWithLoad = image;
  if (typeof imageWithLoad.loadFromFile === "function") {
    const loadResult = imageWithLoad.loadFromFile(binaryData);
    if (loadResult instanceof Promise) {
      await loadResult;
    }
  }
  return image;
}
async function magic2Chip(magic) {
  switch (magic) {
    case 15736195: {
      const { ESP32ROM } = await import("./esp32-D54xSBFB.js");
      return new ESP32ROM();
    }
    case 203546735:
    case 1867591791:
    case 2084675695: {
      const { ESP32C2ROM } = await import("./esp32c2-B4DekjJQ.js");
      return new ESP32C2ROM();
    }
    case 1763790959:
    case 456216687:
    case 1216438383:
    case 1130455151: {
      const { ESP32C3ROM } = await import("./esp32c3-BN7J9SJ5.js");
      return new ESP32C3ROM();
    }
    case 752910447: {
      const { ESP32C6ROM } = await import("./esp32c6-CM-j33mI.js");
      return new ESP32C6ROM();
    }
    case 606167151:
    case 871374959:
    case 1333878895: {
      const { ESP32C61ROM } = await import("./esp32c61-DwbhfH5a.js");
      return new ESP32C61ROM();
    }
    case 285294703:
    case 1675706479:
    case 1607549039: {
      const { ESP32C5ROM } = await import("./esp32c5-Df4cMBma.js");
      return new ESP32C5ROM();
    }
    case 3619110528:
    case 2548236392: {
      const { ESP32H2ROM } = await import("./esp32h2-CkUdyQnK.js");
      return new ESP32H2ROM();
    }
    case 9: {
      const { ESP32S3ROM } = await import("./esp32s3-DJgHwubr.js");
      return new ESP32S3ROM();
    }
    case 1990: {
      const { ESP32S2ROM } = await import("./esp32s2-Ci0Cq-Dy.js");
      return new ESP32S2ROM();
    }
    case 4293968129: {
      const { ESP8266ROM: ESP8266ROM2 } = await Promise.resolve().then(() => esp8266);
      return new ESP8266ROM2();
    }
    case 0:
    case 182303440:
    case 117676761: {
      const { ESP32P4ROM } = await import("./esp32p4-ZMGEOfW6.js");
      return new ESP32P4ROM();
    }
    default:
      return null;
  }
}
class ESPLoader {
  /**
   * Create a new ESPLoader to perform serial communication
   * such as read/write flash memory and registers using a LoaderOptions object.
   * @param {LoaderOptions} options - LoaderOptions object argument for ESPLoader.
   * ```
   * const myLoader = new ESPLoader({ transport: Transport, baudrate: number, terminal?: IEspLoaderTerminal });
   * ```
   */
  constructor(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    this.ESP_RAM_BLOCK = 6144;
    this.ESP_FLASH_BEGIN = 2;
    this.ESP_FLASH_DATA = 3;
    this.ESP_FLASH_END = 4;
    this.ESP_MEM_BEGIN = 5;
    this.ESP_MEM_END = 6;
    this.ESP_MEM_DATA = 7;
    this.ESP_WRITE_REG = 9;
    this.ESP_READ_REG = 10;
    this.ESP_SPI_ATTACH = 13;
    this.ESP_CHANGE_BAUDRATE = 15;
    this.ESP_FLASH_DEFL_BEGIN = 16;
    this.ESP_FLASH_DEFL_DATA = 17;
    this.ESP_FLASH_DEFL_END = 18;
    this.ESP_SPI_FLASH_MD5 = 19;
    this.ESP_ERASE_FLASH = 208;
    this.ESP_ERASE_REGION = 209;
    this.ESP_READ_FLASH = 210;
    this.ESP_RUN_USER_CODE = 211;
    this.ESP_IMAGE_MAGIC = 233;
    this.ESP_CHECKSUM_MAGIC = 239;
    this.ROM_INVALID_RECV_MSG = 5;
    this.DEFAULT_TIMEOUT = 3e3;
    this.ERASE_REGION_TIMEOUT_PER_MB = 3e4;
    this.ERASE_WRITE_TIMEOUT_PER_MB = 4e4;
    this.MD5_TIMEOUT_PER_MB = 8e3;
    this.CHIP_ERASE_TIMEOUT = 12e4;
    this.FLASH_READ_TIMEOUT = 1e5;
    this.MAX_TIMEOUT = this.CHIP_ERASE_TIMEOUT * 2;
    this.SPI_ADDR_REG_MSB = true;
    this.CHIP_DETECT_MAGIC_REG_ADDR = 1073745920;
    this.DETECTED_FLASH_SIZES = {
      18: "256KB",
      19: "512KB",
      20: "1MB",
      21: "2MB",
      22: "4MB",
      23: "8MB",
      24: "16MB",
      25: "32MB",
      26: "64MB",
      27: "128MB",
      28: "256MB",
      32: "64MB",
      33: "128MB",
      34: "256MB",
      50: "256KB",
      51: "512KB",
      52: "1MB",
      53: "2MB",
      54: "4MB",
      55: "8MB",
      56: "16MB",
      57: "32MB",
      58: "64MB"
    };
    this.USB_JTAG_SERIAL_PID = 4097;
    this.romBaudrate = 115200;
    this.debugLogging = false;
    this.syncStubDetected = false;
    this.IS_STUB = false;
    this.FLASH_WRITE_SIZE = 16384;
    this.transport = options.transport;
    this.baudrate = options.baudrate;
    this.resetConstructors = {
      classicReset: (transport, resetDelay) => new ClassicReset(transport, resetDelay),
      customReset: (transport, sequenceString) => new CustomReset(transport, sequenceString),
      hardReset: (transport, usingUsbOtg) => new HardReset(transport, usingUsbOtg),
      usbJTAGSerialReset: (transport) => new UsbJtagSerialReset(transport)
    };
    if (options.serialOptions) {
      this.serialOptions = options.serialOptions;
    }
    if (options.terminal) {
      this.terminal = options.terminal;
      this.terminal.clean();
    }
    if (typeof options.debugLogging !== "undefined") {
      this.debugLogging = options.debugLogging;
    }
    if (options.port) {
      this.transport = new Transport(options.port);
    }
    if (typeof options.enableTracing !== "undefined") {
      this.transport.tracing = options.enableTracing;
    }
    if ((_a = options.resetConstructors) === null || _a === void 0 ? void 0 : _a.classicReset) {
      this.resetConstructors.classicReset = (_b = options.resetConstructors) === null || _b === void 0 ? void 0 : _b.classicReset;
    }
    if ((_c = options.resetConstructors) === null || _c === void 0 ? void 0 : _c.customReset) {
      this.resetConstructors.customReset = (_d = options.resetConstructors) === null || _d === void 0 ? void 0 : _d.customReset;
    }
    if ((_e = options.resetConstructors) === null || _e === void 0 ? void 0 : _e.hardReset) {
      this.resetConstructors.hardReset = (_f = options.resetConstructors) === null || _f === void 0 ? void 0 : _f.hardReset;
    }
    if ((_g = options.resetConstructors) === null || _g === void 0 ? void 0 : _g.usbJTAGSerialReset) {
      this.resetConstructors.usbJTAGSerialReset = (_h = options.resetConstructors) === null || _h === void 0 ? void 0 : _h.usbJTAGSerialReset;
    }
    this.info("esptool.js");
    this.info("Serial port " + this.transport.getInfo());
  }
  /**
   * Write to ESP Loader constructor's terminal with or without new line.
   * @param {string} str - String to write.
   * @param {boolean} withNewline - Add new line at the end ?
   */
  write(str, withNewline = true) {
    if (this.terminal) {
      if (withNewline) {
        this.terminal.writeLine(str);
      } else {
        this.terminal.write(str);
      }
    } else {
      console.log(str);
    }
  }
  /**
   * Write error message to ESP Loader constructor's terminal with or without new line.
   * @param {string} str - String to write.
   * @param {boolean} withNewline - Add new line at the end ?
   */
  error(str, withNewline = true) {
    this.write(`Error: ${str}`, withNewline);
  }
  /**
   * Write information message to ESP Loader constructor's terminal with or without new line.
   * @param {string} str - String to write.
   * @param {boolean} withNewline - Add new line at the end ?
   */
  info(str, withNewline = true) {
    this.write(str, withNewline);
  }
  /**
   * Write debug message to ESP Loader constructor's terminal with or without new line.
   * @param {string} str - String to write.
   * @param {boolean} withNewline - Add new line at the end ?
   */
  debug(str, withNewline = true) {
    if (this.debugLogging) {
      this.write(`Debug: ${str}`, withNewline);
    }
  }
  /**
   * Convert short integer to byte array
   * @param {number} i - Number to convert.
   * @returns {Uint8Array} Byte array.
   */
  _shortToBytearray(i) {
    return new Uint8Array([i & 255, i >> 8 & 255]);
  }
  /**
   * Convert an integer to byte array
   * @param {number} i - Number to convert.
   * @returns {ROM} The chip ROM class related to given magic hex number.
   */
  _intToByteArray(i) {
    return new Uint8Array([i & 255, i >> 8 & 255, i >> 16 & 255, i >> 24 & 255]);
  }
  /**
   * Convert a byte array to short integer.
   * @param {number} i - Number to convert.
   * @param {number} j - Number to convert.
   * @returns {number} Return a short integer number.
   */
  _byteArrayToShort(i, j) {
    return i | j >> 8;
  }
  /**
   * Convert a byte array to integer.
   * @param {number} i - Number to convert.
   * @param {number} j - Number to convert.
   * @param {number} k - Number to convert.
   * @param {number} l - Number to convert.
   * @returns {number} Return a integer number.
   */
  _byteArrayToInt(i, j, k, l) {
    return i | j << 8 | k << 16 | l << 24;
  }
  /**
   * Append a buffer array after another buffer array
   * @param {ArrayBuffer} buffer1 - First array buffer.
   * @param {ArrayBuffer} buffer2 - magic hex number to select ROM.
   * @returns {ArrayBufferLike} Return an array buffer.
   */
  _appendBuffer(buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  }
  /**
   * Append a buffer array after another buffer array
   * @param {Uint8Array} arr1 - First array buffer.
   * @param {Uint8Array} arr2 - magic hex number to select ROM.
   * @returns {Uint8Array} Return a 8 bit unsigned array.
   */
  _appendArray(arr1, arr2) {
    const c = new Uint8Array(arr1.length + arr2.length);
    c.set(arr1, 0);
    c.set(arr2, arr1.length);
    return c;
  }
  /**
   * Convert a unsigned 8 bit integer array to byte string.
   * @param {Uint8Array} u8Array - magic hex number to select ROM.
   * @returns {string} Return the equivalent string.
   */
  ui8ToBstr(u8Array) {
    let bStr = "";
    for (let i = 0; i < u8Array.length; i++) {
      bStr += String.fromCharCode(u8Array[i]);
    }
    return bStr;
  }
  /**
   * Convert a byte string to unsigned 8 bit integer array.
   * @param {string} bStr - binary string input
   * @returns {Uint8Array} Return a 8 bit unsigned integer array.
   */
  bstrToUi8(bStr) {
    const u8Array = new Uint8Array(bStr.length);
    for (let i = 0; i < bStr.length; i++) {
      u8Array[i] = bStr.charCodeAt(i);
    }
    return u8Array;
  }
  /**
   * Use the device serial port read function with given timeout to create a valid packet.
   * @param {number} op Operation number
   * @param {number} timeout timeout number in milliseconds
   * @returns {[number, Uint8Array]} valid response packet.
   */
  async readPacket(op = null, timeout = this.DEFAULT_TIMEOUT) {
    for (let i = 0; i < 100; i++) {
      const p = await this.transport.read(timeout);
      if (!p || p.length < 8) {
        continue;
      }
      const resp = p[0];
      if (resp !== 1) {
        continue;
      }
      const opRet = p[1];
      const val = this._byteArrayToInt(p[4], p[5], p[6], p[7]);
      const data = p.slice(8);
      if (resp == 1) {
        if (op == null || opRet == op) {
          return [val, data];
        } else if (data[0] != 0 && data[1] == this.ROM_INVALID_RECV_MSG) {
          this.transport.flushInput();
          throw new ESPError("unsupported command error");
        }
      }
    }
    throw new ESPError("invalid response");
  }
  /**
   * Write a serial command to the chip
   * @param {number} op - Operation number
   * @param {Uint8Array} data - Unsigned 8 bit array
   * @param {number} chk - channel number
   * @param {boolean} waitResponse - wait for response ?
   * @param {number} timeout - timeout number in milliseconds
   * @returns {Promise<[number, Uint8Array]>} Return a number and a 8 bit unsigned integer array.
   */
  async command(op = null, data = new Uint8Array(0), chk = 0, waitResponse = true, timeout = this.DEFAULT_TIMEOUT) {
    if (op != null) {
      if (this.transport.tracing) {
        this.transport.trace(`command op:0x${op.toString(16).padStart(2, "0")} data len=${data.length} wait_response=${waitResponse ? 1 : 0} timeout=${(timeout / 1e3).toFixed(3)} data=${this.transport.hexConvert(data)}`);
      }
      const pkt = new Uint8Array(8 + data.length);
      pkt[0] = 0;
      pkt[1] = op;
      pkt[2] = this._shortToBytearray(data.length)[0];
      pkt[3] = this._shortToBytearray(data.length)[1];
      pkt[4] = this._intToByteArray(chk)[0];
      pkt[5] = this._intToByteArray(chk)[1];
      pkt[6] = this._intToByteArray(chk)[2];
      pkt[7] = this._intToByteArray(chk)[3];
      let i;
      for (i = 0; i < data.length; i++) {
        pkt[8 + i] = data[i];
      }
      await this.transport.write(pkt);
    }
    if (!waitResponse) {
      return [0, new Uint8Array(0)];
    }
    return this.readPacket(op, timeout);
  }
  /**
   * Read a register from chip.
   * @param {number} addr - Register address number
   * @param {number} timeout - Timeout in milliseconds (Default: 3000ms)
   * @returns {number} - Command number value
   */
  async readReg(addr, timeout = this.DEFAULT_TIMEOUT) {
    this.debug(`Read Register:${this.toHex(addr)}`);
    const pkt = this._intToByteArray(addr);
    const val = await this.command(this.ESP_READ_REG, pkt, void 0, void 0, timeout);
    this.debug(`Read Register Value:${val[0]}`);
    return val[0];
  }
  /**
   * Write a number value to register address in chip.
   * @param {number} addr - Register address number
   * @param {number} value - Number value to write in register
   * @param {number} mask - Hex number for mask
   * @param {number} delayUs Delay number
   * @param {number} delayAfterUs Delay after previous delay
   */
  async writeReg(addr, value, mask = 4294967295, delayUs = 0, delayAfterUs = 0) {
    let pkt = this._appendArray(this._intToByteArray(addr), this._intToByteArray(value));
    pkt = this._appendArray(pkt, this._intToByteArray(mask));
    pkt = this._appendArray(pkt, this._intToByteArray(delayUs));
    if (delayAfterUs > 0) {
      pkt = this._appendArray(pkt, this._intToByteArray(this.chip.UART_DATE_REG_ADDR));
      pkt = this._appendArray(pkt, this._intToByteArray(0));
      pkt = this._appendArray(pkt, this._intToByteArray(0));
      pkt = this._appendArray(pkt, this._intToByteArray(delayAfterUs));
    }
    await this.checkCommand("write target memory", this.ESP_WRITE_REG, pkt);
  }
  /**
   * Sync chip by sending sync command.
   * @returns {[number, Uint8Array]} Command result
   */
  async sync() {
    this.debug("Sync");
    const cmd = new Uint8Array(36);
    let i;
    cmd[0] = 7;
    cmd[1] = 7;
    cmd[2] = 18;
    cmd[3] = 32;
    for (i = 0; i < 32; i++) {
      cmd[4 + i] = 85;
    }
    try {
      let resp = await this.command(8, cmd, void 0, void 0, 100);
      this.syncStubDetected = resp[0] === 0;
      for (let i2 = 0; i2 < 7; i2++) {
        resp = await this.readPacket(8, 100);
        this.syncStubDetected = this.syncStubDetected && resp[0] === 0;
      }
      return resp;
    } catch (e) {
      this.debug("Sync err " + e);
      throw e;
    }
  }
  /**
   * Attempt to connect to the chip by sending a reset sequence and later a sync command.
   * @param {string} mode - Reset mode to use
   * @param {ResetStrategy} resetStrategy - Reset strategy class to use for connect
   * @returns {string} - Returns 'success' or 'error' message.
   */
  async _connectAttempt(mode = "default_reset", resetStrategy) {
    this.debug("_connect_attempt " + mode);
    if (resetStrategy) {
      await resetStrategy.reset();
    }
    const readBytes = this.transport.peek();
    const binaryString = Array.from(readBytes, (byte) => String.fromCharCode(byte)).join("");
    const regex = /boot:(0x[0-9a-fA-F]+)([\s\S]*?waiting for download)?/;
    const match = binaryString.match(regex);
    let bootLogDetected = false, bootMode = "", downloadMode = false;
    if (match) {
      bootLogDetected = true;
      bootMode = match[1];
      downloadMode = !!match[2];
    }
    this.debug(`bootMode:${bootMode} downloadMode:${downloadMode}`);
    let lastError = "";
    for (let i = 0; i < 5; i++) {
      try {
        this.debug(`Sync connect attempt ${i}`);
        this.transport.flushInput();
        const resp = await this.sync();
        this.debug(resp[0].toString());
        return "success";
      } catch (error) {
        this.debug(`Error at sync ${error}`);
        if (error instanceof Error) {
          lastError = error.message;
        } else if (typeof error === "string") {
          lastError = error;
        } else {
          lastError = JSON.stringify(error);
        }
      }
    }
    if (bootLogDetected) {
      lastError = `Wrong boot mode detected (${bootMode}).
        This chip needs to be in download mode.`;
      if (downloadMode) {
        lastError = `Download mode successfully detected, but getting no sync reply:
           The serial TX path seems to be down.`;
      }
    }
    return lastError;
  }
  /**
   * Constructs a sequence of reset strategies based on the OS,
   * used ESP chip, external settings, and environment variables.
   * Returns a tuple of one or more reset strategies to be tried sequentially.
   * @param {string} mode - Reset mode to use
   * @returns {ResetStrategy[]} - Array of reset strategies
   */
  constructResetSequence(mode) {
    if (mode !== "no_reset") {
      if (mode === "usb_reset" || this.transport.getPid() === this.USB_JTAG_SERIAL_PID) {
        if (this.resetConstructors.usbJTAGSerialReset) {
          this.debug("using USB JTAG Serial Reset");
          return [this.resetConstructors.usbJTAGSerialReset(this.transport)];
        }
      } else {
        const DEFAULT_RESET_DELAY = 50;
        const EXTRA_DELAY = DEFAULT_RESET_DELAY + 500;
        if (this.resetConstructors.classicReset) {
          this.debug("using Classic Serial Reset");
          return [
            this.resetConstructors.classicReset(this.transport, DEFAULT_RESET_DELAY),
            this.resetConstructors.classicReset(this.transport, EXTRA_DELAY)
          ];
        }
      }
    }
    return [];
  }
  /**
   * Perform a connection to chip.
   * @param {string} mode - Reset mode to use. Example: 'default_reset' | 'no_reset'
   * @param {number} attempts - Number of connection attempts
   * @param {boolean} detecting - Detect the connected chip
   */
  async connect(mode = "default_reset", attempts = 7, detecting = true) {
    let resp;
    this.info("Connecting...", false);
    await this.transport.connect(this.romBaudrate, this.serialOptions);
    this.transport.readLoop();
    const resetSequences = this.constructResetSequence(mode);
    for (let i = 0; i < attempts; i++) {
      const resetSequence = resetSequences.length > 0 ? resetSequences[i % resetSequences.length] : null;
      resp = await this._connectAttempt(mode, resetSequence);
      if (resp === "success") {
        break;
      }
    }
    if (resp !== "success") {
      throw new ESPError("Failed to connect with the device");
    }
    this.debug("Connect attempt successful.");
    this.info("\n\r", false);
    if (detecting) {
      const chipMagicValue = await this.readReg(this.CHIP_DETECT_MAGIC_REG_ADDR) >>> 0;
      this.debug("Chip Magic " + chipMagicValue.toString(16));
      const chip = await magic2Chip(chipMagicValue);
      if (typeof this.chip === null) {
        throw new ESPError(`Unexpected CHIP magic value ${chipMagicValue}. Failed to autodetect chip type.`);
      } else {
        this.chip = chip;
      }
    }
  }
  /**
   * Connect and detect the existing chip.
   * @param {string} mode Reset mode to use for connection.
   */
  async detectChip(mode = "default_reset") {
    await this.connect(mode);
    this.info("Detecting chip type... ", false);
    if (this.chip != null) {
      this.info(this.chip.CHIP_NAME);
    } else {
      this.info("unknown!");
    }
  }
  /**
   * Execute the command and check the command response.
   * @param {string} opDescription Command operation description.
   * @param {number} op Command operation number
   * @param {Uint8Array} data Command value
   * @param {number} chk Checksum to use
   * @param {number} responseDataLength Length of the response data to expect
   * @param {number} timeout TImeout number in milliseconds (ms)
   * @returns {number} Command result
   */
  async checkCommand(opDescription = "", op = null, data = new Uint8Array(0), chk = 0, responseDataLength = 0, timeout = this.DEFAULT_TIMEOUT) {
    this.debug("check_command " + opDescription);
    const STATUS_BYTES_LENGTH = 2;
    const resp = await this.command(op, data, chk, void 0, timeout);
    if (resp && resp[1] && resp[1].length < responseDataLength + STATUS_BYTES_LENGTH) {
      const statusBytes2 = resp[1].slice(0, 2);
      if (statusBytes2[0] !== 0) {
        throw new ESPError(`Failed to ${opDescription} failed with status ${statusBytes2}`);
      } else {
        throw new ESPError(`Failed to ${opDescription}.
 Only got ${resp[1].length} bytes of data.`);
      }
    }
    const statusBytes = resp[1].slice(responseDataLength, responseDataLength + STATUS_BYTES_LENGTH);
    if (statusBytes[0] !== 0) {
      throw new ESPError(`Failed to ${opDescription} failed with status ${statusBytes}`);
    }
    if (responseDataLength > 0) {
      return resp[1].slice(0, responseDataLength);
    } else {
      return resp[0];
    }
  }
  /**
   * Start downloading an application image to RAM
   * @param {number} size Image size number
   * @param {number} blocks Number of data blocks
   * @param {number} blocksize Size of each data block
   * @param {number} offset Image offset number
   */
  async memBegin(size, blocks, blocksize, offset) {
    if (this.IS_STUB) {
      const loadStart = offset;
      const loadEnd = offset + size;
      const chipRevision = this.chip.getChipRevision ? await this.chip.getChipRevision(this) : void 0;
      const stub = await getStubJsonByChipName(this.chip.CHIP_NAME, chipRevision);
      if (stub) {
        const areasToCheck = [
          [stub.bss_start || stub.data_start, stub.data_start + stub.decodedData.length],
          [stub.text_start, stub.text_start + stub.decodedText.length]
        ];
        for (const [stubStart, stubEnd] of areasToCheck) {
          if (loadStart < stubEnd && loadEnd > stubStart) {
            throw new ESPError(`Software loader is resident at 0x${stubStart.toString(16).padStart(8, "0")}-0x${stubEnd.toString(16).padStart(8, "0")}.
            Can't load binary at overlapping address range 0x${loadStart.toString(16).padStart(8, "0")}-0x${loadEnd.toString(16).padStart(8, "0")}.
            Either change binary loading address, or use the no-stub option to disable the software loader.`);
          }
        }
      }
    }
    this.debug("mem_begin " + size + " " + blocks + " " + blocksize + " " + offset.toString(16));
    let pkt = this._appendArray(this._intToByteArray(size), this._intToByteArray(blocks));
    pkt = this._appendArray(pkt, this._intToByteArray(blocksize));
    pkt = this._appendArray(pkt, this._intToByteArray(offset));
    await this.checkCommand("enter RAM download mode", this.ESP_MEM_BEGIN, pkt);
  }
  /**
   * Get the checksum for given unsigned 8-bit array
   * @param {Uint8Array} data Unsigned 8-bit integer array
   * @param {number} state Initial checksum
   * @returns {number} - Array checksum
   */
  checksum(data, state = this.ESP_CHECKSUM_MAGIC) {
    for (let i = 0; i < data.length; i++) {
      state ^= data[i];
    }
    return state;
  }
  /**
   * Send a block of image to RAM
   * @param {Uint8Array} buffer Unsigned 8-bit array
   * @param {number} seq Sequence number
   */
  async memBlock(buffer, seq) {
    let pkt = this._appendArray(this._intToByteArray(buffer.length), this._intToByteArray(seq));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, buffer);
    const checksum2 = this.checksum(buffer);
    await this.checkCommand("write to target RAM", this.ESP_MEM_DATA, pkt, checksum2);
  }
  /**
   * Leave RAM download mode and run application
   * @param {number} entrypoint - Entrypoint number
   */
  async memFinish(entrypoint) {
    const isEntry = entrypoint === 0 ? 1 : 0;
    const pkt = this._appendArray(this._intToByteArray(isEntry), this._intToByteArray(entrypoint));
    await this.checkCommand("leave RAM download mode", this.ESP_MEM_END, pkt, void 0, void 0, 200);
  }
  /**
   * Configure SPI flash pins
   * @param {number} hspiArg -  Argument for SPI attachment
   */
  async flashSpiAttach(hspiArg) {
    const pkt = this._intToByteArray(hspiArg);
    await this.checkCommand("configure SPI flash pins", this.ESP_SPI_ATTACH, pkt);
  }
  /**
   * Scale timeouts which are size-specific.
   * @param {number} secondsPerMb Seconds per megabytes as number
   * @param {number} sizeBytes Size bytes number
   * @returns {number} - Scaled timeout for specified size.
   */
  timeoutPerMb(secondsPerMb, sizeBytes) {
    const result = secondsPerMb * (sizeBytes / 1e6);
    if (result < 3e3) {
      return 3e3;
    } else {
      return result;
    }
  }
  /**
   * Start downloading to Flash (performs an erase)
   * @param {number} size Size to erase
   * @param {number} offset Offset to erase
   * @returns {number} Number of blocks (of size self.FLASH_WRITE_SIZE) to write.
   */
  async flashBegin(size, offset) {
    const numBlocks = Math.floor((size + this.FLASH_WRITE_SIZE - 1) / this.FLASH_WRITE_SIZE);
    const eraseSize = this.chip.getEraseSize(offset, size);
    const d = /* @__PURE__ */ new Date();
    const t1 = d.getTime();
    let timeout = 3e3;
    if (this.IS_STUB == false) {
      timeout = this.timeoutPerMb(this.ERASE_REGION_TIMEOUT_PER_MB, size);
    }
    this.debug("flash begin " + eraseSize + " " + numBlocks + " " + this.FLASH_WRITE_SIZE + " " + offset + " " + size);
    let pkt = this._appendArray(this._intToByteArray(eraseSize), this._intToByteArray(numBlocks));
    pkt = this._appendArray(pkt, this._intToByteArray(this.FLASH_WRITE_SIZE));
    pkt = this._appendArray(pkt, this._intToByteArray(offset));
    if (this.IS_STUB == false) {
      pkt = this._appendArray(pkt, this._intToByteArray(0));
    }
    await this.checkCommand("enter Flash download mode", this.ESP_FLASH_BEGIN, pkt, void 0, void 0, timeout);
    const t2 = d.getTime();
    if (size != 0 && this.IS_STUB == false) {
      this.info("Took " + (t2 - t1) / 1e3 + "." + (t2 - t1) % 1e3 + "s to erase flash block");
    }
    return numBlocks;
  }
  /**
   * Start downloading compressed data to Flash (performs an erase)
   * @param {number} size Write size
   * @param {number} compsize Compressed size
   * @param {number} offset Offset for write
   * @returns {number} Returns number of blocks (size self.FLASH_WRITE_SIZE) to write.
   */
  async flashDeflBegin(size, compsize, offset) {
    const numBlocks = Math.floor((compsize + this.FLASH_WRITE_SIZE - 1) / this.FLASH_WRITE_SIZE);
    const eraseBlocks = Math.floor((size + this.FLASH_WRITE_SIZE - 1) / this.FLASH_WRITE_SIZE);
    const d = /* @__PURE__ */ new Date();
    const t1 = d.getTime();
    let writeSize, timeout;
    if (this.IS_STUB) {
      writeSize = size;
      timeout = this.DEFAULT_TIMEOUT;
    } else {
      writeSize = eraseBlocks * this.FLASH_WRITE_SIZE;
      timeout = this.timeoutPerMb(this.ERASE_REGION_TIMEOUT_PER_MB, writeSize);
    }
    this.info("Compressed " + size + " bytes to " + compsize + "...");
    let pkt = this._appendArray(this._intToByteArray(writeSize), this._intToByteArray(numBlocks));
    pkt = this._appendArray(pkt, this._intToByteArray(this.FLASH_WRITE_SIZE));
    pkt = this._appendArray(pkt, this._intToByteArray(offset));
    if ((this.chip.CHIP_NAME === "ESP32-S2" || this.chip.CHIP_NAME === "ESP32-S3" || this.chip.CHIP_NAME === "ESP32-C3" || this.chip.CHIP_NAME === "ESP32-C2") && this.IS_STUB === false) {
      pkt = this._appendArray(pkt, this._intToByteArray(0));
    }
    await this.checkCommand("enter compressed flash mode", this.ESP_FLASH_DEFL_BEGIN, pkt, void 0, void 0, timeout);
    const t2 = d.getTime();
    if (size != 0 && this.IS_STUB === false) {
      this.info("Took " + (t2 - t1) / 1e3 + "." + (t2 - t1) % 1e3 + "s to erase flash block");
    }
    return numBlocks;
  }
  /**
   * Write block to flash, retry if fail
   * @param {Uint8Array} data Unsigned 8-bit array data.
   * @param {number} seq Sequence number
   * @param {number} timeout Timeout in milliseconds (ms)
   * @returns {Promise<void>} Promise that resolves when the block is written.
   */
  async flashBlock(data, seq, timeout) {
    let pkt = this._appendArray(this._intToByteArray(data.length), this._intToByteArray(seq));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, data);
    const checksum2 = this.checksum(data);
    await this.checkCommand("write to target Flash after seq " + seq, this.ESP_FLASH_DATA, pkt, checksum2, void 0, timeout);
  }
  /**
   * Write block to flash, send compressed, retry if fail
   * @param {Uint8Array} data Unsigned int 8-bit array data to write
   * @param {number} seq Sequence number
   * @param {number} timeout Timeout in milliseconds (ms)
   */
  async flashDeflBlock(data, seq, timeout) {
    let pkt = this._appendArray(this._intToByteArray(data.length), this._intToByteArray(seq));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, data);
    const checksum2 = this.checksum(data);
    this.debug("flash_defl_block " + data[0].toString(16) + " " + data[1].toString(16));
    await this.checkCommand("write compressed data to flash after seq " + seq, this.ESP_FLASH_DEFL_DATA, pkt, checksum2, void 0, timeout);
  }
  /**
   * Leave flash mode and run/reboot
   * @param {boolean} reboot Reboot after leaving flash mode ?
   * @param {number} timeout Timeout in milliseconds (ms)
   * @returns {Promise<void>} Promise that resolves when the flash mode is left.
   */
  async flashFinish(reboot = false, timeout = this.DEFAULT_TIMEOUT) {
    const val = reboot ? 0 : 1;
    const pkt = this._intToByteArray(val);
    await this.checkCommand("leave Flash mode", this.ESP_FLASH_END, pkt, void 0, void 0, timeout);
  }
  /**
   * Leave compressed flash mode and run/reboot
   * @param {boolean} reboot Reboot after leaving flash mode ?
   * @param {number} timeout Timeout in milliseconds (ms)
   * @returns {Promise<void>} Promise that resolves when the compressed flash mode is left.
   */
  async flashDeflFinish(reboot = false, timeout = this.DEFAULT_TIMEOUT) {
    const val = reboot ? 0 : 1;
    const pkt = this._intToByteArray(val);
    await this.checkCommand("leave compressed flash mode", this.ESP_FLASH_DEFL_END, pkt, void 0, void 0, timeout);
  }
  /**
   * Run an arbitrary SPI flash command.
   *
   * This function uses the "USR_COMMAND" functionality in the ESP
   * SPI hardware, rather than the precanned commands supported by
   * hardware. So the value of spiflashCommand is an actual command
   * byte, sent over the wire.
   *
   * After writing command byte, writes 'data' to MOSI and then
   * reads back 'readBits' of reply on MISO. Result is a number.
   * @param {number} spiflashCommand Command to execute in SPI
   * @param {Uint8Array} data Data to send
   * @param {number} readBits Number of bits to read
   * @param {number} addr Address to use
   * @param {number} addrLen Length of address
   * @param {number} dummyLen length of dummy
   * @returns {number} Register SPI_W0_REG value
   */
  async runSpiflashCommand(spiflashCommand, data, readBits, addr = null, addrLen = 0, dummyLen = 0) {
    const SPI_USR_COMMAND = 1 << 31;
    const SPI_USR_ADDR = 1 << 30;
    const SPI_USR_DUMMY = 1 << 29;
    const SPI_USR_MISO = 1 << 28;
    const SPI_USR_MOSI = 1 << 27;
    const base = this.chip.SPI_REG_BASE;
    const SPI_CMD_REG = base + 0;
    const SPI_ADDR_REG = base + 4;
    const SPI_USR_REG = base + this.chip.SPI_USR_OFFS;
    const SPI_USR1_REG = base + this.chip.SPI_USR1_OFFS;
    const SPI_USR2_REG = base + this.chip.SPI_USR2_OFFS;
    const SPI_W0_REG = base + this.chip.SPI_W0_OFFS;
    let setDataLengths;
    if (this.chip.SPI_MOSI_DLEN_OFFS != null) {
      setDataLengths = async (mosiBits, misoBits) => {
        const SPI_MOSI_DLEN_REG = base + this.chip.SPI_MOSI_DLEN_OFFS;
        const SPI_MISO_DLEN_REG = base + this.chip.SPI_MISO_DLEN_OFFS;
        if (mosiBits > 0) {
          await this.writeReg(SPI_MOSI_DLEN_REG, mosiBits - 1);
        }
        if (misoBits > 0) {
          await this.writeReg(SPI_MISO_DLEN_REG, misoBits - 1);
        }
        let flags2 = 0;
        if (dummyLen > 0) {
          flags2 |= dummyLen - 1;
        }
        if (addrLen > 0) {
          flags2 |= addrLen - 1 << SPI_USR_ADDR_LEN_SHIFT;
        }
        if (flags2) {
          await this.writeReg(SPI_USR1_REG, flags2);
        }
      };
    } else {
      setDataLengths = async (mosiBits, misoBits) => {
        const SPI_DATA_LEN_REG = SPI_USR1_REG;
        const SPI_MOSI_BITLEN_S = 17;
        const SPI_MISO_BITLEN_S = 8;
        const mosiMask = mosiBits === 0 ? 0 : mosiBits - 1;
        const misoMask = misoBits === 0 ? 0 : misoBits - 1;
        let flags2 = misoMask << SPI_MISO_BITLEN_S | mosiMask << SPI_MOSI_BITLEN_S;
        if (dummyLen > 0) {
          flags2 |= dummyLen - 1;
        }
        if (addrLen > 0) {
          flags2 |= addrLen - 1 << SPI_USR_ADDR_LEN_SHIFT;
        }
        await this.writeReg(SPI_DATA_LEN_REG, flags2);
      };
    }
    const SPI_CMD_USR = 1 << 18;
    const SPI_USR2_COMMAND_LEN_SHIFT = 28;
    const SPI_USR_ADDR_LEN_SHIFT = 26;
    if (readBits > 32) {
      throw new ESPError("Reading more than 32 bits back from a SPI flash operation is unsupported");
    }
    if (data.length > 64) {
      throw new ESPError("Writing more than 64 bytes of data with one SPI command is unsupported");
    }
    const dataBits = data.length * 8;
    const oldSpiUsr = await this.readReg(SPI_USR_REG);
    const oldSpiUsr2 = await this.readReg(SPI_USR2_REG);
    let flags = SPI_USR_COMMAND;
    if (readBits > 0) {
      flags |= SPI_USR_MISO;
    }
    if (dataBits > 0) {
      flags |= SPI_USR_MOSI;
    }
    if (addrLen > 0) {
      flags |= SPI_USR_ADDR;
    }
    if (dummyLen > 0) {
      flags |= SPI_USR_DUMMY;
    }
    await setDataLengths(dataBits, readBits);
    await this.writeReg(SPI_USR_REG, flags);
    let val = 7 << SPI_USR2_COMMAND_LEN_SHIFT | spiflashCommand;
    await this.writeReg(SPI_USR2_REG, val);
    if (addr && addrLen > 0) {
      if (this.SPI_ADDR_REG_MSB) {
        addr = addr << 32 - addrLen;
      }
      await this.writeReg(SPI_ADDR_REG, addr);
    }
    if (dataBits == 0) {
      await this.writeReg(SPI_W0_REG, 0);
    } else {
      data = padTo(data, 4, 0);
      const words = [];
      for (let i2 = 0; i2 < data.length; i2 += 4) {
        words.push((data[i2] | data[i2 + 1] << 8 | data[i2 + 2] << 16 | data[i2 + 3] << 24) >>> 0);
      }
      let nextReg = SPI_W0_REG;
      for (const word of words) {
        await this.writeReg(nextReg, word);
        nextReg += 4;
      }
    }
    await this.writeReg(SPI_CMD_REG, SPI_CMD_USR);
    let i;
    for (i = 0; i < 10; i++) {
      val = await this.readReg(SPI_CMD_REG) & SPI_CMD_USR;
      if (val == 0) {
        break;
      }
    }
    if (i === 10) {
      throw new ESPError("SPI command did not complete in time");
    }
    const status = await this.readReg(SPI_W0_REG);
    await this.writeReg(SPI_USR_REG, oldSpiUsr);
    await this.writeReg(SPI_USR2_REG, oldSpiUsr2);
    return status;
  }
  /**
   * Read flash id by executing the SPIFLASH_RDID flash command.
   * @returns {Promise<number>} Register SPI_W0_REG value
   */
  async readFlashId() {
    const SPIFLASH_RDID = 159;
    const pkt = new Uint8Array(0);
    return await this.runSpiflashCommand(SPIFLASH_RDID, pkt, 24);
  }
  /**
   * Execute the erase flash command
   * @returns {Promise<number | Uint8Array>} Erase flash command result
   */
  async eraseFlash() {
    this.info("Erasing flash (this may take a while)...");
    let d = /* @__PURE__ */ new Date();
    const t1 = d.getTime();
    const ret = await this.checkCommand("erase flash", this.ESP_ERASE_FLASH, void 0, void 0, void 0, this.CHIP_ERASE_TIMEOUT);
    d = /* @__PURE__ */ new Date();
    const t2 = d.getTime();
    this.info("Chip erase completed successfully in " + (t2 - t1) / 1e3 + "s");
    return ret;
  }
  /**
   * Convert a number or unsigned 8-bit array to hex string
   * @param {number | Uint8Array } buffer Data to convert to hex string.
   * @returns {string} A hex string
   */
  toHex(buffer) {
    return Array.prototype.map.call(buffer, (x) => ("00" + x.toString(16)).slice(-2)).join("");
  }
  /**
   * Calculate the MD5 Checksum command
   * @param {number} addr Address number
   * @param {number} size Package size
   * @returns {string} MD5 Checksum string
   */
  async flashMd5sum(addr, size) {
    const timeout = this.timeoutPerMb(this.MD5_TIMEOUT_PER_MB, size);
    let pkt = this._appendArray(this._intToByteArray(addr), this._intToByteArray(size));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    pkt = this._appendArray(pkt, this._intToByteArray(0));
    const RESP_DATA_LEN = 32;
    const RESP_DATA_LEN_STUB = 16;
    const RESP_DATA_LEN_TO_USE = this.IS_STUB ? RESP_DATA_LEN_STUB : RESP_DATA_LEN;
    const res = await this.checkCommand("calculate md5sum", this.ESP_SPI_FLASH_MD5, pkt, void 0, RESP_DATA_LEN_TO_USE, timeout);
    const strmd5 = this.toHex(res);
    return strmd5;
  }
  /**
   * Read flash memory from the chip.
   * @param {number} addr Address number
   * @param {number} size Package size
   * @param {FlashReadCallback} onPacketReceived Callback function to call when packet is received
   * @returns {Uint8Array} Flash read data
   */
  async readFlash(addr, size, onPacketReceived = null) {
    let pkt = this._appendArray(this._intToByteArray(addr), this._intToByteArray(size));
    pkt = this._appendArray(pkt, this._intToByteArray(4096));
    pkt = this._appendArray(pkt, this._intToByteArray(1024));
    const res = await this.checkCommand("read flash", this.ESP_READ_FLASH, pkt);
    if (res != 0) {
      throw new ESPError("Failed to read memory: " + res);
    }
    let resp = new Uint8Array(0);
    while (resp.length < size) {
      const packet = await this.transport.read(this.FLASH_READ_TIMEOUT);
      if (packet instanceof Uint8Array) {
        if (packet.length > 0) {
          resp = this._appendArray(resp, packet);
          await this.transport.write(this._intToByteArray(resp.length));
          if (onPacketReceived) {
            onPacketReceived(packet, resp.length, size);
          }
        }
      } else {
        throw new ESPError("Failed to read memory: " + packet);
      }
    }
    return resp;
  }
  /**
   * Upload the flasher ROM bootloader (flasher stub) to the chip.
   * @returns {ROM} The Chip ROM
   */
  async runStub() {
    if (this.syncStubDetected) {
      this.info("Stub is already running. No upload is necessary.");
      return this.chip;
    }
    this.info("Uploading stub...");
    const chipRevision = this.chip.getChipRevision ? await this.chip.getChipRevision(this) : void 0;
    const stubFlasher = await getStubJsonByChipName(this.chip.CHIP_NAME, chipRevision);
    if (stubFlasher === void 0) {
      this.debug("Error loading Stub json");
      throw new Error("Error loading Stub json");
    }
    const stub = [stubFlasher.decodedText, stubFlasher.decodedData];
    for (let i = 0; i < stub.length; i++) {
      if (stub[i]) {
        const offs = i === 0 ? stubFlasher.text_start : stubFlasher.data_start;
        const length = stub[i].length;
        const blocks = Math.floor((length + this.ESP_RAM_BLOCK - 1) / this.ESP_RAM_BLOCK);
        await this.memBegin(length, blocks, this.ESP_RAM_BLOCK, offs);
        for (let seq = 0; seq < blocks; seq++) {
          const fromOffs = seq * this.ESP_RAM_BLOCK;
          const toOffs = fromOffs + this.ESP_RAM_BLOCK;
          await this.memBlock(stub[i].slice(fromOffs, toOffs), seq);
        }
      }
    }
    this.info("Running stub...");
    await this.memFinish(stubFlasher.entry);
    const packetResult = await this.transport.read(this.DEFAULT_TIMEOUT);
    const packetStr = String.fromCharCode(...packetResult);
    if (packetStr !== "OHAI") {
      throw new ESPError(`Failed to start stub. Unexpected response ${packetStr}`);
    }
    this.info("Stub running...");
    this.IS_STUB = true;
    return this.chip;
  }
  /**
   * Change the chip baudrate.
   */
  async changeBaud() {
    this.info("Changing baudrate to " + this.baudrate);
    const secondArg = this.IS_STUB ? this.romBaudrate : 0;
    const pkt = this._appendArray(this._intToByteArray(this.baudrate), this._intToByteArray(secondArg));
    await this.command(this.ESP_CHANGE_BAUDRATE, pkt);
    this.info("Changed");
    this.info("If the chip does not respond to any further commands, consider using a lower baud rate.");
    await sleep$1(50);
    await this.transport.disconnect();
    await sleep$1(50);
    await this.transport.connect(this.baudrate, this.serialOptions);
    await sleep$1(50);
    this.transport.readLoop();
  }
  /**
   * Execute the main function of ESPLoader.
   * @param {string} mode Reset mode to use
   * @returns {string} chip ROM
   */
  async main(mode = "default_reset") {
    await this.detectChip(mode);
    const chip = await this.chip.getChipDescription(this);
    if (this.chip.getChipRevision) {
      const chipRevision = await this.chip.getChipRevision(this);
      this.info("Chip Revision: " + chipRevision);
    }
    this.info("Chip is " + chip);
    this.info("Features: " + await this.chip.getChipFeatures(this));
    this.info("Crystal is " + await this.chip.getCrystalFreq(this) + "MHz");
    this.info("MAC: " + await this.chip.readMac(this));
    await this.chip.readMac(this);
    if (typeof this.chip.postConnect != "undefined") {
      await this.chip.postConnect(this);
    }
    await this.runStub();
    if (this.romBaudrate !== this.baudrate) {
      await this.changeBaud();
    }
    try {
      const flashId = await this.readFlashId();
      this.info("Flash ID: " + flashId.toString(16));
      if (flashId === 16777215 || flashId === 0) {
        this.info(`WARNING: Failed to communicate with the flash chip,
read/write operations will fail.
Try checking the chip connections or removing
any other hardware connected to IOs.`);
      }
    } catch (error) {
      throw new ESPError("Unable to verify flash chip connection " + error);
    }
    return chip;
  }
  /**
   * Get flash size bytes from flash size string.
   * @param {string} flashSize Flash Size string
   * @returns {number} Flash size bytes
   */
  flashSizeBytes(flashSize) {
    let flashSizeB = -1;
    this.transport.trace(`Flash size string ${flashSize}`);
    if (flashSize.toString().indexOf("KB") !== -1) {
      flashSizeB = parseInt(flashSize.toString().slice(0, flashSize.toString().indexOf("KB"))) * 1024;
    } else if (flashSize.toString().indexOf("MB") !== -1) {
      flashSizeB = parseInt(flashSize.toString().slice(0, flashSize.toString().indexOf("MB"))) * 1024 * 1024;
    }
    this.transport.trace(`Flash size in bytes ${flashSizeB}`);
    return flashSizeB;
  }
  /**
   * Parse a given flash size string to a number
   * @param {string} flsz Flash size to request
   * @returns {number} Flash size number
   */
  parseFlashSizeArg(flsz) {
    if (typeof this.chip.FLASH_SIZES[flsz] === "undefined") {
      throw new ESPError("Flash size " + flsz + " is not supported by this chip type. Supported sizes: " + this.chip.FLASH_SIZES);
    }
    return this.chip.FLASH_SIZES[flsz];
  }
  /**
   * Update the image flash parameters with given arguments.
   * @param {Uint8Array} image binary image as Uint8Array
   * @param {number} address flash address number
   * @param {FlashModeValues} flashMode Flash mode string
   * @param {FlashFreqValues} flashFreq Flash frequency string
   * @param {FlashSizeValues} flashSize Flash size string
   * @returns {Uint8Array} modified image Uint8Array
   */
  async _updateImageFlashParams(image, address, flashMode = "keep", flashFreq = "keep", flashSize = "keep") {
    this.debug(`_update_image_flash_params ${flashSize} ${flashMode} ${flashFreq}`);
    if (image.length < 8) {
      return image;
    }
    if (address != this.chip.BOOTLOADER_FLASH_OFFSET) {
      return image;
    }
    if (flashSize === "keep" && flashMode === "keep" && flashFreq === "keep") {
      this.info("Not changing the image");
      return image;
    }
    const magic = image[0];
    let aFlashMode = image[2];
    const flashSizeFreq = image[3];
    if (magic !== this.ESP_IMAGE_MAGIC) {
      this.info("Warning: Image file at 0x" + address.toString(16) + " doesn't look like an image file, so not changing any flash settings.");
      return image;
    }
    try {
      const imageObject = await loadFirmwareImage(this.chip, image);
      imageObject.verify();
    } catch (error) {
      this.debug(`Warning: Image file at 0x${address.toString(16)} is not a valid ${this.chip.CHIP_NAME} image, so not changing any flash settings.`);
      return image;
    }
    const shaAppended = this.chip.CHIP_NAME !== "ESP8266" && image[8 + 15] === 49;
    if (flashMode !== "keep") {
      const flashModes = { qio: 0, qout: 1, dio: 2, dout: 3 };
      aFlashMode = flashModes[flashMode];
    }
    let aFlashFreq = flashSizeFreq & 15;
    if (flashFreq !== "keep") {
      const flashFreqs = { "40m": 0, "26m": 1, "20m": 2, "80m": 15 };
      aFlashFreq = flashFreqs[flashFreq];
    }
    let aFlashSize = flashSizeFreq & 240;
    if (flashSize !== "keep") {
      if (flashSize === "detect") {
        this.info("Configuring flash size...");
        const detectedFlashSize = await this.detectFlashSize();
        this.info("Detected flash size set to " + detectedFlashSize);
        aFlashSize = this.parseFlashSizeArg(detectedFlashSize);
      } else {
        aFlashSize = this.parseFlashSizeArg(flashSize);
      }
    }
    const flashParams = aFlashMode << 8 | aFlashFreq + aFlashSize;
    this.info("Flash params set to " + flashParams.toString(16));
    const updatedImage = new Uint8Array(image);
    if (image[2] !== aFlashMode) {
      updatedImage[2] = aFlashMode;
    }
    if (image[3] !== aFlashFreq + aFlashSize) {
      updatedImage[3] = aFlashFreq + aFlashSize;
    }
    if (shaAppended) {
      const imageObject = await loadFirmwareImage(this.chip, updatedImage);
      const imageDataBeforeSha = updatedImage.slice(0, imageObject.datalength);
      const imageDataAfterSha = updatedImage.slice(imageObject.datalength + imageObject.SHA256_DIGEST_LEN);
      const shaDigestCalculated = await crypto.subtle.digest("SHA-256", imageDataAfterSha);
      const shaDigestCalculatedUintArray = new Uint8Array(shaDigestCalculated);
      const finalImage = new Uint8Array(imageDataBeforeSha.length + shaDigestCalculatedUintArray.length + imageDataAfterSha.length);
      finalImage.set(imageDataBeforeSha, 0);
      finalImage.set(shaDigestCalculatedUintArray, imageDataBeforeSha.length);
      finalImage.set(imageDataAfterSha, imageDataBeforeSha.length + shaDigestCalculatedUintArray.length);
      const imageStoredSha = finalImage.slice(imageObject.datalength, imageObject.datalength + imageObject.SHA256_DIGEST_LEN);
      if (this.transport.hexify(shaDigestCalculatedUintArray) === this.transport.hexify(imageStoredSha)) {
        this.info("SHA digest in image updated");
      } else {
        this.info(`WARNING: SHA recalculation for binary failed!
	Expected calculated SHA: ${this.transport.hexify(shaDigestCalculatedUintArray)}
	SHA stored in binary:    ${this.transport.hexify(imageStoredSha)}`);
      }
      return finalImage;
    }
    return updatedImage;
  }
  /**
   * Write set of file images into given address based on given FlashOptions object.
   * @param {FlashOptions} options FlashOptions to configure how and what to write into flash.
   */
  async writeFlash(options) {
    this.debug("EspLoader program");
    if (options.flashSize !== "keep") {
      const flashEnd = this.flashSizeBytes(options.flashSize);
      for (let i = 0; i < options.fileArray.length; i++) {
        if (options.fileArray[i].data.length + options.fileArray[i].address > flashEnd) {
          throw new ESPError(`File ${i + 1} doesn't fit in the available flash`);
        }
      }
    }
    if (this.IS_STUB === true && options.eraseAll === true) {
      await this.eraseFlash();
    }
    let image, address;
    for (let i = 0; i < options.fileArray.length; i++) {
      this.debug("Data Length " + options.fileArray[i].data.length);
      image = options.fileArray[i].data;
      this.debug("Image Length " + image.length);
      if (image.length === 0) {
        this.debug("Warning: File is empty");
        continue;
      }
      image = padTo(image, 4);
      address = options.fileArray[i].address;
      image = await this._updateImageFlashParams(image, address, options.flashMode, options.flashFreq, options.flashSize);
      let calcmd5 = null;
      if (options.calculateMD5Hash) {
        calcmd5 = options.calculateMD5Hash(image);
        this.debug("Image MD5 " + calcmd5);
      }
      const uncsize = image.length;
      let blocks;
      if (options.compress) {
        const compressedImage = deflate_1(image, { level: 9 });
        image = compressedImage;
        blocks = await this.flashDeflBegin(uncsize, image.length, address);
      } else {
        blocks = await this.flashBegin(uncsize, address);
      }
      let seq = 0;
      let bytesSent = 0;
      const totalBytes = image.length;
      if (options.reportProgress)
        options.reportProgress(i, 0, totalBytes);
      let d = /* @__PURE__ */ new Date();
      const t1 = d.getTime();
      let timeout = 5e3;
      const inflate = new Inflate_1({ chunkSize: 1 });
      let totalLenUncompressed = 0;
      inflate.onData = function(chunk) {
        totalLenUncompressed += chunk.byteLength;
      };
      let imageOffset = 0;
      while (imageOffset < image.length) {
        this.debug("Write loop " + address + " " + seq + " " + blocks);
        this.info("Writing at 0x" + (address + totalLenUncompressed).toString(16) + "... (" + Math.floor(100 * (seq + 1) / blocks) + "%)");
        const blockSize = Math.min(this.FLASH_WRITE_SIZE, image.length - imageOffset);
        const block = image.slice(imageOffset, imageOffset + blockSize);
        const isLastBlock = imageOffset + blockSize >= image.length;
        if (options.compress) {
          const lenUncompressedPrevious = totalLenUncompressed;
          inflate.push(block, isLastBlock);
          const blockUncompressed = totalLenUncompressed - lenUncompressedPrevious;
          let blockTimeout = 3e3;
          if (this.timeoutPerMb(this.ERASE_WRITE_TIMEOUT_PER_MB, blockUncompressed) > 3e3) {
            blockTimeout = this.timeoutPerMb(this.ERASE_WRITE_TIMEOUT_PER_MB, blockUncompressed);
          }
          if (this.IS_STUB === false) {
            timeout = blockTimeout;
          }
          await this.flashDeflBlock(block, seq, timeout);
          if (this.IS_STUB) {
            timeout = blockTimeout;
          }
        } else {
          throw new ESPError("Yet to handle Non Compressed writes");
        }
        bytesSent += block.length;
        imageOffset += blockSize;
        seq++;
        if (options.reportProgress)
          options.reportProgress(i, bytesSent, totalBytes);
      }
      if (this.IS_STUB) {
        if (options.compress) {
          await this.flashDeflFinish(false, timeout);
        } else {
          await this.flashFinish(false, timeout);
        }
      }
      d = /* @__PURE__ */ new Date();
      const t = d.getTime() - t1;
      if (options.compress) {
        this.info("Wrote " + uncsize + " bytes (" + bytesSent + " compressed) at 0x" + address.toString(16) + " in " + t / 1e3 + " seconds.");
      }
      if (calcmd5) {
        this.info("File  md5: " + calcmd5);
        const res = await this.flashMd5sum(address, uncsize);
        this.info("Flash md5: " + res);
        if (new String(res).valueOf() != new String(calcmd5).valueOf()) {
          throw new ESPError("MD5 of file does not match data in flash!");
        } else {
          this.info("Hash of data verified.");
        }
      }
    }
    this.info("Leaving...");
  }
  /**
   * Read SPI flash manufacturer and device id.
   */
  async flashId() {
    this.debug("flash_id");
    const flashid = await this.readFlashId();
    this.info("Manufacturer: " + (flashid & 255).toString(16));
    const flidLowbyte = flashid >> 16 & 255;
    this.info("Device: " + (flashid >> 8 & 255).toString(16) + flidLowbyte.toString(16));
    this.info("Detected flash size: " + this.DETECTED_FLASH_SIZES[flidLowbyte]);
  }
  async detectFlashSize() {
    this.debug("detectFlashSize");
    const flashid = await this.readFlashId();
    const sizeId = flashid >> 16 & 255;
    let flashSizeStr = this.DETECTED_FLASH_SIZES[sizeId];
    if (!flashSizeStr) {
      flashSizeStr = "4MB";
      this.info("Could not auto-detect Flash size. defaulting to 4MB");
    } else {
      this.info("Auto-detected Flash size: " + flashSizeStr);
    }
    return flashSizeStr;
  }
  /**
   * Soft reset the device chip. Soft reset with run user code is the closest.
   * @param {boolean} stayInBootloader Flag to indicate if to stay in bootloader
   */
  async softReset(stayInBootloader) {
    if (!this.IS_STUB) {
      if (stayInBootloader) {
        return;
      }
      await this.flashBegin(0, 0);
      await this.flashFinish(false);
    } else if (this.chip.CHIP_NAME != "ESP8266") {
      throw new ESPError("Soft resetting is currently only supported on ESP8266");
    } else {
      if (stayInBootloader) {
        await this.flashBegin(0, 0);
        await this.flashFinish(true);
      } else {
        await this.command(this.ESP_RUN_USER_CODE, void 0, void 0, false);
      }
    }
  }
  /**
   * Execute this function to execute after operation reset functions.
   * @param {After} mode After operation mode. Default is 'hard_reset'.
   * @param { boolean } usingUsbOtg For 'hard_reset' to specify if using USB-OTG
   * @param {string} sequenceString For 'custom_reset' to specify the custom reset sequence string
   */
  async after(mode = "hard_reset", usingUsbOtg, sequenceString) {
    switch (mode) {
      case "hard_reset":
        if (this.resetConstructors.hardReset) {
          this.info("Hard resetting via RTS pin...");
          const hardReset = this.resetConstructors.hardReset(this.transport, usingUsbOtg);
          await hardReset.reset();
        }
        break;
      case "soft_reset":
        this.info("Soft resetting...");
        await this.softReset(false);
        break;
      case "no_reset_stub":
        this.info("Staying in flasher stub.");
        break;
      case "custom_reset":
        if (!sequenceString) {
          this.info("Custom reset sequence not provided, doing nothing.");
        }
        if (!this.resetConstructors.customReset) {
          this.info("Custom reset constructor not available, doing nothing.");
        }
        if (this.resetConstructors.customReset && sequenceString) {
          this.info("Custom resetting using sequence " + sequenceString);
          const customReset = this.resetConstructors.customReset(this.transport, sequenceString);
          await customReset.reset();
        }
        break;
      default:
        this.info("Staying in bootloader.");
        if (this.IS_STUB) {
          this.softReset(true);
        }
        break;
    }
  }
}
const TARGET_VID$1 = "303a";
const APP_FLASH_ADDR = 65536;
class NodeSerialPort {
  constructor(_path) {
    __publicField(this, "readable", null);
    __publicField(this, "writable", null);
    __publicField(this, "port", null);
    this._path = _path;
  }
  async open(opts) {
    this.port = new SerialPort({ path: this._path, baudRate: opts.baudRate, autoOpen: false });
    await new Promise((res, rej) => this.port.open((e) => e ? rej(e) : res()));
    this.readable = new ReadableStream({
      start: (controller) => {
        this.port.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
        this.port.on("close", () => controller.close());
        this.port.on("error", (e) => controller.error(e));
      }
    });
    this.writable = new WritableStream({
      write: (chunk) => new Promise(
        (res, rej) => this.port.write(Buffer.from(chunk), (e) => e ? rej(e) : res())
      )
    });
  }
  async close() {
    var _a;
    if ((_a = this.port) == null ? void 0 : _a.isOpen) {
      await new Promise((res) => this.port.close(() => res()));
    }
    this.readable = null;
    this.writable = null;
    this.port = null;
  }
  async setSignals(s) {
    const opts = {};
    if (s.dataTerminalReady !== void 0) opts.dtr = s.dataTerminalReady;
    if (s.requestToSend !== void 0) opts.rts = s.requestToSend;
    await new Promise((res) => this.port.set(opts, () => res()));
  }
  getInfo() {
    return { usbVendorId: 12346 };
  }
}
async function triggerBootloaderReset(portPath) {
  const p = new SerialPort({ path: portPath, baudRate: 1200, autoOpen: false });
  await new Promise((res, rej) => p.open((e) => e ? rej(e) : res()));
  await new Promise((res) => setTimeout(res, 300));
  await new Promise((res) => p.close(() => res()));
}
async function findEspPort(maxWaitMs = 1e4) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 400));
    const ports = await SerialPort.list();
    const esp = ports.find((p) => {
      var _a;
      return ((_a = p.vendorId) == null ? void 0 : _a.toLowerCase()) === TARGET_VID$1;
    });
    if (esp) return esp.path;
  }
  throw new Error(
    "ESP32 not found in bootloader mode. Try holding the BOOT button and pressing RESET on the device, then retry."
  );
}
async function flashFirmware(portPath, firmware, onProgress) {
  onProgress(5, "Connecting to bootloader...");
  const device = new NodeSerialPort(portPath);
  const transport = new Transport(device, false);
  const loader = new ESPLoader({
    transport,
    baudrate: 115200,
    terminal: {
      clean: () => {
      },
      writeLine: (s) => console.log("[esptool]", s),
      write: (s) => process.stdout.write(s)
    }
  });
  await loader.main("no_reset");
  onProgress(15, "Chip detected. Writing firmware...");
  await loader.writeFlash({
    fileArray: [{ data: firmware, address: APP_FLASH_ADDR }],
    flashSize: "keep",
    flashMode: "dio",
    flashFreq: "80m",
    eraseAll: false,
    compress: true,
    reportProgress: (_i, written, total) => {
      const pct = 15 + Math.round(written / total * 80);
      onProgress(pct, `Writing ${pct}%`);
    }
  });
  onProgress(97, "Resetting device...");
  await loader.after("hard_reset");
  await transport.disconnect();
  onProgress(100, "Done!");
}
function createJsonStore(filename) {
  const filePath = join(app.getPath("userData"), filename);
  function readAll() {
    if (!existsSync(filePath)) return [];
    try {
      return JSON.parse(readFileSync(filePath, "utf8"));
    } catch (err2) {
      console.error(`[store] failed to parse ${filename}:`, err2.message);
      return [];
    }
  }
  function writeAll(items) {
    writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
  }
  return {
    list() {
      return readAll();
    },
    create(data) {
      const now = Date.now();
      const item = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
      const items = readAll();
      items.push(item);
      writeAll(items);
      return item;
    },
    update(id, patch) {
      const items = readAll();
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const updated = { ...items[index], ...patch, updatedAt: Date.now() };
      items[index] = updated;
      writeAll(items);
      return updated;
    },
    remove(id) {
      writeAll(readAll().filter((item) => item.id !== id));
    }
  };
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
let activePort = null;
let mainWindow = null;
let autoConnectTimer = null;
let windowTrackerTimer = null;
let isConnecting = false;
let isDeviceConnected = false;
let lastCategory = null;
let isPomodoroActive = false;
let isFlashing = false;
let deviceFirmwareVersion = null;
const TARGET_VID = "303a";
const FOCUS_APPS = /* @__PURE__ */ new Set([
  // editors / IDEs
  "code",
  "code - oss",
  "code - insiders",
  "vscodium",
  "codium",
  "idea",
  "idea64",
  "intellij idea",
  "intellij idea community edition",
  "webstorm",
  "webstorm64",
  "pycharm",
  "pycharm64",
  "pycharm community edition",
  "clion",
  "clion64",
  "goland",
  "goland64",
  "rider",
  "rider64",
  "sublime text",
  "sublime_text",
  "subl",
  "vim",
  "gvim",
  "nvim",
  "emacs",
  "emacs-gtk",
  "gedit",
  "kate",
  "kwrite",
  "mousepad",
  "textmate",
  "xcode",
  // macOS
  "devenv",
  // Visual Studio (Windows)
  "notepad++",
  // Windows
  "eclipse",
  "android studio",
  "arduino ide",
  "arduino-ide",
  // terminals
  "gnome-terminal-server",
  "konsole",
  "xterm",
  "alacritty",
  "kitty",
  "xfce4-terminal",
  "terminal",
  "iterm2",
  "iterm",
  // macOS
  "windowsterminal",
  "cmd",
  "powershell",
  "pwsh"
  // Windows
]);
const RELAX_APPS = /* @__PURE__ */ new Set([
  // browsers
  "google-chrome",
  "google-chrome-stable",
  "google chrome",
  "chrome",
  "firefox",
  "firefox-esr",
  "microsoft-edge",
  "microsoft edge",
  "msedge",
  "safari",
  // macOS
  "brave-browser",
  "brave",
  "chromium",
  "chromium-browser",
  "opera",
  // media
  "spotify",
  "vlc",
  // chat / social
  "discord",
  "slack",
  "telegram",
  "telegram desktop",
  "microsoft teams",
  "teams",
  // games
  "steam"
]);
function classifyApp(appName) {
  if (!appName) return "idle";
  if (FOCUS_APPS.has(appName)) return "focus";
  if (RELAX_APPS.has(appName)) return "relax";
  return "idle";
}
const ANIM_PACKET = {
  focus: "#ANIM:focus\n",
  relax: "#ANIM:relax\n",
  idle: "#ANIM:idle\n"
};
const MODE_LABEL = {
  focus: "WORKING",
  relax: "RELAX",
  idle: "IDLE"
};
const WIN_PS_ENCODED = process.platform === "win32" ? Buffer.from(
  `$code=@"
using System;
using System.Runtime.InteropServices;
public class WinFG {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
}
"@
Add-Type -TypeDefinition $code -Language CSharp -EA SilentlyContinue
$h=[WinFG]::GetForegroundWindow();$p=[uint32]0
[WinFG]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null
try{(Get-Process -Id $p -EA Stop).ProcessName}catch{Write-Output ""}`,
  "utf16le"
).toString("base64") : "";
async function getActiveWindowApp() {
  try {
    if (process.platform === "linux") {
      const winIdOut = execSync("xprop -root _NET_ACTIVE_WINDOW", { encoding: "utf8", timeout: 800 });
      const winIdMatch = winIdOut.match(/0x[0-9a-f]+/i);
      if (!winIdMatch) return null;
      const classOut = execSync(`xprop -id ${winIdMatch[0]} WM_CLASS`, { encoding: "utf8", timeout: 800 });
      const classMatch = classOut.match(/"([^"]+)"/);
      return classMatch ? classMatch[1].toLowerCase() : null;
    }
    if (process.platform === "darwin") {
      const out = execSync(
        `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
        { encoding: "utf8", timeout: 1500 }
      );
      return out.trim().toLowerCase() || null;
    }
    if (process.platform === "win32") {
      return new Promise((resolve) => {
        exec(
          `powershell -NoProfile -NonInteractive -EncodedCommand ${WIN_PS_ENCODED}`,
          { timeout: 4e3 },
          (err2, stdout) => resolve(err2 ? null : stdout.trim().toLowerCase() || null)
        );
      });
    }
    return null;
  } catch {
    return null;
  }
}
function startWindowTracker() {
  let isChecking = false;
  windowTrackerTimer = setInterval(async () => {
    if (!isDeviceConnected || !(activePort == null ? void 0 : activePort.isOpen) || isChecking || isPomodoroActive) return;
    isChecking = true;
    try {
      const appName = await getActiveWindowApp();
      const category = classifyApp(appName);
      if (category === lastCategory) return;
      lastCategory = category;
      activePort.write(ANIM_PACKET[category], (err2) => {
        if (err2) console.error("[window-tracker] write error:", err2.message);
        else {
          console.log(`[window-tracker] → ${MODE_LABEL[category]} (app: ${appName ?? "unknown"})`);
          mainWindow == null ? void 0 : mainWindow.webContents.send("tracker:mode", MODE_LABEL[category]);
        }
      });
    } finally {
      isChecking = false;
    }
  }, 1500);
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname$1, "preload.mjs"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    startAutoConnectScanner();
    startWindowTracker();
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(
        (err2) => console.warn("[updater] check failed:", err2.message)
      );
    }
  });
  if (process.env["VITE_DEV_SERVER_URL"]) {
    mainWindow.loadURL(process.env["VITE_DEV_SERVER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname$1, "../dist/index.html"));
  }
}
function notifyDisconnected() {
  if (!isDeviceConnected) return;
  isDeviceConnected = false;
  lastCategory = null;
  deviceFirmwareVersion = null;
  mainWindow == null ? void 0 : mainWindow.webContents.send("serial:status", "disconnected");
}
function startAutoConnectScanner() {
  autoConnectTimer = setInterval(async () => {
    if (activePort && activePort.isOpen || isConnecting || isFlashing) return;
    try {
      const ports = await SerialPort.list();
      const targetDevice = ports.find((p) => {
        var _a;
        return ((_a = p.vendorId) == null ? void 0 : _a.toLowerCase()) === TARGET_VID;
      });
      const espPorts = ports.filter((p) => {
        var _a;
        return ((_a = p.vendorId) == null ? void 0 : _a.toLowerCase()) === TARGET_VID;
      });
      if (espPorts.length > 1) {
        console.warn("[scanner] Знайдено декілька ESP32 портів:", espPorts.map((p) => `${p.path} (PID:${p.productId})`).join(", "));
      }
      if (targetDevice) {
        console.log(`[scanner] Підключаюсь до ${targetDevice.path} (PID:${targetDevice.productId})...`);
        isConnecting = true;
        activePort = new SerialPort({ path: targetDevice.path, baudRate: 115200 }, (err2) => {
          isConnecting = false;
          if (err2) {
            console.error("Помилка автопідключення:", err2.message);
            activePort = null;
            return;
          }
          const thisPort = activePort;
          thisPort.set({ dtr: true }, (setErr) => {
            if (setErr) console.warn("[serial] DTR set error:", setErr.message);
          });
          isDeviceConnected = true;
          mainWindow == null ? void 0 : mainWindow.webContents.send("serial:status", "connected", targetDevice.path);
          thisPort.on("data", (data) => {
            const str = data.toString();
            const match = str.match(/FIRMWARE:([^\r\n]+)/);
            if (match) deviceFirmwareVersion = match[1].trim();
            mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", str);
          });
          thisPort.on("close", () => {
            if (activePort === thisPort) activePort = null;
            notifyDisconnected();
          });
          thisPort.on("error", (portErr) => {
            console.error("Serial port error:", portErr.message);
            if (activePort === thisPort) activePort = null;
            notifyDisconnected();
          });
        });
      } else {
        notifyDisconnected();
      }
    } catch (err2) {
      console.error("Помилка сканера портів:", err2);
    }
  }, 2e3);
}
app.whenReady().then(() => {
  const todoStore = createJsonStore("todos.json");
  const pomodoroStore = createJsonStore("pomodoros.json");
  ipcMain.handle("todos:list", () => todoStore.list());
  ipcMain.handle("todos:create", (_, data) => todoStore.create(data));
  ipcMain.handle("todos:update", (_, id, patch) => todoStore.update(id, patch));
  ipcMain.handle("todos:remove", (_, id) => todoStore.remove(id));
  ipcMain.handle("pomodoros:list", () => pomodoroStore.list());
  ipcMain.handle("pomodoros:create", (_, data) => pomodoroStore.create(data));
  ipcMain.handle("pomodoros:update", (_, id, patch) => pomodoroStore.update(id, patch));
  ipcMain.handle("pomodoros:remove", (_, id) => pomodoroStore.remove(id));
  createWindow();
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (autoConnectTimer) clearInterval(autoConnectTimer);
  if (windowTrackerTimer) clearInterval(windowTrackerTimer);
  if (process.platform !== "darwin") {
    app.quit();
  }
});
autoUpdater.on("update-downloaded", () => {
  mainWindow == null ? void 0 : mainWindow.webContents.send("update:ready");
});
ipcMain.on("update:install", () => autoUpdater.quitAndInstall());
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "gaze-buddy-hub", Accept: "application/vnd.github.v3+json" } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          httpsGet(res.headers.location).then(resolve, reject);
          return;
        }
        let body = "";
        res.on("data", (c) => body += c);
        res.on("end", () => resolve(body));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(1e4, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}
function httpsBinary(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "gaze-buddy-hub" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        httpsBinary(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(6e4, () => {
      req.destroy();
      reject(new Error("Download timeout"));
    });
  });
}
async function fetchLatestRelease() {
  var _a, _b;
  try {
    const body = await httpsGet("https://api.github.com/repos/myk-d/desk-buddy/releases/latest");
    const release = JSON.parse(body);
    const version = (_a = release.tag_name) == null ? void 0 : _a.replace(/^v/, "");
    const asset = (_b = release.assets) == null ? void 0 : _b.find(
      (a) => a.name === "firmware.bin"
    );
    if (!version || !asset) return null;
    return { version, firmwareUrl: asset.browser_download_url };
  } catch {
    return null;
  }
}
ipcMain.handle("firmware:getDeviceVersion", () => deviceFirmwareVersion);
ipcMain.handle("firmware:checkUpdate", () => fetchLatestRelease());
ipcMain.handle("firmware:flash", async () => {
  if (isFlashing) throw new Error("Already flashing");
  isFlashing = true;
  const portPath = (activePort == null ? void 0 : activePort.path) ?? null;
  if (autoConnectTimer) {
    clearInterval(autoConnectTimer);
    autoConnectTimer = null;
  }
  if (activePort == null ? void 0 : activePort.isOpen) {
    await new Promise((res) => activePort.close(() => res()));
    activePort = null;
  }
  notifyDisconnected();
  try {
    mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:progress", 1, "Fetching release info...");
    const release = await fetchLatestRelease();
    if (!release) throw new Error("No firmware.bin found in latest GitHub release.");
    mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:progress", 2, "Downloading firmware...");
    const bin = await httpsBinary(release.firmwareUrl);
    mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:progress", 4, "Triggering bootloader reset...");
    if (portPath) await triggerBootloaderReset(portPath);
    mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:progress", 5, "Waiting for bootloader...");
    const bootPath = await findEspPort();
    await flashFirmware(bootPath, new Uint8Array(bin), (pct, status) => {
      mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:progress", pct, status);
    });
    mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:progress", 100, `Firmware ${release.version} installed!`);
    return release.version;
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    mainWindow == null ? void 0 : mainWindow.webContents.send("firmware:error", msg);
    throw err2;
  } finally {
    isFlashing = false;
    startAutoConnectScanner();
  }
});
ipcMain.on("pomodoro:setActive", (_, active) => {
  isPomodoroActive = active;
  if (!active) lastCategory = null;
});
ipcMain.on("serial:send", (_, packet) => {
  const portOpen = (activePort == null ? void 0 : activePort.isOpen) ?? false;
  console.log(`[serial:send] packet=${JSON.stringify(packet)} portOpen=${portOpen}`);
  if (activePort && activePort.isOpen) {
    activePort.write(packet, (writeErr) => {
      if (writeErr) {
        console.error("[serial:send] write error:", writeErr.message);
        mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", `[ERR] write: ${writeErr.message}
`);
        return;
      }
      console.log("[serial:send] write OK");
    });
  } else {
    console.warn("[serial:send] port not open — packet dropped");
    mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", "[ERR] porta не відкрита, пакет скинуто\n");
  }
});
export {
  ROM as R
};

/* 遠賀川水源地ポンプ室 メタバース保存プロジェクト — プロトタイプ v0.3
   Three.js r128 (classic global build) + PointerLockControls

   v0.3 の主な内容:
   - 実物写真ベースの外観再現（非対称の妻面 / 付柱 / 歯飾り / 避雷針マスト /
     漆喰の剥がれ / 越屋根 / 貯水池 / 黄手すり / 鉄塔 / 県道 / 周辺民家）
   - レンガをさらに拡大 (0.6m x 0.24m)
   - レイキャストでレンガを1枚ずつ選択 → 刻印情報ダイアログ
     （個人: 名前/日付/メッセージ、法人: 業種/従業員数/設立/URL など）
*/

(function () {
  "use strict";

  // ---------------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------------
  function rand(min, max) { return min + Math.random() * (max - min); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hsl(h, s, l) { return "hsl(" + Math.round(h) + "," + Math.max(0, Math.round(s)) + "%," + clamp(Math.round(l), 0, 100) + "%)"; }
  function makeCanvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  // ---------------------------------------------------------------
  // レンガ格子（拡大版）と刻印レジストリ
  // ---------------------------------------------------------------
  var PX_PER_M = 110;
  var BRICK_W_M = 0.6;
  var BRICK_H_M = 0.24;
  var MORTAR_M = 0.03;

  // key = "wallId:row:col" -> donor
  var brickRegistry = {};

  var PERSON_NAMES = [
    ["田中 太郎", "田中"], ["鈴木 花子", "鈴木"], ["山田 一郎", "山田"], ["佐藤 未来", "佐藤"],
    ["中村 光", "中村"], ["小林 誠", "小林"], ["加藤 さくら", "加藤"], ["吉田 健", "吉田"],
    ["渡辺 直美", "渡辺"], ["伊藤 大輔", "伊藤"], ["松本 玲奈", "松本"], ["高橋 学", "高橋"],
    ["J. SMITH", "SMITH"], ["K. LEE", "LEE"], ["山口 望", "山口"], ["原田 詩織", "原田"]
  ];
  var PERSON_MSGS = [
    "歴史を未来へ", "ずっと応援しています", "家族の思い出に", "中間市が大好きです",
    "保存活動を応援します", "レンガの美しさに感動", "子どもたちへ贈る", "訪問の記念に",
    "世界遺産を守ろう", "また来ます"
  ];
  var COMPANIES = [
    ["中間建設株式会社", "中間建設", "建設業"],
    ["株式会社遠賀川運輸", "遠賀川運輸", "運送業"],
    ["九州レンガ工業株式会社", "九州レンガ", "窯業・製造業"],
    ["フクオカ電設株式会社", "フクオカ電設", "電気工事業"],
    ["株式会社水巻フーズ", "水巻フーズ", "食品製造業"],
    ["ナカマ印刷株式会社", "ナカマ印刷", "印刷業"]
  ];
  var COMPANY_MSGS = [
    "地域の歴史保存を応援しています", "未来へつなぐ活動に賛同します",
    "世界遺産のまちと共に", "創業の地・筑豊に感謝を込めて"
  ];

  function makeRandomDonor() {
    if (Math.random() < 0.7) {
      var p = choice(PERSON_NAMES);
      return {
        type: "personal", name: p[0], engrave: p[1],
        message: choice(PERSON_MSGS),
        date: "20" + (25 + Math.floor(Math.random() * 2)) + "年" + (1 + Math.floor(Math.random() * 12)) + "月"
      };
    }
    var c = choice(COMPANIES);
    return {
      type: "company", name: c[0], engrave: c[1], industry: c[2],
      employees: (5 + Math.floor(Math.random() * 250)) + "名",
      founded: (1950 + Math.floor(Math.random() * 70)) + "年",
      url: "https://example.co.jp",
      message: choice(COMPANY_MSGS),
      date: "2026年" + (1 + Math.floor(Math.random() * 7)) + "月"
    };
  }

  // 実在アセット提供元（exemate）の見本刻印。正面の目立つ位置に固定配置
  var FEATURED_EXEMATE = {
    type: "company", name: "株式会社エグゼメイト", engrave: "exemate",
    industry: "ITソリューション・システム開発", employees: "45名", founded: "2015年",
    url: "https://exemate.co.jp",
    message: "遠賀川水源地ポンプ室の保存を応援しています。",
    date: "2026年7月"
  };

  // ---------------------------------------------------------------
  // 窓・扉の描画（style: circle / arch / smallarch / niche / door）
  // ---------------------------------------------------------------
  function archPath(ctx, x, y, w, h) {
    var r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0, false);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function drawWindow(ctx, x, y, w, h, style) {
    ctx.save();
    if (style === "circle") {
      var r = w / 2, cx = x + w / 2, cy = y + h / 2;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = "#cfc0a0"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = "#2e5450"; ctx.fill();
      ctx.strokeStyle = "rgba(205,220,214,0.5)";
      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.82, cy); ctx.lineTo(cx + r * 0.82, cy);
      ctx.moveTo(cx, cy - r * 0.82); ctx.lineTo(cx, cy + r * 0.82);
      ctx.stroke();
    } else if (style === "arch") {
      var pad = w * 0.14;
      archPath(ctx, x - pad, y - pad * 0.7, w + pad * 2, h + pad * 1.5);
      ctx.fillStyle = "#cfc0a0"; ctx.fill();
      archPath(ctx, x, y, w, h);
      ctx.fillStyle = "#e9e4d6"; ctx.fill();
      // 下部の青枠窓（白い格子）
      var wy = y + h * 0.62, wh = h * 0.34, wx = x + w * 0.08, ww = w * 0.84;
      ctx.fillStyle = "#2e5c8a"; ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = "rgba(240,244,246,0.9)";
      ctx.lineWidth = Math.max(1, w * 0.02);
      ctx.beginPath();
      for (var mi = 1; mi < 4; mi++) {
        var mx = wx + ww * mi / 4;
        ctx.moveTo(mx, wy); ctx.lineTo(mx, wy + wh);
      }
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      ctx.strokeRect(wx, wy, ww, wh);
    } else if (style === "smallarch") {
      var pad2 = w * 0.2;
      archPath(ctx, x - pad2, y - pad2, w + pad2 * 2, h + pad2 * 1.2);
      ctx.fillStyle = "#c9ba98"; ctx.fill();
      archPath(ctx, x, y, w, h);
      ctx.fillStyle = "#3c362c"; ctx.fill();
    } else if (style === "niche") {
      var pad3 = w * 0.13;
      archPath(ctx, x - pad3, y - pad3 * 0.7, w + pad3 * 2, h + pad3 * 1.4);
      ctx.fillStyle = "#c9ba98"; ctx.fill();
      archPath(ctx, x, y, w, h);
      ctx.fillStyle = "#84503c"; ctx.fill();
      ctx.strokeStyle = "rgba(40,25,18,0.35)";
      ctx.lineWidth = 1.5;
      for (var ly = y + h * 0.15; ly < y + h; ly += h * 0.12) {
        ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke();
      }
    } else if (style === "door") {
      var pad4 = w * 0.12;
      archPath(ctx, x - pad4, y - pad4 * 0.6, w + pad4 * 2, h + pad4 * 1.4);
      ctx.fillStyle = "#cfc0a0"; ctx.fill();
      archPath(ctx, x, y, w, h);
      ctx.fillStyle = "#8d8878"; ctx.fill();
      ctx.strokeStyle = "rgba(60,50,38,0.6)";
      ctx.lineWidth = Math.max(1, w * 0.025);
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + w * 0.3); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
      // さび
      for (var ri = 0; ri < 6; ri++) {
        ctx.fillStyle = "rgba(120,70,35," + rand(0.15, 0.35) + ")";
        ctx.fillRect(x + rand(0, w * 0.9), y + rand(h * 0.3, h * 0.9), rand(2, 6), rand(6, 22));
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // レンガ壁テクスチャ + 刻印レジストリ登録
  // ---------------------------------------------------------------
  function makeBrickWallTexture(opts) {
    var cw = Math.round(opts.realW * PX_PER_M);
    var ch = Math.round(opts.realH * PX_PER_M);
    var canvas = makeCanvas(cw, ch);
    var ctx = canvas.getContext("2d");
    var brickW = BRICK_W_M * PX_PER_M;
    var brickH = BRICK_H_M * PX_PER_M;
    var mortar = Math.max(1.5, MORTAR_M * PX_PER_M);
    var windows = opts.windows || [];
    var door = opts.door || null;
    var wallId = opts.wallId || null;

    ctx.fillStyle = "#3d362e";
    ctx.fillRect(0, 0, cw, ch);

    function isOverOpening(px, py) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        var wcx = w.cxFrac * cw, wcy = (w.topFrac + w.hFrac / 2) * ch;
        var rx = w.wFrac * cw * 0.85, ry = w.hFrac * ch * 0.85;
        if (Math.abs(px - wcx) < rx && Math.abs(py - wcy) < ry) return true;
      }
      if (door) {
        var dcx = door.cxFrac * cw, drx = door.wFrac * cw * 0.85;
        if (Math.abs(px - dcx) < drx && py > ch - door.hFrac * ch * 1.05) return true;
      }
      return false;
    }

    var featured = (opts.featured || []).map(function (f) {
      return { row: Math.floor(f.y_m / BRICK_H_M), fx: f.xFrac * cw, donor: f.donor, done: false };
    });

    // パス1: レンガ描画 + 刻印対象の収集
    var sigs = [];
    var rows = Math.ceil(ch / brickH) + 1;
    for (var r = 0; r < rows; r++) {
      var y = ch - (r + 1) * brickH;
      var offset = (r % 2 === 0) ? 0 : brickW / 2;
      for (var k = 0; ; k++) {
        var x = k * brickW - offset;
        if (x >= cw) break;
        var bw = brickW - mortar, bh = brickH - mortar;
        var p = Math.random(), color;
        if (p < 0.5) color = hsl(11 + rand(-6, 6), 44 + rand(-8, 8), 33 + rand(-7, 10));
        else if (p < 0.72) color = hsl(30 + rand(-8, 8), 22 + rand(-6, 10), 58 + rand(-10, 12));
        else if (p < 0.88) color = hsl(18 + rand(-6, 6), 16 + rand(-5, 5), 22 + rand(-6, 6));
        else color = hsl(38, 14, 74);
        ctx.fillStyle = color;
        ctx.fillRect(x + mortar / 2, y + mortar / 2, bw, bh);
        ctx.fillStyle = "rgba(0,0,0,0.10)";
        ctx.fillRect(x + mortar / 2, y + bh * 0.74, bw, bh * 0.26);

        var bcx = x + brickW / 2, bcy = y + brickH / 2;
        var usable = bcx > brickW * 0.6 && bcx < cw - brickW * 0.6 && bcy > brickH && !isOverOpening(bcx, bcy);
        if (wallId && usable) {
          var donor = null;
          for (var fi = 0; fi < featured.length; fi++) {
            var f = featured[fi];
            if (!f.done && f.row === r && f.fx >= x && f.fx < x + brickW) { donor = f.donor; f.done = true; }
          }
          if (!donor && opts.nameProb && Math.random() < opts.nameProb) donor = makeRandomDonor();
          if (donor) {
            brickRegistry[wallId + ":" + r + ":" + k] = donor;
            sigs.push({ bcx: bcx, bcy: bcy, bw: bw, bh: bh, text: donor.engrave });
          }
        }
      }
    }

    // パス2: 漆喰の剥がれ（白い漆喰がまだらに残る）
    var plaster = opts.plaster || 0;
    var blotches = Math.round(plaster * 130);
    for (var bl = 0; bl < blotches; bl++) {
      var bx = rand(0, cw), by = rand(0, ch), rr = rand(30, 170);
      var g = ctx.createRadialGradient(bx, by, rr * 0.15, bx, by, rr);
      var a = rand(0.35, 0.8);
      g.addColorStop(0, "rgba(224,212,186," + a + ")");
      g.addColorStop(1, "rgba(224,212,186,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    // 足元の黒ずみ
    var gg = ctx.createLinearGradient(0, ch * 0.82, 0, ch);
    gg.addColorStop(0, "rgba(40,32,22,0)");
    gg.addColorStop(1, "rgba(40,32,22,0.4)");
    ctx.fillStyle = gg;
    ctx.fillRect(0, ch * 0.82, cw, ch * 0.18);
    // 雨だれ・さび汚れ
    for (var st = 0; st < 14; st++) {
      ctx.fillStyle = "rgba(96,62,30," + rand(0.1, 0.2) + ")";
      ctx.fillRect(rand(0, cw), rand(0.1, 0.5) * ch, rand(2, 6), rand(0.1, 0.3) * ch);
    }

    // パス3: 蔦
    var ivyN = opts.ivyDensity || 0;
    for (var iv = 0; iv < ivyN; iv++) {
      var ix = rand(0, cw);
      var iy = Math.random() < 0.5 ? rand(0, ch * 0.45) : rand(ch * 0.55, ch);
      var irad = rand(ch * 0.07, ch * 0.26);
      var ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, irad);
      var ia = rand(0.35, 0.65);
      ig.addColorStop(0, "rgba(44,74,32," + ia + ")");
      ig.addColorStop(0.6, "rgba(54,90,38," + (ia * 0.5) + ")");
      ig.addColorStop(1, "rgba(54,90,38,0)");
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(ix, iy, irad, 0, Math.PI * 2); ctx.fill();
    }

    // パス4: 刻印（レンガ枠内に確実に収める）
    sigs.forEach(function (s) { drawSignatureInBrick(ctx, s.bcx, s.bcy, s.bw, s.bh, s.text); });

    // パス5: 窓・扉（最前面）
    windows.forEach(function (w) {
      var wpx = w.wFrac * cw, hpx = w.hFrac * ch;
      drawWindow(ctx, w.cxFrac * cw - wpx / 2, w.topFrac * ch, wpx, hpx, w.style);
    });
    if (door) {
      var dwpx = door.wFrac * cw, dhpx = door.hFrac * ch;
      drawWindow(ctx, door.cxFrac * cw - dwpx / 2, ch - dhpx, dwpx, dhpx, "door");
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function drawSignatureInBrick(ctx, cx, cy, bw, bh, txt) {
    var maxW = bw * 0.86;
    var fs = bh * 0.64;
    ctx.save();
    ctx.font = "700 " + fs.toFixed(1) + "px \"Hiragino Kaku Gothic ProN\",\"Yu Gothic\",\"Meiryo\",sans-serif";
    var w = ctx.measureText(txt).width;
    if (w > maxW) {
      fs *= maxW / w;
      ctx.font = "700 " + fs.toFixed(1) + "px \"Hiragino Kaku Gothic ProN\",\"Yu Gothic\",\"Meiryo\",sans-serif";
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(20,13,8,0.62)";
    ctx.fillText(txt, cx + 1, cy + 1.3);
    ctx.fillStyle = "rgba(236,226,206,0.6)";
    ctx.fillText(txt, cx - 0.6, cy - 0.6);
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // 妻壁（三角）テクスチャ: 歯飾り・石帯・漆喰・窓
  // ---------------------------------------------------------------
  function makeGableTriTexture(style, mirror, plaster) {
    var S = 768;
    var c = makeCanvas(S, S);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3d362e"; ctx.fillRect(0, 0, S, S);
    var bw = BRICK_W_M * PX_PER_M, bh = BRICK_H_M * PX_PER_M, mort = MORTAR_M * PX_PER_M;
    for (var r = 0; r * bh < S; r++) {
      var y = S - (r + 1) * bh;
      var offset = (r % 2 === 0) ? 0 : bw / 2;
      for (var x = -offset; x < S; x += bw) {
        var p = Math.random(), color;
        if (p < 0.5) color = hsl(11 + rand(-6, 6), 44 + rand(-8, 8), 33 + rand(-7, 10));
        else if (p < 0.72) color = hsl(30 + rand(-8, 8), 22, 58);
        else color = hsl(18, 16, 24);
        ctx.fillStyle = color;
        ctx.fillRect(x + mort, y + mort, bw - mort * 2, bh - mort * 2);
      }
    }
    // 漆喰
    var blotches = Math.round((plaster || 0) * 70);
    for (var bl = 0; bl < blotches; bl++) {
      var bx = rand(0, S), by = rand(0, S), rr = rand(40, 160);
      var g = ctx.createRadialGradient(bx, by, rr * 0.15, bx, by, rr);
      var a = rand(0.35, 0.75);
      g.addColorStop(0, "rgba(224,212,186," + a + ")");
      g.addColorStop(1, "rgba(224,212,186,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    // 窓
    if (style === "circle") drawWindow(ctx, 384 - 105, 340, 210, 210, "circle");
    else if (style === "arch") drawWindow(ctx, 384 - 145, 175, 290, 330, "arch");
    // 蔦
    for (var i = 0; i < 8; i++) {
      var vx = rand(0, S), vy = rand(380, S), vr = rand(70, 190);
      var vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
      vg.addColorStop(0, "rgba(44,74,32,0.5)"); vg.addColorStop(1, "rgba(44,74,32,0)");
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(vx, vy, vr, 0, Math.PI * 2); ctx.fill();
    }
    // 破風沿いの石帯 + 歯飾り（デンティル）
    function drawRake(x1, y1, x2, y2) {
      ctx.strokeStyle = "#cfc2a8";
      ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      var steps = 13;
      for (var t = 1; t < steps; t++) {
        var f = t / steps;
        var px = x1 + (x2 - x1) * f, py = y1 + (y2 - y1) * f;
        ctx.fillStyle = "#c4b696";
        ctx.fillRect(px - 7, py + 10, 14, 14);
      }
    }
    var valleyY = (1 - 0.15) * S;
    if (!mirror) {
      drawRake(0, S, S / 2, 0);
      drawRake(S / 2, 0, S, valleyY);
    } else {
      drawRake(S, S, S / 2, 0);
      drawRake(S / 2, 0, 0, valleyY);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ---------------------------------------------------------------
  // その他テクスチャ
  // ---------------------------------------------------------------
  function makeRoofTexture() {
    var c = makeCanvas(128, 128);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#798086"; ctx.fillRect(0, 0, 128, 128);
    for (var x = 0; x < 128; x += 8) {
      ctx.fillStyle = (x / 8) % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
      ctx.fillRect(x, 0, 4, 128);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
    for (var y = 0; y < 128; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeGroundTexture() {
    var c = makeCanvas(512, 512);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#516e37"; ctx.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 12000; i++) {
      ctx.fillStyle = "hsl(" + (88 + rand(-16, 16)) + "," + (34 + rand(-10, 10)) + "%," + (28 + Math.random() * 26) + "%)";
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    for (var k = 0; k < 40; k++) {
      var bx = Math.random() * 512, by = Math.random() * 512, rr = rand(20, 70);
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      g.addColorStop(0, "rgba(90,72,45,0.35)"); g.addColorStop(1, "rgba(90,72,45,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.125, 0.125);
    tex.anisotropy = 8;
    return tex;
  }

  function makeConcreteTexture() {
    var c = makeCanvas(256, 256);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#b0aa9c"; ctx.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 3000; i++) {
      ctx.fillStyle = "rgba(" + Math.round(rand(60, 120)) + "," + Math.round(rand(58, 110)) + "," + Math.round(rand(50, 95)) + "," + rand(0.04, 0.12) + ")";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    ctx.strokeStyle = "rgba(70,64,52,0.35)"; ctx.lineWidth = 1;
    for (var k = 0; k < 6; k++) {
      ctx.beginPath();
      var x = rand(0, 256), y = rand(0, 256);
      ctx.moveTo(x, y);
      for (var s = 0; s < 5; s++) { x += rand(-40, 40); y += rand(10, 50); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeRoadTexture() {
    var c = makeCanvas(128, 256);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3c3d40"; ctx.fillRect(0, 0, 128, 256);
    for (var i = 0; i < 1500; i++) {
      ctx.fillStyle = "rgba(255,255,255," + rand(0.02, 0.06) + ")";
      ctx.fillRect(Math.random() * 128, Math.random() * 256, 1.5, 1.5);
    }
    ctx.fillStyle = "rgba(235,235,225,0.85)";
    ctx.fillRect(61, 10, 6, 60);
    ctx.fillRect(61, 130, 6, 60);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 16);
    return tex;
  }

  function makeGrassBladeTexture() {
    var c = makeCanvas(64, 64);
    var ctx = c.getContext("2d");
    for (var i = 0; i < 8; i++) {
      var x = 6 + i * 7 + rand(-2, 2), h = rand(34, 58), base = 63;
      ctx.strokeStyle = hsl(96 + rand(-16, 16), 52, 34 + rand(-8, 12));
      ctx.lineWidth = rand(1.8, 3.4);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + rand(-7, 7), base - h * 0.6, x + rand(-11, 11), base - h);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeSkyTexture() {
    var c = makeCanvas(8, 320);
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, "#3f6f9f");
    g.addColorStop(0.45, "#7ba3c4");
    g.addColorStop(0.75, "#c3d4dd");
    g.addColorStop(1, "#e7ece6");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 320);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ---------------------------------------------------------------
  // 手動ジオメトリ
  // ---------------------------------------------------------------
  function makeQuadMesh(p1, p2, p3, p4, material, ru, rv) {
    ru = ru || 1; rv = rv || 1;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2],
      p1[0], p1[1], p1[2], p3[0], p3[1], p3[2], p4[0], p4[1], p4[2]
    ]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, ru, 0, ru, rv, 0, 0, ru, rv, 0, rv]), 2));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, material);
    mesh.material.side = THREE.DoubleSide;
    return mesh;
  }

  function makeTriMesh(p1, p2, p3, material, uv1, uv2, uv3) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1]]), 2));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, material);
    mesh.material.side = THREE.DoubleSide;
    return mesh;
  }

  // ---------------------------------------------------------------
  // シーン
  // ---------------------------------------------------------------
  var scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xbcccd4, 80, 300);

  var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 700);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc4d8e4, 0x50452f, 1.0));
  var sun = new THREE.DirectionalLight(0xfff3e2, 1.0);
  sun.position.set(50, 90, 20);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x404850, 0.4));

  // 地面（貯水池の位置に穴をあける）
  var BASIN = { minX: 16, maxX: 34, minZ: 4, maxZ: 32, inMinX: 19, inMaxX: 31, inMinZ: 7, inMaxZ: 29, bottomY: -1.7 };
  var groundShape = new THREE.Shape();
  groundShape.moveTo(-200, -200);
  groundShape.lineTo(200, -200);
  groundShape.lineTo(200, 200);
  groundShape.lineTo(-200, 200);
  var basinHole = new THREE.Path();
  // world z = -shape.y のため、z:[4,32] は shape.y:[-32,-4]
  basinHole.moveTo(BASIN.minX, -BASIN.maxZ);
  basinHole.lineTo(BASIN.maxX, -BASIN.maxZ);
  basinHole.lineTo(BASIN.maxX, -BASIN.minZ);
  basinHole.lineTo(BASIN.minX, -BASIN.minZ);
  groundShape.holes.push(basinHole);
  var ground = new THREE.Mesh(
    new THREE.ShapeGeometry(groundShape),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1, side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ---------------------------------------------------------------
  // 建屋
  // ---------------------------------------------------------------
  var SHED_HW = 4.6;
  var BUILD_LEN = 36;
  var WALL_H = 6.0;
  var ROOF_H = 4.4;
  var VALLEY_H = WALL_H + ROOF_H * 0.15;
  var TOTAL_W = SHED_HW * 4;
  var APEX_Y = WALL_H + ROOF_H;

  var buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  function makeLongWallWindows() {
    var arr = [], n = 9;
    for (var i = 0; i < n; i++) {
      var cx = 0.07 + (i / (n - 1)) * 0.86;
      arr.push({ cxFrac: cx, topFrac: 0.32, wFrac: 0.055, hFrac: 0.5, style: "arch" });
      // 上部の小アーチ帯（各ベイに2つ）
      arr.push({ cxFrac: cx - 0.017, topFrac: 0.08, wFrac: 0.014, hFrac: 0.13, style: "smallarch" });
      arr.push({ cxFrac: cx + 0.017, topFrac: 0.08, wFrac: 0.014, hFrac: 0.13, style: "smallarch" });
    }
    return arr;
  }

  // 東側（貯水池向き・写真3）: レンガ主体
  var texEast = makeBrickWallTexture({
    wallId: "east", realW: BUILD_LEN, realH: WALL_H,
    windows: makeLongWallWindows(), nameProb: 0.06, ivyDensity: 12, plaster: 0.15
  });
  // 西側（写真2）: 蔦が濃い
  var texWest = makeBrickWallTexture({
    wallId: "west", realW: BUILD_LEN, realH: WALL_H,
    windows: makeLongWallWindows(), nameProb: 0.06, ivyDensity: 45, plaster: 0.1
  });
  // 正面（写真1）: 漆喰まだら・小扉・埋めアーチ
  var texFront = makeBrickWallTexture({
    wallId: "front", realW: TOTAL_W, realH: WALL_H,
    windows: [
      { cxFrac: 0.2, topFrac: 0.35, wFrac: 0.06, hFrac: 0.42, style: "niche" },
      { cxFrac: 0.68, topFrac: 0.32, wFrac: 0.065, hFrac: 0.46, style: "niche" }
    ],
    door: { cxFrac: 0.45, wFrac: 0.05, hFrac: 0.42 },
    nameProb: 0.06, ivyDensity: 8, plaster: 0.75,
    featured: [{ y_m: 1.6, xFrac: 0.56, donor: FEATURED_EXEMATE }]
  });
  // 背面: 蔦多め
  var texBack = makeBrickWallTexture({
    wallId: "back", realW: TOTAL_W, realH: WALL_H,
    windows: [], nameProb: 0.05, ivyDensity: 25, plaster: 0.3
  });
  var flatBrick = new THREE.MeshStandardMaterial({ color: 0x51473b, roughness: 0.95 });

  var wallBox = new THREE.Mesh(new THREE.BoxGeometry(TOTAL_W, WALL_H, BUILD_LEN), [
    new THREE.MeshStandardMaterial({ map: texEast, roughness: 0.95 }),  // +x
    new THREE.MeshStandardMaterial({ map: texWest, roughness: 0.95 }),  // -x
    flatBrick, flatBrick,
    new THREE.MeshStandardMaterial({ map: texBack, roughness: 0.95 }),  // +z
    new THREE.MeshStandardMaterial({ map: texFront, roughness: 0.95 })  // -z
  ]);
  wallBox.position.set(0, WALL_H / 2, BUILD_LEN / 2);
  buildingGroup.add(wallBox);

  // レイキャスト用の面情報（BoxGeometry の UV 方向は実測定義）
  var wallFaceInfo = {
    0: { wallId: "east", label: "E", realW: BUILD_LEN, realH: WALL_H, uDir: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2 },
    1: { wallId: "west", label: "W", realW: BUILD_LEN, realH: WALL_H, uDir: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2 },
    4: { wallId: "back", label: "B", realW: TOTAL_W, realH: WALL_H, uDir: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1), rotY: 0 },
    5: { wallId: "front", label: "F", realW: TOTAL_W, realH: WALL_H, uDir: new THREE.Vector3(-1, 0, 0), normal: new THREE.Vector3(0, 0, -1), rotY: Math.PI }
  };

  // 屋根
  var roofMat = new THREE.MeshStandardMaterial({ map: makeRoofTexture(), roughness: 0.55, metalness: 0.2 });
  function addRoofSlope(xEave, xRidge, yEave, yRidge) {
    var slopeLen = Math.hypot(xRidge - xEave, yRidge - yEave);
    buildingGroup.add(makeQuadMesh(
      [xEave, yEave, 0], [xRidge, yRidge, 0], [xRidge, yRidge, BUILD_LEN], [xEave, yEave, BUILD_LEN],
      roofMat.clone(), BUILD_LEN / 3, slopeLen / 1.2));
  }
  addRoofSlope(-SHED_HW * 2, -SHED_HW, WALL_H, APEX_Y);
  addRoofSlope(0, -SHED_HW, VALLEY_H, APEX_Y);
  addRoofSlope(SHED_HW * 2, SHED_HW, WALL_H, APEX_Y);
  addRoofSlope(0, SHED_HW, VALLEY_H, APEX_Y);

  // 越屋根（明かり取り）
  function addClerestory(x) {
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 22), new THREE.MeshStandardMaterial({ color: 0xdfe2e5, roughness: 0.6 }));
    body.position.set(x, APEX_Y + 0.35, BUILD_LEN / 2);
    buildingGroup.add(body);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 22.8), new THREE.MeshStandardMaterial({ color: 0x798086, roughness: 0.55, metalness: 0.2 }));
    cap.position.set(x, APEX_Y + 0.77, BUILD_LEN / 2);
    buildingGroup.add(cap);
  }
  addClerestory(-SHED_HW);
  addClerestory(SHED_HW);

  // 妻壁
  var gableFL = makeGableTriTexture("circle", false, 0.6);
  var gableFR = makeGableTriTexture("arch", true, 0.55);
  var gableBL = makeGableTriTexture("plain", false, 0.25);
  var gableBR = makeGableTriTexture("plain", true, 0.25);

  function addGableTri(xOuter, xRidge, z, tex) {
    var p1 = [xOuter, WALL_H, z], p2 = [xRidge, APEX_Y, z], p3 = [0, VALLEY_H, z];
    var mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
    var minX = Math.min(xOuter, xRidge, 0), maxX = Math.max(xOuter, xRidge, 0);
    var minY = WALL_H, maxY = APEX_Y;
    function uv(p) { return [(p[0] - minX) / (maxX - minX), (p[1] - minY) / (maxY - minY)]; }
    buildingGroup.add(makeTriMesh(p1, p2, p3, mat, uv(p1), uv(p2), uv(p3)));
  }
  addGableTri(-SHED_HW * 2, -SHED_HW, 0, gableFL);
  addGableTri(SHED_HW * 2, SHED_HW, 0, gableFR);
  addGableTri(-SHED_HW * 2, -SHED_HW, BUILD_LEN, gableBL);
  addGableTri(SHED_HW * 2, SHED_HW, BUILD_LEN, gableBR);

  // 四隅の付柱（石帽子つき）+ 正面中央バットレス
  var pilasterMat = new THREE.MeshStandardMaterial({ color: 0x7a6350, roughness: 0.9 });
  var capMat = new THREE.MeshStandardMaterial({ color: 0xcfc2a8, roughness: 0.85 });
  function addPilaster(x, z, h) {
    var p = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), pilasterMat);
    p.position.set(x, h / 2, z);
    buildingGroup.add(p);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 1.35), capMat);
    cap.position.set(x, h + 0.14, z);
    buildingGroup.add(cap);
  }
  addPilaster(-TOTAL_W / 2, 0.05, WALL_H + 0.7);
  addPilaster(TOTAL_W / 2, 0.05, WALL_H + 0.7);
  addPilaster(-TOTAL_W / 2, BUILD_LEN - 0.05, WALL_H + 0.7);
  addPilaster(TOTAL_W / 2, BUILD_LEN - 0.05, WALL_H + 0.7);
  // 正面中央（谷部）のバットレス
  var centerBut = new THREE.Mesh(new THREE.BoxGeometry(0.9, VALLEY_H + 0.35, 0.55), pilasterMat);
  centerBut.position.set(0, (VALLEY_H + 0.35) / 2, -0.12);
  buildingGroup.add(centerBut);
  var centerCap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.75), capMat);
  centerCap.position.set(0, VALLEY_H + 0.45, -0.12);
  buildingGroup.add(centerCap);

  // 避雷針マスト（両妻の頂部・前後）+ 渡り線
  var mastMat = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 0.7, metalness: 0.3 });
  var mastTops = { front: [], back: [] };
  function addMast(x, z, side) {
    var h = 5.2;
    var col = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), mastMat);
    col.position.set(x, APEX_Y + h / 2, z);
    buildingGroup.add(col);
    [3.4, 4.4].forEach(function (ay) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.08), mastMat);
      arm.position.set(x, APEX_Y + ay, z);
      buildingGroup.add(arm);
    });
    mastTops[side].push(new THREE.Vector3(x, APEX_Y + h, z));
  }
  addMast(-SHED_HW, 0.25, "front");
  addMast(SHED_HW, 0.25, "front");
  addMast(-SHED_HW, BUILD_LEN - 0.25, "back");
  addMast(SHED_HW, BUILD_LEN - 0.25, "back");
  var wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  ["front", "back"].forEach(function (side) {
    var a = mastTops[side][0], b = mastTops[side][1];
    var mid = a.clone().lerp(b, 0.5); mid.y -= 0.6;
    var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), wireMat));
  });

  // 煙突・雨樋・消火栓箱
  function addChimney(x, z) {
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x6b4230, roughness: 0.9 }));
    base.position.set(x, APEX_Y + 0.6, z);
    buildingGroup.add(base);
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.35 }));
    pipe.position.set(x, APEX_Y + 2.8, z);
    buildingGroup.add(pipe);
  }
  addChimney(-SHED_HW, 6);
  addChimney(SHED_HW, 6.6);

  var downpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, WALL_H - 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x8b8b85, roughness: 0.6, metalness: 0.3 }));
  downpipe.position.set(-1.4, (WALL_H - 0.3) / 2, -0.12);
  buildingGroup.add(downpipe);
  var fireBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.35), new THREE.MeshStandardMaterial({ color: 0xb03024, roughness: 0.6 }));
  fireBox.position.set(2.6, 0.4, -0.7);
  buildingGroup.add(fireBox);

  // 正面右の低い附属屋（赤レンガ・写真1右）
  var annexTex = makeBrickWallTexture({
    realW: 6.4, realH: 2.6, windows: [], door: { cxFrac: 0.45, wFrac: 0.22, hFrac: 0.72 },
    nameProb: 0, ivyDensity: 6, plaster: 0.1
  });
  var annexSideMat = new THREE.MeshStandardMaterial({ color: 0x84503c, roughness: 0.95 });
  var annex = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.6, 3.2), [
    annexSideMat, annexSideMat, flatBrick, flatBrick, annexSideMat,
    new THREE.MeshStandardMaterial({ map: annexTex, roughness: 0.95 })
  ]);
  annex.position.set(6.2, 1.3, -1.6);
  buildingGroup.add(annex);
  var annexRoof = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.12, 3.6), new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.6, metalness: 0.2 }));
  annexRoof.position.set(6.2, 2.66, -1.6);
  buildingGroup.add(annexRoof);

  // ---------------------------------------------------------------
  // 貯水池（東側）: 護岸・水面・フェンス・黄手すり
  // ---------------------------------------------------------------
  var concreteTex = makeConcreteTexture();
  var concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });
  var B = BASIN;
  scene.add(makeQuadMesh([B.minX, 0, B.minZ], [B.maxX, 0, B.minZ], [B.inMaxX, B.bottomY, B.inMinZ], [B.inMinX, B.bottomY, B.inMinZ], concreteMat.clone(), 4, 1));
  scene.add(makeQuadMesh([B.maxX, 0, B.maxZ], [B.minX, 0, B.maxZ], [B.inMinX, B.bottomY, B.inMaxZ], [B.inMaxX, B.bottomY, B.inMaxZ], concreteMat.clone(), 4, 1));
  scene.add(makeQuadMesh([B.minX, 0, B.maxZ], [B.minX, 0, B.minZ], [B.inMinX, B.bottomY, B.inMinZ], [B.inMinX, B.bottomY, B.inMaxZ], concreteMat.clone(), 4, 1));
  scene.add(makeQuadMesh([B.maxX, 0, B.minZ], [B.maxX, 0, B.maxZ], [B.inMaxX, B.bottomY, B.inMaxZ], [B.inMaxX, B.bottomY, B.inMinZ], concreteMat.clone(), 4, 1));
  var water = new THREE.Mesh(
    new THREE.PlaneGeometry(B.inMaxX - B.inMinX, B.inMaxZ - B.inMinZ),
    new THREE.MeshStandardMaterial({ color: 0x3d5a52, roughness: 0.15, metalness: 0.1 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((B.inMinX + B.inMaxX) / 2, B.bottomY + 0.45, (B.inMinZ + B.inMaxZ) / 2);
  scene.add(water);

  // 有刺鉄線フェンス（貯水池の周囲）
  (function addBasinFence() {
    var postMat = new THREE.MeshStandardMaterial({ color: 0x8f969b, roughness: 0.5, metalness: 0.5 });
    var m = 0.7;
    var corners = [
      [B.minX - m, B.minZ - m], [B.maxX + m, B.minZ - m],
      [B.maxX + m, B.maxZ + m], [B.minX - m, B.maxZ + m]
    ];
    var wireLineMat = new THREE.LineBasicMaterial({ color: 0x777d80 });
    for (var e = 0; e < 4; e++) {
      var a = corners[e], b = corners[(e + 1) % 4];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var nPosts = Math.max(2, Math.round(len / 3.2));
      for (var i = 0; i <= nPosts; i++) {
        var t = i / nPosts;
        var px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6), postMat);
        post.position.set(px, 0.575, pz);
        scene.add(post);
      }
      [0.5, 0.8, 1.1].forEach(function (h) {
        var geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a[0], h, a[1]), new THREE.Vector3(b[0], h, b[1])
        ]);
        scene.add(new THREE.Line(geo, wireLineMat));
      });
    }
  })();

  // 黄色い手すり（建屋と貯水池の間）
  (function addYellowRail() {
    var railMat = new THREE.MeshStandardMaterial({ color: 0xd9b422, roughness: 0.6, metalness: 0.2 });
    var x = 13.2, z0 = 4, z1 = 32;
    var n = Math.round((z1 - z0) / 2.8);
    for (var i = 0; i <= n; i++) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), railMat);
      post.position.set(x, 0.5, z0 + (z1 - z0) * i / n);
      scene.add(post);
    }
    [0.55, 0.95].forEach(function (h) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, z1 - z0), railMat);
      bar.position.set(x, h, (z0 + z1) / 2);
      scene.add(bar);
    });
  })();

  // 鉄塔やぐら（東壁沿い・写真3）
  function addTower(x, z) {
    var mat = new THREE.MeshStandardMaterial({ color: 0x9a7a2a, roughness: 0.7, metalness: 0.3 });
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(function (o) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6.5, 6), mat);
      post.position.set(x + o[0], 3.25, z + o[1]);
      scene.add(post);
    });
    for (var h = 1.1; h < 6.4; h += 1.3) {
      [-0.6, 0.6].forEach(function (oz) {
        var rung = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.07, 0.07), mat);
        rung.position.set(x, h, z + oz);
        scene.add(rung);
      });
    }
    var top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), mat);
    top.position.set(x, 6.55, z);
    scene.add(top);
  }
  addTower(10.6, 12);
  addTower(10.6, 22);

  // 水タンク
  var tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 0.8 }));
  tank.position.set(24, 1.2, 37.5);
  scene.add(tank);

  // ---------------------------------------------------------------
  // 道路・土間・周辺の建物
  // ---------------------------------------------------------------
  var road = new THREE.Mesh(new THREE.PlaneGeometry(8, 180), new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(-42, 0.03, 10);
  scene.add(road);
  var sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 180), new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.95 }));
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(-36.9, 0.025, 10);
  scene.add(sidewalk);

  var apron = new THREE.Mesh(new THREE.PlaneGeometry(18, 26), concreteMat.clone());
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(42, 0.02, -2);
  scene.add(apron);
  var path = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 18), concreteMat.clone());
  path.rotation.x = -Math.PI / 2;
  path.position.set(1.5, 0.02, -9);
  scene.add(path);

  var houseColliders = [];
  function addHouse(x, z, rotY, w, d, h, cWall, cRoof) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: cWall, roughness: 0.9 }));
    body.position.y = h / 2;
    g.add(body);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.05, 1.7, 4), new THREE.MeshStandardMaterial({ color: cRoof, roughness: 0.8, flatShading: true }));
    roof.position.y = h + 0.85;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    var half = Math.max(w, d) / 2 + 0.6;
    houseColliders.push({ minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half });
  }
  addHouse(-20, -42, 0.1, 7, 6, 3, 0xd8d3c8, 0x5a5f66);
  addHouse(2, -44, -0.05, 8, 7, 3, 0xc9b8a4, 0x7a4a3a);
  addHouse(22, -40, 0.15, 6, 6, 2.8, 0xb9c0c4, 0x3f4a55);
  addHouse(46, -26, 0.4, 7, 6, 3, 0xe2ddd2, 0x5a5f66);
  addHouse(50, 8, -0.3, 6, 7, 2.8, 0xd8d3c8, 0x7a4a3a);
  addHouse(-58, 14, 0, 7, 6, 3, 0xc9b8a4, 0x3f4a55);
  addHouse(-58, -18, 0.2, 6, 6, 2.8, 0xe2ddd2, 0x5a5f66);

  // 赤屋根の小屋（東）と白い小屋（西）
  var redShed = new THREE.Group();
  var redShedBody = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), new THREE.MeshStandardMaterial({ color: 0x8a5340, roughness: 0.9 }));
  redShedBody.position.y = 1.3;
  redShed.add(redShedBody);
  var redShedRoof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xa5342a, roughness: 0.8, flatShading: true }));
  redShedRoof.position.y = 3.2;
  redShedRoof.rotation.y = Math.PI / 4;
  redShed.add(redShedRoof);
  redShed.position.set(40, 0, 18);
  scene.add(redShed);
  houseColliders.push({ minX: 37.5, maxX: 42.5, minZ: 15.5, maxZ: 20.5 });

  var whiteShed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: 0xe6e4de, roughness: 0.85 }));
  whiteShed.position.set(-28, 1.1, 6);
  scene.add(whiteShed);
  houseColliders.push({ minX: -29.9, maxX: -26.1, minZ: 4.3, maxZ: 7.7 });

  // ---------------------------------------------------------------
  // 植生（木・茂み・草・岩）
  // ---------------------------------------------------------------
  var trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4128, roughness: 0.95 });
  function foliageMat() { return new THREE.MeshStandardMaterial({ color: hsl(rand(95, 130), rand(38, 55), rand(26, 40)), roughness: 0.9, flatShading: true }); }

  function tooCloseToBuilding(x, z, margin) {
    margin = margin || 3;
    return (x > -TOTAL_W / 2 - margin && x < TOTAL_W / 2 + margin && z > -margin - 4 && z < BUILD_LEN + margin);
  }
  function blockedForProp(x, z) {
    if (tooCloseToBuilding(x, z, 4)) return true;
    if (x > 14 && x < 36 && z > 2 && z < 34) return true;       // 貯水池
    if (x < -34 && x > -48) return true;                        // 道路
    if (x > 32 && x < 52 && z > -16 && z < 12) return true;     // 東の土間
    for (var i = 0; i < houseColliders.length; i++) {
      var h = houseColliders[i];
      if (x > h.minX - 2 && x < h.maxX + 2 && z > h.minZ - 2 && z < h.maxZ + 2) return true;
    }
    return false;
  }

  function addTree(x, z) {
    var g = new THREE.Group();
    var th = rand(3.0, 5.5);
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, th, 7), trunkMat);
    trunk.position.y = th / 2;
    g.add(trunk);
    var n = 3 + Math.floor(Math.random() * 2);
    for (var k = 0; k < n; k++) {
      var fol = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.2, 2.0), 0), foliageMat());
      fol.position.set(rand(-1, 1), th + rand(-0.3, 1.2), rand(-1, 1));
      g.add(fol);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rand(0, Math.PI * 2);
    scene.add(g);
  }
  function addBush(x, z) {
    var r = rand(0.5, 1.0);
    var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliageMat());
    bush.position.set(x, r * 0.7, z);
    bush.scale.y = 0.8;
    scene.add(bush);
  }
  function addRock(x, z) {
    var r = rand(0.3, 0.8);
    var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: hsl(30, 8, rand(40, 60)), roughness: 1, flatShading: true }));
    rock.position.set(x, r * 0.5, z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    scene.add(rock);
  }
  var grassTex = makeGrassBladeTexture();
  var grassMat = new THREE.MeshStandardMaterial({ map: grassTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  var grassGeo = new THREE.PlaneGeometry(0.7, 0.55);
  function addGrassTuft(x, z) {
    var g = new THREE.Group();
    var p1 = new THREE.Mesh(grassGeo, grassMat);
    var p2 = new THREE.Mesh(grassGeo, grassMat);
    p2.rotation.y = Math.PI / 2;
    g.add(p1); g.add(p2);
    var s = rand(0.7, 1.5);
    g.scale.set(s, s, s);
    g.position.set(x, 0.55 * s / 2, z);
    scene.add(g);
  }

  var placed = 0, guard = 0;
  while (placed < 18 && guard < 500) {
    guard++;
    var tx = rand(-70, 70), tz = rand(-60, 90);
    if (blockedForProp(tx, tz) || Math.hypot(tx - 8, tz + 26) < 8) continue;
    addTree(tx, tz); placed++;
  }
  // 建屋を挟む大木（航空写真準拠）
  addTree(-26, 16); addTree(-24, 9); addTree(-13, 38); addTree(12, 38);
  for (var bi = 0; bi < 36; bi++) {
    var bx2 = rand(-70, 70), bz2 = rand(-60, 92);
    if (!blockedForProp(bx2, bz2)) addBush(bx2, bz2);
  }
  for (var rk = 0; rk < 20; rk++) {
    var rx = rand(-70, 70), rz = rand(-55, 90);
    if (!blockedForProp(rx, rz)) addRock(rx, rz);
  }
  for (var gt = 0; gt < 190; gt++) {
    var gx = rand(-72, 72), gz = rand(-58, 92);
    if (!blockedForProp(gx, gz)) addGrassTuft(gx, gz);
  }

  // ---------------------------------------------------------------
  // 広告: 動画モニター / exemate 静止画 / 説明看板
  // ---------------------------------------------------------------
  var video = document.createElement("video");
  video.src = encodeURI("asset/福岡県中間市世界遺産　『遠賀川水源地ポンプ室』紹介動画.mp4");
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  var videoTex = new THREE.VideoTexture(video);
  videoTex.minFilter = THREE.LinearFilter;
  videoTex.magFilter = THREE.LinearFilter;
  videoTex.encoding = THREE.sRGBEncoding;
  var videoScreenMat = new THREE.MeshBasicMaterial({ map: videoTex, color: 0xffffff });
  var videoPending = true;
  function tryPlayVideo() {
    if (!videoPending) return;
    var pr = video.play();
    if (pr && pr.then) pr.then(function () { videoPending = false; }).catch(function () { });
  }

  var imgMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  new THREE.TextureLoader().load("asset/exemate.png", function (t) {
    t.encoding = THREE.sRGBEncoding;
    imgMat.map = t; imgMat.color.set(0xffffff); imgMat.needsUpdate = true;
  });

  function addMonitor(x, z, rotY, w, h, screenMat, label) {
    var group = new THREE.Group();
    var legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.7, metalness: 0.3 });
    var legGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.2, 10);
    var l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-w * 0.32, 1.1, 0); group.add(l1);
    var l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(w * 0.32, 1.1, 0); group.add(l2);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5, metalness: 0.4 }));
    frame.position.set(0, 2.2 + h / 2, 0); group.add(frame);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.set(0, 2.2 + h / 2, 0.17); group.add(screen);
    if (label) {
      var lc = makeCanvas(512, 96); var lx = lc.getContext("2d");
      lx.fillStyle = "#c8a24a"; lx.fillRect(0, 0, 512, 96);
      lx.fillStyle = "#1a1206"; lx.font = "bold 44px 'Hiragino Kaku Gothic ProN',sans-serif";
      lx.textAlign = "center"; lx.textBaseline = "middle"; lx.fillText(label, 256, 50);
      var lt = new THREE.CanvasTexture(lc); lt.encoding = THREE.sRGBEncoding;
      var band = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, 0.7), new THREE.MeshBasicMaterial({ map: lt }));
      band.position.set(0, 2.2 + h + 0.55, 0.17); group.add(band);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
  }

  function makeSignTexture(lines, accent) {
    var c = makeCanvas(512, 340);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#f4f1e9"; ctx.fillRect(0, 0, 512, 340);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 512, 56);
    ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 330);
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(lines[0], 256, 38);
    ctx.fillStyle = "#333"; ctx.font = "bold 38px 'Hiragino Kaku Gothic ProN',sans-serif";
    ctx.fillText(lines[1], 256, 150);
    ctx.font = "22px 'Hiragino Kaku Gothic ProN',sans-serif"; ctx.fillStyle = "#666";
    ctx.fillText(lines[2] || "", 256, 200);
    ctx.fillStyle = "#999"; ctx.font = "18px sans-serif";
    ctx.fillText(lines[3] || "", 256, 300);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function addSignboard(x, z, rotY, lines, accent) {
    var group = new THREE.Group();
    var postMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
    var postGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.8, 8);
    var p1 = new THREE.Mesh(postGeo, postMat); p1.position.set(-1.1, 1.4, 0); group.add(p1);
    var p2 = new THREE.Mesh(postGeo, postMat); p2.position.set(1.1, 1.4, 0); group.add(p2);
    var board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.85, 0.08), [
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a }), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a }), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(lines, accent) }), new THREE.MeshStandardMaterial({ color: 0xe9e5da })
    ]);
    board.position.set(0, 2.7, 0);
    group.add(board);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
  }

  addMonitor(-20, -14, Math.PI * 0.16, 8, 4.5, videoScreenMat, "遠賀川水源地ポンプ室 紹介動画");
  addMonitor(22, -12, -Math.PI * 0.2, 6, 4, imgMat, "SPONSOR / exemate");
  addSignboard(-28, 14, Math.PI * 0.3, ["SUPPORT", "寄付者名をレンガに刻印", "レンガをクリックで情報表示", "近づいて確かめてください"], "#1e8449");
  addSignboard(-10, 52, Math.PI * 0.85, ["SPONSOR", "広告募集中", "企業広告・PR動画を掲載", "AD SPACE"], "#c0392b");
  addSignboard(0, 72, Math.PI, ["PROJECT", "遠賀川水源地ポンプ室", "メタバース保存プロジェクト", "プロトタイプ v0.3"], "#6c3483");

  // ---------------------------------------------------------------
  // 操作系（移動・ジャンプ・コリジョン）
  // ---------------------------------------------------------------
  camera.position.set(8, 1.7, -26);
  camera.rotation.y = Math.PI;

  var controls = new THREE.PointerLockControls(camera, document.body);
  scene.add(controls.getObject());
  var overlay = document.getElementById("overlay");
  var crosshair = document.getElementById("crosshair");
  var hud = document.getElementById("hud");
  var titleBadge = document.getElementById("title-badge");
  var aimHint = document.getElementById("aim-hint");
  var brickDialog = document.getElementById("brick-dialog");

  overlay.addEventListener("click", function () { controls.lock(); tryPlayVideo(); });
  controls.addEventListener("lock", function () {
    overlay.style.display = "none"; crosshair.style.display = "block";
    hud.style.display = "block"; titleBadge.style.display = "block";
    tryPlayVideo();
  });
  controls.addEventListener("unlock", function () {
    overlay.style.display = "flex"; crosshair.style.display = "none";
    hud.style.display = "none"; titleBadge.style.display = "none";
    aimHint.style.display = "none";
    closeBrickDialog();
  });

  var keys = {};
  window.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyM") { video.muted = !video.muted; tryPlayVideo(); }
    if (e.code === "KeyQ") closeBrickDialog();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("wheel", function (e) {
    camera.fov = clamp(camera.fov + e.deltaY * 0.02, 12, 75);
    camera.updateProjectionMatrix();
  }, { passive: true });

  var colliders = [
    { minX: -TOTAL_W / 2 - 0.6, maxX: TOTAL_W / 2 + 0.6, minZ: -0.6, maxZ: BUILD_LEN + 0.6 },
    { minX: 2.4, maxX: 10.0, minZ: -3.8, maxZ: 0.6 },   // 附属屋
    { minX: 15.0, maxX: 35.2, minZ: 3.0, maxZ: 33.2 },  // 貯水池+フェンス
    { minX: 22.0, maxX: 26.0, minZ: 35.5, maxZ: 39.5 }  // 水タンク
  ];
  Array.prototype.push.apply(colliders, houseColliders);
  function collides(x, z) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
    return false;
  }

  var EYE = 1.7, GRAVITY = -26, JUMP_V = 8.6;
  var velY = 0, onGround = true, bobT = 0;
  var forwardV = new THREE.Vector3(), rightV = new THREE.Vector3();
  var clock = new THREE.Clock();

  function updateMovement(dt) {
    var obj = controls.getObject();
    var moveZ = 0, moveX = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) moveZ += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) moveZ -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) moveX += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) moveX -= 1;

    var moving = (moveX !== 0 || moveZ !== 0);
    var speed = (keys["ShiftLeft"] || keys["ShiftRight"]) ? 11 : 5.8;
    if (moving) {
      var len = Math.hypot(moveX, moveZ);
      moveX /= len; moveZ /= len;
      camera.getWorldDirection(forwardV);
      forwardV.y = 0; forwardV.normalize();
      rightV.set(-forwardV.z, 0, forwardV.x);
      var dx = (forwardV.x * moveZ + rightV.x * moveX) * speed * dt;
      var dz = (forwardV.z * moveZ + rightV.z * moveX) * speed * dt;
      var candX = obj.position.x + dx, candZ = obj.position.z + dz;
      if (!collides(candX, obj.position.z)) obj.position.x = candX;
      if (!collides(obj.position.x, candZ)) obj.position.z = candZ;
      obj.position.x = clamp(obj.position.x, -150, 150);
      obj.position.z = clamp(obj.position.z, -150, 150);
    }

    if (keys["Space"] && onGround) { velY = JUMP_V; onGround = false; }
    velY += GRAVITY * dt;
    var groundY = EYE + (moving && onGround ? Math.sin(bobT += dt * (speed > 8 ? 14 : 9)) * 0.045 : 0);
    obj.position.y += velY * dt;
    if (obj.position.y <= groundY) { obj.position.y = groundY; velY = 0; onGround = true; }
  }

  // ---------------------------------------------------------------
  // レンガ選択（レイキャスト + ハイライト + ダイアログ）
  // ---------------------------------------------------------------
  var raycaster = new THREE.Raycaster();
  var centerNDC = new THREE.Vector2(0, 0);
  var highlight = new THREE.Mesh(
    new THREE.PlaneGeometry(BRICK_W_M - 0.03, BRICK_H_M - 0.03),
    new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthTest: false })
  );
  highlight.visible = false;
  highlight.renderOrder = 5;
  scene.add(highlight);

  var aimBrick = null;

  function updateAim() {
    aimBrick = null;
    raycaster.setFromCamera(centerNDC, camera);
    var hits = raycaster.intersectObject(wallBox);
    if (!hits.length || hits[0].distance > 9 || !hits[0].uv || !hits[0].face) {
      highlight.visible = false;
      aimHint.style.display = "none";
      return;
    }
    var h = hits[0];
    var info = wallFaceInfo[h.face.materialIndex];
    if (!info) { highlight.visible = false; aimHint.style.display = "none"; return; }

    var cw = Math.round(info.realW * PX_PER_M), ch = Math.round(info.realH * PX_PER_M);
    var cx = h.uv.x * cw, cy = (1 - h.uv.y) * ch;
    var brickW = BRICK_W_M * PX_PER_M, brickH = BRICK_H_M * PX_PER_M;
    var r = Math.floor((ch - cy) / brickH);
    var offset = (r % 2 === 0) ? 0 : brickW / 2;
    var k = Math.floor((cx + offset) / brickW);
    var bcx = k * brickW - offset + brickW / 2;
    var bcy = ch - (r + 1) * brickH + brickH / 2;
    var key = info.wallId + ":" + r + ":" + k;
    var donor = brickRegistry[key] || null;

    var pos = h.point.clone()
      .add(info.uDir.clone().multiplyScalar((bcx - cx) / PX_PER_M))
      .add(new THREE.Vector3(0, (cy - bcy) / PX_PER_M, 0))
      .add(info.normal.clone().multiplyScalar(0.03));
    highlight.position.copy(pos);
    highlight.rotation.set(0, info.rotY, 0);
    highlight.material.color.set(donor ? 0xffd54a : 0xbfd8ff);
    highlight.visible = true;

    aimBrick = { key: key, donor: donor, label: info.label + "-" + r + "-" + k };
    aimHint.textContent = donor ? "クリック: 「" + donor.engrave + "」の刻印を見る" : "クリック: 空きレンガ（未登録）";
    aimHint.style.display = "block";
  }

  var dialogOpen = false;
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawBrickZoom(donor, key) {
    var c = document.getElementById("brick-zoom");
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#332c24";
    ctx.fillRect(0, 0, 320, 150);
    var hsum = 0;
    for (var i = 0; i < key.length; i++) hsum += key.charCodeAt(i);
    ctx.fillStyle = hsl(10 + (hsum % 14), 42, 30 + (hsum % 12));
    roundRectPath(ctx, 14, 14, 292, 122, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(14, 14, 292, 18);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(14, 112, 292, 24);
    for (var n = 0; n < 260; n++) {
      ctx.fillStyle = "rgba(" + (Math.random() < 0.5 ? "0,0,0" : "255,240,220") + "," + rand(0.02, 0.07) + ")";
      ctx.fillRect(rand(16, 300), rand(16, 130), 2, 2);
    }
    var text = donor ? donor.engrave : "未 登 録";
    var fs = 52;
    ctx.font = "700 " + fs + "px 'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
    var tw = ctx.measureText(text).width;
    if (tw > 250) { fs *= 250 / tw; ctx.font = "700 " + fs.toFixed(0) + "px 'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif"; }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (donor) {
      ctx.fillStyle = "rgba(15,10,6,0.75)";
      ctx.fillText(text, 162, 78);
      ctx.fillStyle = "rgba(240,230,210,0.85)";
      ctx.fillText(text, 159, 74);
    } else {
      ctx.fillStyle = "rgba(240,230,210,0.25)";
      ctx.fillText(text, 160, 76);
    }
  }
  function rowHTML(k, v) {
    return "<div class='bd-row'><div class='k'>" + k + "</div><div class='v'>" + v + "</div></div>";
  }
  function openBrickDialog(ab) {
    var donor = ab.donor;
    drawBrickZoom(donor, ab.key);
    var badge = document.getElementById("bd-badge");
    var name = document.getElementById("bd-name");
    var rows = document.getElementById("bd-rows");
    var msg = document.getElementById("bd-message");
    if (!donor) {
      badge.className = "bd-badge empty";
      badge.textContent = "空きレンガ";
      name.textContent = "未登録";
      rows.innerHTML = rowHTML("刻印番号", ab.label) +
        rowHTML("状態", "刻印の受付が可能です");
      msg.textContent = "寄付をすると、このレンガにお名前とメッセージを刻印できます。";
    } else if (donor.type === "personal") {
      badge.className = "bd-badge personal";
      badge.textContent = "個人サポーター";
      name.textContent = donor.name;
      rows.innerHTML = rowHTML("刻印番号", ab.label) + rowHTML("刻印日", donor.date);
      msg.textContent = "“" + donor.message + "”";
    } else {
      badge.className = "bd-badge company";
      badge.textContent = "法人スポンサー";
      name.textContent = donor.name;
      rows.innerHTML = rowHTML("刻印番号", ab.label) +
        rowHTML("業種", donor.industry) +
        rowHTML("従業員数", donor.employees) +
        rowHTML("設立", donor.founded) +
        rowHTML("Web", donor.url) +
        rowHTML("刻印日", donor.date);
      msg.textContent = "“" + donor.message + "”";
    }
    brickDialog.style.display = "block";
    dialogOpen = true;
  }
  function closeBrickDialog() {
    brickDialog.style.display = "none";
    dialogOpen = false;
  }

  document.addEventListener("mousedown", function () {
    if (!controls.isLocked) return;
    tryPlayVideo();
    if (aimBrick) openBrickDialog(aimBrick);
    else if (dialogOpen) closeBrickDialog();
  });

  // ---------------------------------------------------------------
  // メインループ
  // ---------------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (controls.isLocked) {
      updateMovement(dt);
      updateAim();
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

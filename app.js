/* 遠賀川水源地ポンプ室 メタバース保存プロジェクト — プロトタイプ v0.4
   Three.js r128 (classic global build) + PointerLockControls

   v0.4:
   - 敷地を実物準拠に縮小（フェンスで囲まれたコンパクトな区画）
   - 配置修正: 道路は正面妻壁のすぐ前 / 電柱は道路沿い / 貯水池は建物至近
   - グラフィック強化: 影(PCFSoft) / ACESトーンマッピング / レンガのバンプマップ /
     雲と山並みのある空 / 接地影 / 屋根・地面テクスチャ改善
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
  // レンガ格子と刻印レジストリ
  // ---------------------------------------------------------------
  var PX_PER_M = 110;
  var BRICK_W_M = 0.6;
  var BRICK_H_M = 0.24;
  var MORTAR_M = 0.03;

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

  var FEATURED_EXEMATE = {
    type: "company", name: "株式会社エグゼメイト", engrave: "exemate",
    industry: "ITソリューション・システム開発", employees: "45名", founded: "2015年",
    url: "https://exemate.co.jp",
    message: "遠賀川水源地ポンプ室の保存を応援しています。",
    date: "2026年7月"
  };

  // ---------------------------------------------------------------
  // 窓・扉の描画
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
      ctx.fillStyle = "#2a3a37"; ctx.fill();
      var gr = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 0.82);
      gr.addColorStop(0, "rgba(150,180,175,0.22)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.fill();
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
      var sg = ctx.createLinearGradient(0, y, 0, y + h * 0.4);
      sg.addColorStop(0, "rgba(90,85,70,0.35)");
      sg.addColorStop(1, "rgba(90,85,70,0)");
      archPath(ctx, x, y, w, h);
      ctx.fillStyle = sg; ctx.fill();
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
      for (var ri = 0; ri < 6; ri++) {
        ctx.fillStyle = "rgba(120,70,35," + rand(0.15, 0.35) + ")";
        ctx.fillRect(x + rand(0, w * 0.9), y + rand(h * 0.3, h * 0.9), rand(2, 6), rand(6, 22));
      }
    }
    ctx.restore();
  }

  // バンプ用: 窓/扉部分をフラット(中間グレー)で塗る
  function drawWindowBump(ctx, x, y, w, h, style) {
    ctx.save();
    ctx.fillStyle = "#5a5a5a";
    if (style === "circle") {
      var r = w / 2;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r * 1.12, 0, Math.PI * 2); ctx.fill();
    } else {
      var pad = w * 0.2;
      archPath(ctx, x - pad, y - pad, w + pad * 2, h + pad * 1.5);
      ctx.fill();
    }
    ctx.restore();
  }

  // 大きな半円のファン窓（実物の右妻面の窓）。cx=中心x, baseY=半円の下端y, R=半径
  // 大きな半円窓（理想: 赤レンガの迫石アーチ＋クリームのインフィル）
  function drawFanWindow(ctx, cx, baseY, R) {
    ctx.save();
    var outerR = R + Math.max(20, R * 0.2);
    // 赤レンガの放射迫石
    var seg = 18;
    for (var i = 0; i < seg; i++) {
      var a0 = Math.PI + Math.PI * i / seg, a1 = Math.PI + Math.PI * (i + 1) / seg;
      ctx.beginPath();
      ctx.arc(cx, baseY, outerR, a0, a1);
      ctx.arc(cx, baseY, R, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = (i % 2 === 0) ? "#a0492f" : "#8c3f28";
      ctx.fill();
      ctx.strokeStyle = "rgba(216,204,174,0.75)"; ctx.lineWidth = 2; ctx.stroke();
    }
    // クリームのインフィル（板張り/漆喰）
    ctx.fillStyle = "#e7ddc4";
    ctx.beginPath(); ctx.arc(cx, baseY, R, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill();
    // 退色ムラ
    var gg = ctx.createLinearGradient(0, baseY - R, 0, baseY);
    gg.addColorStop(0, "rgba(150,140,110,0.28)");
    gg.addColorStop(1, "rgba(120,110,86,0.08)");
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, baseY, R, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill();
    // 放射マリオン（薄く）
    ctx.strokeStyle = "rgba(120,108,84,0.5)"; ctx.lineWidth = 3;
    for (var a = 1; a < 8; a++) {
      var ang = Math.PI + Math.PI * a / 8;
      ctx.beginPath(); ctx.moveTo(cx, baseY);
      ctx.lineTo(cx + Math.cos(ang) * R, baseY + Math.sin(ang) * R); ctx.stroke();
    }
    // 起拱線（下端の石）
    ctx.strokeStyle = "#cdba95"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx - outerR, baseY); ctx.lineTo(cx + outerR, baseY); ctx.stroke();
    ctx.restore();
  }

  // 丸窓（理想: クリーム石の輪＋緑ガラス＋十字桟）。真円（アスペクト補正済みキャンバス前提）
  function drawRoundWindow(ctx, cx, cy, R) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = "#ddd0b2"; ctx.fill();       // 石の輪
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = "#33544a"; ctx.fill();       // 緑ガラス
    var gr = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
    gr.addColorStop(0, "rgba(150,185,170,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(225,232,222,0.6)"; ctx.lineWidth = Math.max(2, R * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // レンガ壁テクスチャ（カラー + バンプ）+ 刻印レジストリ
  // ---------------------------------------------------------------
  function makeBrickWallTexture(opts) {
    var cw = Math.round(opts.realW * PX_PER_M);
    var ch = Math.round(opts.realH * PX_PER_M);
    var canvas = makeCanvas(cw, ch);
    var ctx = canvas.getContext("2d");
    var bumpCanvas = makeCanvas(cw, ch);
    var bctx = bumpCanvas.getContext("2d");
    var brickW = BRICK_W_M * PX_PER_M;
    var brickH = BRICK_H_M * PX_PER_M;
    var mortar = Math.max(1.5, MORTAR_M * PX_PER_M);
    var windows = opts.windows || [];
    var door = opts.door || null;
    var wallId = opts.wallId || null;

    ctx.fillStyle = "#d8ccae"; // 目地はクリーム色（理想の赤レンガ＋明るい目地）
    ctx.fillRect(0, 0, cw, ch);
    bctx.fillStyle = "#2a2a2a"; // 目地 = 凹
    bctx.fillRect(0, 0, cw, ch);

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

    // パス1: レンガ + 刻印対象収集
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
        // 暖色の赤レンガ主体（理想画像準拠）: 赤 / 明るい橙 / 深い赤 / バフ
        if (p < 0.5) color = hsl(13 + rand(-5, 5), 54 + rand(-8, 8), 45 + rand(-6, 7));
        else if (p < 0.74) color = hsl(22 + rand(-6, 6), 46 + rand(-8, 8), 56 + rand(-7, 8));
        else if (p < 0.9) color = hsl(9 + rand(-4, 4), 50 + rand(-6, 6), 35 + rand(-6, 6));
        else color = hsl(36 + rand(-6, 6), 30 + rand(-6, 6), 70 + rand(-6, 6));
        var bx0 = x + mortar / 2, by0 = y + mortar / 2;
        ctx.fillStyle = color;
        ctx.fillRect(bx0, by0, bw, bh);
        // 上辺ハイライト / 下辺シャドウ（立体感）
        ctx.fillStyle = "rgba(255,244,228,0.14)";
        ctx.fillRect(bx0, by0, bw, bh * 0.18);
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(bx0, by0 + bh * 0.76, bw, bh * 0.24);
        // 表面の斑点
        for (var sp = 0; sp < 3; sp++) {
          ctx.fillStyle = "rgba(" + (Math.random() < 0.5 ? "0,0,0" : "255,240,220") + "," + rand(0.04, 0.1) + ")";
          ctx.fillRect(bx0 + rand(0, bw - 4), by0 + rand(0, bh - 3), rand(2, 5), rand(2, 4));
        }
        // バンプ: レンガ面 = 凸（明るさに個体差）
        bctx.fillStyle = "hsl(0,0%," + Math.round(rand(62, 78)) + "%)";
        bctx.fillRect(bx0, by0, bw, bh);

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

    // パス2: 漆喰の剥がれ・汚れ
    var plaster = opts.plaster || 0;
    var blotches = Math.round(plaster * 130);
    for (var bl = 0; bl < blotches; bl++) {
      var px2 = rand(0, cw), py2 = rand(0, ch), rr = rand(30, 170);
      var g = ctx.createRadialGradient(px2, py2, rr * 0.15, px2, py2, rr);
      var a = rand(0.35, 0.8);
      g.addColorStop(0, "rgba(224,212,186," + a + ")");
      g.addColorStop(1, "rgba(224,212,186,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px2, py2, rr, 0, Math.PI * 2); ctx.fill();
      // 漆喰部分はバンプも平滑寄りに
      var bg = bctx.createRadialGradient(px2, py2, rr * 0.15, px2, py2, rr);
      bg.addColorStop(0, "rgba(120,120,120," + (a * 0.7) + ")");
      bg.addColorStop(1, "rgba(120,120,120,0)");
      bctx.fillStyle = bg;
      bctx.beginPath(); bctx.arc(px2, py2, rr, 0, Math.PI * 2); bctx.fill();
    }
    var gg = ctx.createLinearGradient(0, ch * 0.82, 0, ch);
    gg.addColorStop(0, "rgba(40,32,22,0)");
    gg.addColorStop(1, "rgba(40,32,22,0.4)");
    ctx.fillStyle = gg;
    ctx.fillRect(0, ch * 0.82, cw, ch * 0.18);
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
      // 蔦の葉の粒
      for (var lf = 0; lf < irad * 0.8; lf++) {
        var la = rand(0, Math.PI * 2), ld = rand(0, irad * 0.9);
        ctx.fillStyle = hsl(rand(95, 130), rand(35, 55), rand(20, 38));
        ctx.globalAlpha = rand(0.25, 0.7);
        ctx.fillRect(ix + Math.cos(la) * ld, iy + Math.sin(la) * ld * 0.9, rand(2, 5), rand(2, 5));
      }
      ctx.globalAlpha = 1;
    }

    // パス4: 刻印
    sigs.forEach(function (s) {
      drawSignatureInBrick(ctx, s.bcx, s.bcy, s.bw, s.bh, s.text);
      // バンプ: 刻印は凹
      drawSignatureBump(bctx, s.bcx, s.bcy, s.bw, s.bh, s.text);
    });

    // パス5: 窓・扉
    windows.forEach(function (w) {
      var wpx = w.wFrac * cw, hpx = w.hFrac * ch;
      drawWindow(ctx, w.cxFrac * cw - wpx / 2, w.topFrac * ch, wpx, hpx, w.style);
      drawWindowBump(bctx, w.cxFrac * cw - wpx / 2, w.topFrac * ch, wpx, hpx, w.style);
    });
    if (door) {
      var dwpx = door.wFrac * cw, dhpx = door.hFrac * ch;
      drawWindow(ctx, door.cxFrac * cw - dwpx / 2, ch - dhpx, dwpx, dhpx, "door");
      drawWindowBump(bctx, door.cxFrac * cw - dwpx / 2, ch - dhpx, dwpx, dhpx, "door");
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = MAX_ANISO;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    var bump = new THREE.CanvasTexture(bumpCanvas);
    bump.anisotropy = MAX_ANISO;
    bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping;
    return { map: tex, bump: bump };
  }

  function sigFont(fs) {
    return "700 " + fs.toFixed(1) + "px \"Hiragino Kaku Gothic ProN\",\"Yu Gothic\",\"Meiryo\",sans-serif";
  }
  function fitSigFont(ctx, txt, bw, bh) {
    var fs = bh * 0.64;
    ctx.font = sigFont(fs);
    var w = ctx.measureText(txt).width;
    if (w > bw * 0.86) { fs *= (bw * 0.86) / w; ctx.font = sigFont(fs); }
  }
  function drawSignatureInBrick(ctx, cx, cy, bw, bh, txt) {
    ctx.save();
    fitSigFont(ctx, txt, bw, bh);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(20,13,8,0.62)";
    ctx.fillText(txt, cx + 1, cy + 1.3);
    ctx.fillStyle = "rgba(236,226,206,0.6)";
    ctx.fillText(txt, cx - 0.6, cy - 0.6);
    ctx.restore();
  }
  function drawSignatureBump(bctx, cx, cy, bw, bh, txt) {
    bctx.save();
    fitSigFont(bctx, txt, bw, bh);
    bctx.textAlign = "center";
    bctx.textBaseline = "middle";
    bctx.fillStyle = "#303030";
    bctx.fillText(txt, cx, cy);
    bctx.restore();
  }

  // ---------------------------------------------------------------
  // 妻壁テクスチャ
  // ---------------------------------------------------------------
  function makeGableTriTexture(style, mirror, plaster) {
    // キャンバスのアスペクトを三角形の外接矩形(幅=SHED_HW*2, 高=ROOF_H)に合わせる → 丸窓が真円になる
    var S_W = 768;
    var S_H = Math.max(280, Math.round(S_W * ROOF_H / (SHED_HW * 2)));
    var c = makeCanvas(S_W, S_H);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#d8ccae"; ctx.fillRect(0, 0, S_W, S_H);  // クリーム目地
    var bw = BRICK_W_M * PX_PER_M, bh = BRICK_H_M * PX_PER_M, mort = MORTAR_M * PX_PER_M;
    for (var r = 0; r * bh < S_H; r++) {
      var y = S_H - (r + 1) * bh;
      var offset = (r % 2 === 0) ? 0 : bw / 2;
      for (var x = -offset; x < S_W; x += bw) {
        var p = Math.random(), color;
        if (p < 0.5) color = hsl(13 + rand(-5, 5), 54 + rand(-8, 8), 45 + rand(-6, 7));
        else if (p < 0.74) color = hsl(22 + rand(-6, 6), 46, 56);
        else if (p < 0.9) color = hsl(9 + rand(-4, 4), 50, 35);
        else color = hsl(36, 30, 70);
        ctx.fillStyle = color;
        ctx.fillRect(x + mort, y + mort, bw - mort * 2, bh - mort * 2);
        ctx.fillStyle = "rgba(255,244,228,0.12)";
        ctx.fillRect(x + mort, y + mort, bw - mort * 2, (bh - mort * 2) * 0.18);
        ctx.fillStyle = "rgba(0,0,0,0.14)";
        ctx.fillRect(x + mort, y + (bh - mort) * 0.78, bw - mort * 2, (bh - mort) * 0.22);
      }
    }
    var blotches = Math.round((plaster || 0) * 40);
    for (var bl = 0; bl < blotches; bl++) {
      var bx = rand(0, S_W), by = rand(0, S_H), rr = rand(40, 130);
      var g = ctx.createRadialGradient(bx, by, rr * 0.15, bx, by, rr);
      var a = rand(0.3, 0.65);
      g.addColorStop(0, "rgba(226,214,188," + a + ")");
      g.addColorStop(1, "rgba(226,214,188,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    // 窓（アスペクト補正済みなので px 等倍＝実寸比）
    // 窓は下寄せ（三角と壁の境目付近）
    if (style === "circle") drawRoundWindow(ctx, S_W * 0.5, S_H * 0.78, S_H * 0.2);
    else if (style === "fan") drawFanWindow(ctx, S_W * 0.5, S_H * 0.82, S_H * 0.34);
    // 蔦（右妻に多め）
    for (var i = 0; i < 6; i++) {
      var vx = rand(0, S_W), vy = rand(S_H * 0.5, S_H), vr = rand(50, 130);
      var vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
      vg.addColorStop(0, "rgba(44,74,32,0.5)"); vg.addColorStop(1, "rgba(44,74,32,0)");
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(vx, vy, vr, 0, Math.PI * 2); ctx.fill();
    }
    // 破風の石帯＋歯飾り（両スロープ）
    function drawRake(x1, y1, x2, y2) {
      ctx.strokeStyle = "#e0d4b6"; ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      var steps = 12, nx = -(y2 - y1), ny = (x2 - x1), nl = Math.hypot(nx, ny);
      nx /= nl; ny /= nl;
      for (var t = 1; t < steps; t++) {
        var f = t / steps, px = x1 + (x2 - x1) * f, py = y1 + (y2 - y1) * f;
        ctx.fillStyle = "#9c4a30";
        ctx.fillRect(px + nx * 10 - 6, py + ny * 10 - 6, 12, 12);
      }
    }
    drawRake(0, S_H, S_W / 2, 0);
    drawRake(S_W / 2, 0, S_W, S_H);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = MAX_ANISO;
    return tex;
  }

  // ---------------------------------------------------------------
  // その他テクスチャ
  // ---------------------------------------------------------------
  function makeRoofTexture() {
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = c.getContext("2d");
    var base = ctx.createLinearGradient(0, 0, 0, S);
    base.addColorStop(0, "#868d93");
    base.addColorStop(1, "#6e757b");
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    for (var x = 0; x < S; x += 16) {
      ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(x, 0, 2, S);
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + 2, 0, 2, S);
      ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(x + 9, 0, 4, S);
    }
    for (var st = 0; st < 10; st++) {
      ctx.fillStyle = "rgba(120,90,60," + rand(0.03, 0.1) + ")";
      var sx = rand(0, S);
      ctx.fillRect(sx, rand(0, S * 0.4), rand(3, 9), rand(S * 0.3, S * 0.7));
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = MAX_ANISO;
    return tex;
  }
  function makeRoofBump() {
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#707070"; ctx.fillRect(0, 0, S, S);
    for (var x = 0; x < S; x += 16) {
      ctx.fillStyle = "#c8c8c8"; ctx.fillRect(x, 0, 3, S);
      ctx.fillStyle = "#404040"; ctx.fillRect(x + 3, 0, 2, S);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeGroundTexture() {
    var S = 1024;
    var c = makeCanvas(S, S);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#55703a"; ctx.fillRect(0, 0, S, S);
    // 大きなムラ（刈った草地の色変化）
    for (var m = 0; m < 30; m++) {
      var mx = rand(0, S), my = rand(0, S), mr = rand(60, 220);
      var mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      var col = Math.random() < 0.5 ? "150,160,90" : "70,95,50";
      mg.addColorStop(0, "rgba(" + col + "," + rand(0.15, 0.35) + ")");
      mg.addColorStop(1, "rgba(" + col + ",0)");
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    }
    for (var i = 0; i < 26000; i++) {
      ctx.fillStyle = "hsl(" + (88 + rand(-18, 18)) + "," + (34 + rand(-10, 10)) + "%," + (26 + Math.random() * 28) + "%)";
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    for (var k = 0; k < 50; k++) {
      var bx = Math.random() * S, by = Math.random() * S, rr = rand(15, 60);
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      g.addColorStop(0, "rgba(92,74,46,0.4)"); g.addColorStop(1, "rgba(92,74,46,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.08, 0.08);
    tex.anisotropy = MAX_ANISO;
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
    tex.anisotropy = MAX_ANISO;
    return tex;
  }

  function makeRoadTexture() {
    // 道路は x 方向に走る: ダッシュは横向き
    var c = makeCanvas(256, 128);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3c3d40"; ctx.fillRect(0, 0, 256, 128);
    for (var i = 0; i < 1500; i++) {
      ctx.fillStyle = "rgba(255,255,255," + rand(0.02, 0.06) + ")";
      ctx.fillRect(Math.random() * 256, Math.random() * 128, 1.5, 1.5);
    }
    ctx.fillStyle = "rgba(235,235,225,0.85)";
    ctx.fillRect(10, 61, 60, 6);
    ctx.fillRect(130, 61, 60, 6);
    // 端の白線
    ctx.fillRect(0, 6, 256, 4);
    ctx.fillRect(0, 118, 256, 4);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 1);
    tex.anisotropy = MAX_ANISO;
    return tex;
  }

  function makeGrassBladeTexture() {
    var c = makeCanvas(64, 64);
    var ctx = c.getContext("2d");
    for (var i = 0; i < 9; i++) {
      var x = 5 + i * 6.5 + rand(-2, 2), h = rand(34, 58), base = 63;
      ctx.strokeStyle = hsl(96 + rand(-16, 16), 52, 34 + rand(-8, 12));
      ctx.lineWidth = rand(1.8, 3.2);
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

  // 空: 雲 + 山並みシルエット入りのドームテクスチャ
  function makeSkyDomeTexture() {
    var W = 1024, H = 512;
    var c = makeCanvas(W, H);
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, "#3e6f9e");
    g.addColorStop(0.55, "#7aa3c2");
    g.addColorStop(1, "#cddbe2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.62);
    ctx.fillStyle = "#dfe4e0";
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    // 雲（水平方向につながるよう左右端もカバー）
    function cloud(cx, cy, scale, alpha) {
      for (var b = 0; b < 7; b++) {
        var bx = cx + rand(-60, 60) * scale;
        var by = cy + rand(-12, 12) * scale;
        var br = rand(22, 55) * scale;
        var cg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        cg.addColorStop(0, "rgba(255,255,255," + alpha + ")");
        cg.addColorStop(0.7, "rgba(250,250,252," + (alpha * 0.5) + ")");
        cg.addColorStop(1, "rgba(250,250,252,0)");
        ctx.fillStyle = cg;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(1, 0.45);
        ctx.beginPath(); ctx.arc(0, 0, br, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    for (var cl = 0; cl < 22; cl++) {
      cloud(rand(0, W), rand(40, 230), rand(0.7, 1.7), rand(0.18, 0.5));
    }
    // 山並み（地平線）
    ctx.fillStyle = "rgba(96,116,124,0.85)";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    var my = H * 0.585;
    for (var mx = 0; mx <= W; mx += 40) {
      my = clamp(my + rand(-14, 14), H * 0.555, H * 0.615);
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(W, H * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(120,140,140,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    my = H * 0.6;
    for (var mx2 = 0; mx2 <= W; mx2 += 60) {
      my = clamp(my + rand(-10, 10), H * 0.575, H * 0.62);
      ctx.lineTo(mx2, my);
    }
    ctx.lineTo(W, H * 0.62);
    ctx.closePath();
    ctx.fill();
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
  // レンダラ・シーン・ライト
  // ---------------------------------------------------------------
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  var MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc8d4da, 42, 115);

  var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);

  // 空ドーム
  var skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(380, 32, 20),
    new THREE.MeshBasicMaterial({ map: makeSkyDomeTexture(), side: THREE.BackSide, fog: false })
  );
  skyDome.userData.shadow = "none";
  scene.add(skyDome);

  scene.add(new THREE.HemisphereLight(0xcfe0ea, 0x5a4c34, 0.72));
  var sun = new THREE.DirectionalLight(0xffeecb, 1.45);
  sun.position.set(38, 60, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 250;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x404850, 0.25));

  // ---------------------------------------------------------------
  // 敷地レイアウト（実物準拠・コンパクト）
  //   建物: x -9.2..9.2, z 0..36（正面妻壁が -z 向き）
  //   貯水池: 東(+x)の長辺すぐ隣 / 道路: 正面(-z)のすぐ前を x 方向に
  // ---------------------------------------------------------------
  var BASIN = { minX: 12.5, maxX: 30, minZ: 1, maxZ: 35, inMinX: 15.5, inMaxX: 27, inMinZ: 4, inMaxZ: 32, bottomY: -1.7 };

  // 地面は霧で消える程度に広く取る（世界の端は fog(far=115) で見えない）。
  // 「狭さ」はフェンスと小物の密度で出す（地面サイズは見た目に影響しない）。
  var groundShape = new THREE.Shape();
  groundShape.moveTo(-150, -170);
  groundShape.lineTo(170, -170);
  groundShape.lineTo(170, 150);
  groundShape.lineTo(-150, 150);
  var basinHole = new THREE.Path();
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
  ground.userData.shadow = "receive";
  scene.add(ground);

  // ---------------------------------------------------------------
  // 建屋
  // ---------------------------------------------------------------
  var SHED_HW = 4.6;
  var BUILD_LEN = 36;
  var WALL_H = 7.6;          // 壁を高く（理想はもっと縦長）
  var ROOF_H = 5.2;          // 妻を急・大きく
  var VALLEY_H = WALL_H + ROOF_H * 0.15;
  var TOTAL_W = SHED_HW * 4;
  var APEX_Y = WALL_H + ROOF_H;

  var buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  function makeLongWallWindows() {
    // 実物の長辺: 背の高い大アーチ窓が近接して並ぶ
    var arr = [], n = 10;
    for (var i = 0; i < n; i++) {
      var cx = 0.06 + (i / (n - 1)) * 0.88;
      arr.push({ cxFrac: cx, topFrac: 0.17, wFrac: 0.07, hFrac: 0.66, style: "arch" });
    }
    return arr;
  }

  var texEast = makeBrickWallTexture({
    wallId: "east", realW: BUILD_LEN, realH: WALL_H,
    windows: makeLongWallWindows(), nameProb: 0.06, ivyDensity: 12, plaster: 0.12
  });
  var texWest = makeBrickWallTexture({
    wallId: "west", realW: BUILD_LEN, realH: WALL_H,
    windows: makeLongWallWindows(), nameProb: 0.06, ivyDensity: 40, plaster: 0.1
  });
  // 正面（妻面下部）: 赤レンガ主体。中央に扉、左下(=+x側=画面左)に小窓
  var texFront = makeBrickWallTexture({
    wallId: "front", realW: TOTAL_W, realH: WALL_H,
    windows: [
      { cxFrac: 0.24, topFrac: 0.54, wFrac: 0.05, hFrac: 0.28, style: "smallarch" },
      { cxFrac: 0.31, topFrac: 0.54, wFrac: 0.05, hFrac: 0.28, style: "smallarch" }
    ],
    door: { cxFrac: 0.5, wFrac: 0.075, hFrac: 0.42 },
    nameProb: 0.05, ivyDensity: 12, plaster: 0.16,
    featured: [{ y_m: 1.5, xFrac: 0.66, donor: FEATURED_EXEMATE }]
  });
  var texBack = makeBrickWallTexture({
    wallId: "back", realW: TOTAL_W, realH: WALL_H,
    windows: [], nameProb: 0.05, ivyDensity: 25, plaster: 0.14
  });
  var flatBrick = new THREE.MeshStandardMaterial({ color: 0x8a4a30, roughness: 0.95 });

  function wallMat(t) {
    return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.25, roughness: 0.95 });
  }
  var wallBox = new THREE.Mesh(new THREE.BoxGeometry(TOTAL_W, WALL_H, BUILD_LEN), [
    wallMat(texEast), wallMat(texWest), flatBrick, flatBrick, wallMat(texBack), wallMat(texFront)
  ]);
  wallBox.position.set(0, WALL_H / 2, BUILD_LEN / 2);
  buildingGroup.add(wallBox);

  var wallFaceInfo = {
    0: { wallId: "east", label: "E", realW: BUILD_LEN, realH: WALL_H, uDir: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2 },
    1: { wallId: "west", label: "W", realW: BUILD_LEN, realH: WALL_H, uDir: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2 },
    4: { wallId: "back", label: "B", realW: TOTAL_W, realH: WALL_H, uDir: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1), rotY: 0 },
    5: { wallId: "front", label: "F", realW: TOTAL_W, realH: WALL_H, uDir: new THREE.Vector3(-1, 0, 0), normal: new THREE.Vector3(0, 0, -1), rotY: Math.PI }
  };

  var roofColorTex = makeRoofTexture();
  var roofBumpTex = makeRoofBump();
  function roofMaterial() {
    return new THREE.MeshStandardMaterial({ map: roofColorTex, bumpMap: roofBumpTex, bumpScale: 0.15, roughness: 0.5, metalness: 0.25 });
  }
  function addRoofSlope(xEave, xRidge, yEave, yRidge) {
    var slopeLen = Math.hypot(xRidge - xEave, yRidge - yEave);
    buildingGroup.add(makeQuadMesh(
      [xEave, yEave, 0], [xRidge, yRidge, 0], [xRidge, yRidge, BUILD_LEN], [xEave, yEave, BUILD_LEN],
      roofMaterial(), BUILD_LEN / 3, slopeLen / 1.2));
  }
  addRoofSlope(-SHED_HW * 2, -SHED_HW, WALL_H, APEX_Y);
  addRoofSlope(0, -SHED_HW, VALLEY_H, APEX_Y);
  addRoofSlope(SHED_HW * 2, SHED_HW, WALL_H, APEX_Y);
  addRoofSlope(0, SHED_HW, VALLEY_H, APEX_Y);

  function addClerestory(x) {
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 22), new THREE.MeshStandardMaterial({ color: 0xdfe2e5, roughness: 0.6 }));
    body.position.set(x, APEX_Y + 0.35, BUILD_LEN / 2);
    buildingGroup.add(body);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 22.8), roofMaterial());
    cap.position.set(x, APEX_Y + 0.77, BUILD_LEN / 2);
    buildingGroup.add(cap);
  }
  addClerestory(-SHED_HW);
  addClerestory(SHED_HW);

  // 丸窓とアーチ窓を左右入れ替え（画面左＝アーチ / 画面右＝丸窓）。+x が画面左に写る
  var gableFL = makeGableTriTexture("circle", false, 0.6);
  var gableFR = makeGableTriTexture("fan", true, 0.55);
  var gableBL = makeGableTriTexture("plain", false, 0.25);
  var gableBR = makeGableTriTexture("plain", true, 0.25);

  function addGableTri(xOuter, xRidge, z, tex) {
    var p1 = [xOuter, WALL_H, z], p2 = [xRidge, APEX_Y, z], p3 = [0, VALLEY_H, z];
    var mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
    var minX = Math.min(xOuter, xRidge, 0), maxX = Math.max(xOuter, xRidge, 0);
    function uv(p) { return [(p[0] - minX) / (maxX - minX), (p[1] - WALL_H) / ROOF_H]; }
    buildingGroup.add(makeTriMesh(p1, p2, p3, mat, uv(p1), uv(p2), uv(p3)));
  }
  addGableTri(-SHED_HW * 2, -SHED_HW, 0, gableFL);
  addGableTri(SHED_HW * 2, SHED_HW, 0, gableFR);
  addGableTri(-SHED_HW * 2, -SHED_HW, BUILD_LEN, gableBL);
  addGableTri(SHED_HW * 2, SHED_HW, BUILD_LEN, gableBR);

  // 妻壁の谷部と壁上端(WALL_H)の間にできる三角の隙間を塞ぐ（前後）
  var gableFillMat = new THREE.MeshStandardMaterial({ color: 0xb0674a, roughness: 0.95, side: THREE.DoubleSide });
  [0, BUILD_LEN].forEach(function (z) {
    buildingGroup.add(makeTriMesh(
      [-SHED_HW * 2, WALL_H, z], [SHED_HW * 2, WALL_H, z], [0, VALLEY_H, z],
      gableFillMat, [0, 0], [1, 0], [0.5, 1]));
  });

  // 理想準拠: 柱はクリーム色の本体＋赤レンガの頭(キャップ)
  var pilasterMat = new THREE.MeshStandardMaterial({ color: 0xd7cdb6, roughness: 0.9 });
  var capMat = new THREE.MeshStandardMaterial({ color: 0x9c4a30, roughness: 0.85 });
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

  // 正面中央（谷部）のピア: 上部のみ・壁面とほぼ面一。頂部に石帽子＋小煙突（実物準拠）
  (function addCenterPier() {
    var y0 = WALL_H - 1.4, y1 = VALLEY_H + 0.5, zc = 0.05;
    var pier = new THREE.Mesh(new THREE.BoxGeometry(1.05, y1 - y0, 0.3), pilasterMat);
    pier.position.set(0, (y0 + y1) / 2, zc);
    buildingGroup.add(pier);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 0.5), capMat);
    cap.position.set(0, y1 + 0.12, zc);
    buildingGroup.add(cap);
    var stub = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.42), pilasterMat);
    stub.position.set(0, y1 + 0.65, zc);
    buildingGroup.add(stub);
    var stubCap = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.2, 0.56), capMat);
    stubCap.position.set(0, y1 + 1.25, zc);
    buildingGroup.add(stubCap);
  })();

  // 避雷針マスト + 渡り線
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

  // 建物足元の接地影（AOストリップ）
  var aoCanvas = makeCanvas(32, 32);
  (function () {
    var actx = aoCanvas.getContext("2d");
    var ag = actx.createLinearGradient(0, 0, 0, 32);
    ag.addColorStop(0, "rgba(0,0,0,0)");     // canvas上 = v=1 (遠い側)
    ag.addColorStop(1, "rgba(0,0,0,0.42)");  // canvas下 = v=0 (壁側)
    actx.fillStyle = ag;
    actx.fillRect(0, 0, 32, 32);
  })();
  var aoTex = new THREE.CanvasTexture(aoCanvas);
  function addAOStrip(cx, cz, len, theta) {
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 1.4),
      new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false })
    );
    mesh.rotation.set(-Math.PI / 2, 0, theta);
    mesh.position.set(cx, 0.02, cz);
    mesh.userData.shadow = "none";
    scene.add(mesh);
  }
  addAOStrip(0, -0.7, TOTAL_W + 2, 0);                    // 正面（暗部が+z=壁側）
  addAOStrip(0, BUILD_LEN + 0.7, TOTAL_W + 2, Math.PI);   // 背面
  addAOStrip(TOTAL_W / 2 + 0.7, BUILD_LEN / 2, BUILD_LEN, -Math.PI / 2); // 東
  addAOStrip(-TOTAL_W / 2 - 0.7, BUILD_LEN / 2, BUILD_LEN, Math.PI / 2); // 西

  // ---------------------------------------------------------------
  // 貯水池（東の長辺すぐ隣・写真3進拠）
  // ---------------------------------------------------------------
  var concreteTex = makeConcreteTexture();
  function concreteMaterial() {
    return new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });
  }
  var B = BASIN;
  [
    [[B.minX, 0, B.minZ], [B.maxX, 0, B.minZ], [B.inMaxX, B.bottomY, B.inMinZ], [B.inMinX, B.bottomY, B.inMinZ]],
    [[B.maxX, 0, B.maxZ], [B.minX, 0, B.maxZ], [B.inMinX, B.bottomY, B.inMaxZ], [B.inMaxX, B.bottomY, B.inMaxZ]],
    [[B.minX, 0, B.maxZ], [B.minX, 0, B.minZ], [B.inMinX, B.bottomY, B.inMinZ], [B.inMinX, B.bottomY, B.inMaxZ]],
    [[B.maxX, 0, B.minZ], [B.maxX, 0, B.maxZ], [B.inMaxX, B.bottomY, B.inMaxZ], [B.inMaxX, B.bottomY, B.inMinZ]]
  ].forEach(function (q) {
    var m = makeQuadMesh(q[0], q[1], q[2], q[3], concreteMaterial(), 5, 1);
    m.userData.shadow = "receive";
    scene.add(m);
  });
  var water = new THREE.Mesh(
    new THREE.PlaneGeometry(B.inMaxX - B.inMinX, B.inMaxZ - B.inMinZ),
    new THREE.MeshStandardMaterial({ color: 0x39544d, roughness: 0.08, metalness: 0.25 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((B.inMinX + B.inMaxX) / 2, B.bottomY + 0.55, (B.inMinZ + B.inMaxZ) / 2);
  water.userData.shadow = "receive";
  scene.add(water);

  // 貯水池フェンス（有刺鉄線）
  (function addBasinFence() {
    var postMat = new THREE.MeshStandardMaterial({ color: 0x8f969b, roughness: 0.5, metalness: 0.5 });
    var m = 0.6;
    var corners = [
      [B.minX - m, B.minZ - m], [B.maxX + m, B.minZ - m],
      [B.maxX + m, B.maxZ + m], [B.minX - m, B.maxZ + m]
    ];
    var wl = new THREE.LineBasicMaterial({ color: 0x777d80 });
    for (var e = 0; e < 4; e++) {
      var a = corners[e], b = corners[(e + 1) % 4];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var nPosts = Math.max(2, Math.round(len / 3.2));
      for (var i = 0; i <= nPosts; i++) {
        var t = i / nPosts;
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6), postMat);
        post.position.set(a[0] + (b[0] - a[0]) * t, 0.575, a[1] + (b[1] - a[1]) * t);
        scene.add(post);
      }
      [0.5, 0.8, 1.1].forEach(function (h) {
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a[0], h, a[1]), new THREE.Vector3(b[0], h, b[1])
        ]), wl));
      });
    }
  })();

  // 黄色い手すり（東壁と貯水池の間・壁のすぐ脇）
  (function addYellowRail() {
    var railMat = new THREE.MeshStandardMaterial({ color: 0xd9b422, roughness: 0.6, metalness: 0.2 });
    var x = 11.2, z0 = 1, z1 = 35;
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

  // 鉄塔やぐら（東壁沿い）
  function addTowerLattice(x, z) {
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
  addTowerLattice(10.1, 11);
  addTowerLattice(10.1, 23);

  // 東壁沿いの白い制御盤ボックス
  var ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x8f9498, roughness: 0.6, metalness: 0.3 }));
  ctrlBox.position.set(10.2, 0.95, 17);
  scene.add(ctrlBox);

  // 配管（東壁から貯水池へ下る）+ バルブ
  var pipeMat = new THREE.MeshStandardMaterial({ color: 0x6a6f74, roughness: 0.5, metalness: 0.5 });
  function addBasinPipe(z) {
    var hor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 8), pipeMat);
    hor.rotation.z = -Math.PI / 2;
    hor.position.set(11.3, 0.45, z);
    scene.add(hor);
    var slope = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), pipeMat);
    slope.rotation.z = -Math.PI / 2 - 0.5;
    slope.position.set(14.7, -0.25, z);
    scene.add(slope);
    var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a3020, roughness: 0.6, metalness: 0.3 }));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(10.6, 0.75, z);
    scene.add(wheel);
  }
  addBasinPipe(14);
  addBasinPipe(26);

  // 正面の古い配管・バルブ（写真1の手前）
  var fpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), pipeMat);
  fpipe.position.set(3.2, 0.5, -1.5);
  scene.add(fpipe);
  var fwheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a3020, roughness: 0.6, metalness: 0.3 }));
  fwheel.rotation.x = Math.PI / 2;
  fwheel.position.set(3.2, 1.05, -1.5);
  scene.add(fwheel);

  // 水タンク（北東・写真3左手）
  var tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 0.8 }));
  tank.position.set(20, 1.2, 39.5);
  scene.add(tank);

  // ---------------------------------------------------------------
  // 道路（正面のすぐ前を横切る・県道73号相当）+ 電柱
  // ---------------------------------------------------------------
  var road = new THREE.Mesh(new THREE.PlaneGeometry(140, 8), new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, -38);
  road.userData.shadow = "receive";
  scene.add(road);
  var sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(140, 1.8), new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.95 }));
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, 0.025, -33);
  sidewalk.userData.shadow = "receive";
  scene.add(sidewalk);

  // 門から正面扉への通路（扉は x≈0.9）— 前庭が広いので長め
  var path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 30), concreteMaterial());
  path.rotation.x = -Math.PI / 2;
  path.position.set(0.9, 0.02, -14.5);
  path.userData.shadow = "receive";
  scene.add(path);

  // 電柱（道路沿い）+ 電線
  var poleMat = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.8 });
  var poleTops = [];
  [-32, -14, 4, 22, 40].forEach(function (px) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 9.5, 8), poleMat);
    pole.position.set(px, 4.75, -42);
    scene.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.13, 0.13), new THREE.MeshStandardMaterial({ color: 0x5a3a24 }));
    arm.position.set(px, 8.6, -42);
    scene.add(arm);
    var arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.11, 0.11), new THREE.MeshStandardMaterial({ color: 0x5a3a24 }));
    arm2.position.set(px, 7.7, -42);
    scene.add(arm2);
    poleTops.push(new THREE.Vector3(px, 8.9, -42));
  });
  for (var pw = 0; pw < poleTops.length - 1; pw++) {
    [-0.9, -0.3, 0.3, 0.9].forEach(function (off) {
      var a = poleTops[pw].clone().add(new THREE.Vector3(off, 0, 0));
      var b = poleTops[pw + 1].clone().add(new THREE.Vector3(off, 0, 0));
      var mid = a.clone().lerp(b, 0.5); mid.y -= 0.9;
      var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(14)), wireMat));
    });
  }

  // ---------------------------------------------------------------
  // 敷地フェンス（コンクリ支柱 + 有刺鉄線、正面に門）
  // ---------------------------------------------------------------
  // 敷地は広めに取り、前庭に広告の余裕を持たせる（フェンスは周縁の控えめな金網）
  var SITE = { minX: -26, maxX: 42, minZ: -30, maxZ: 50, gateX0: -3, gateX1: 6 };
  (function addSiteFence() {
    var postMat = new THREE.MeshStandardMaterial({ color: 0x9a978d, roughness: 0.7, metalness: 0.25 });
    var wl = new THREE.LineBasicMaterial({ color: 0x8a8f92, transparent: true, opacity: 0.55 });
    function fenceRun(x0, z0, x1, z1) {
      var len = Math.hypot(x1 - x0, z1 - z0);
      var nPosts = Math.max(1, Math.round(len / 4.5));
      for (var i = 0; i <= nPosts; i++) {
        var t = i / nPosts;
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 6), postMat);
        post.position.set(x0 + (x1 - x0) * t, 0.625, z0 + (z1 - z0) * t);
        scene.add(post);
      }
      [0.5, 0.85, 1.18].forEach(function (h) {
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x0, h, z0), new THREE.Vector3(x1, h, z1)
        ]), wl));
      });
    }
    fenceRun(SITE.minX, SITE.minZ, SITE.gateX0, SITE.minZ);
    fenceRun(SITE.gateX1, SITE.minZ, SITE.maxX, SITE.minZ);
    fenceRun(SITE.minX, SITE.maxZ, SITE.maxX, SITE.maxZ);
    fenceRun(SITE.minX, SITE.minZ, SITE.minX, SITE.maxZ);
    fenceRun(SITE.maxX, SITE.minZ, SITE.maxX, SITE.maxZ);
    // 門柱
    [SITE.gateX0, SITE.gateX1].forEach(function (gx) {
      var gp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.7, 0.24), new THREE.MeshStandardMaterial({ color: 0x8f8b80, roughness: 0.8 }));
      gp.position.set(gx, 0.85, SITE.minZ);
      scene.add(gp);
    });
  })();

  // ---------------------------------------------------------------
  // 周辺の民家（道路の向かい・敷地外）
  // ---------------------------------------------------------------
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
  // 道路の向かいの一列だけ（コンパクト）
  addHouse(-26, -48, 0.08, 7, 6, 3, 0xd8d3c8, 0x5a5f66);
  addHouse(-9, -49, -0.05, 8, 7, 3, 0xc9b8a4, 0x7a4a3a);
  addHouse(9, -48, 0.12, 6, 6, 2.8, 0xb9c0c4, 0x3f4a55);
  addHouse(26, -49, 0.3, 7, 6, 3, 0xe2ddd2, 0x5a5f66);
  addHouse(44, -45, 0.5, 6, 7, 2.8, 0xd8d3c8, 0x7a4a3a);


  // 敷地北の遺構（崩れたレンガ壁・基礎）
  (function addRuins() {
    var ruinMat = new THREE.MeshStandardMaterial({ color: 0x74503c, roughness: 0.95 });
    [[-6, 50, 5, 1.6], [2, 53, 4, 2.2], [10, 49, 6, 1.2]].forEach(function (rw) {
      var wall = new THREE.Mesh(new THREE.BoxGeometry(rw[2], rw[3], 0.35), ruinMat);
      wall.position.set(rw[0], rw[3] / 2, rw[1]);
      wall.rotation.y = rand(-0.3, 0.3);
      scene.add(wall);
    });
    var slab = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 7), concreteMaterial());
    slab.position.set(2, 0.075, 50);
    slab.userData.shadow = "receive";
    scene.add(slab);
  })();

  // 東側のコンクリ土間（航空写真の右側）
  var apron = new THREE.Mesh(new THREE.PlaneGeometry(10, 22), concreteMaterial());
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(38, 0.02, 17);
  apron.userData.shadow = "receive";
  scene.add(apron);

  // ---------------------------------------------------------------
  // 植生
  // ---------------------------------------------------------------
  var trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4128, roughness: 0.95 });
  function foliageMat() { return new THREE.MeshStandardMaterial({ color: hsl(rand(95, 130), rand(38, 55), rand(26, 40)), roughness: 0.9, flatShading: true }); }

  function tooCloseToBuilding(x, z, margin) {
    margin = margin || 3;
    return (x > -TOTAL_W / 2 - margin && x < TOTAL_W / 2 + margin && z > -margin - 4 && z < BUILD_LEN + margin);
  }
  function blockedForProp(x, z) {
    if (tooCloseToBuilding(x, z, 3.5)) return true;
    if (x > 11 && x < 31.5 && z > 0 && z < 36.5) return true;   // 貯水池
    if (z > -44 && z < -31 && x > -70 && x < 70) return true;   // 道路 + 歩道
    if (x > -0.6 && x < 2.4 && z > -30 && z < 0.5) return true; // 通路
    if (x > 32 && x < 44 && z > 5 && z < 29) return true;       // 東土間
    if (x > -14.5 && x < -9.5 && z > -25 && z < -3) return true; // 左広告列
    if (x > 10.5 && x < 15.5 && z > -25 && z < -3) return true;  // 右広告列
    for (var i = 0; i < houseColliders.length; i++) {
      var h = houseColliders[i];
      if (x > h.minX - 2 && x < h.maxX + 2 && z > h.minZ - 2 && z < h.maxZ + 2) return true;
    }
    return false;
  }
  function blockedForGrass(x, z) {
    if (tooCloseToBuilding(x, z, 0.7)) return true;
    if (x > 11.5 && x < 31 && z > 0.5 && z < 36) return true;
    if (z > -44 && z < -31) return true;
    if (x > -0.6 && x < 2.4 && z > -30 && z < 0.5) return true;
    if (x > 33 && x < 43 && z > 6 && z < 28) return true;
    if (x > -13.5 && x < -10.5 && z > -25 && z < -3) return true; // 左広告列
    if (x > 11.5 && x < 14.5 && z > -25 && z < -3) return true;   // 右広告列
    return false;
  }

  // 木の配置を記録しておく（後で 3Dモデルに一括差し替えできるように）
  var treePlacements = [];
  var treeProcedural = [];
  function buildProceduralTree(scale) {
    var g = new THREE.Group();
    var th = rand(3.0, 5.0) * scale;
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.32 * scale, th, 7), trunkMat);
    trunk.position.y = th / 2;
    g.add(trunk);
    var n = 4 + Math.floor(Math.random() * 3);
    for (var k = 0; k < n; k++) {
      var fol = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.2, 2.1) * scale, 0), foliageMat());
      fol.position.set(rand(-1.2, 1.2) * scale, th + rand(-0.4, 1.3) * scale, rand(-1.2, 1.2) * scale);
      g.add(fol);
    }
    return g;
  }
  function addTree(x, z, scale) {
    scale = scale || 1;
    treePlacements.push({ x: x, z: z, scale: scale });
    var g = buildProceduralTree(scale);   // まず手続き生成の木を置く（モデルが無い時のフォールバック）
    g.position.set(x, 0, z);
    g.rotation.y = rand(0, Math.PI * 2);
    scene.add(g);
    treeProcedural.push(g);
  }
  function addBush(x, z) {
    var r = rand(0.5, 1.0);
    var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliageMat());
    bush.position.set(x, r * 0.7, z);
    bush.scale.y = 0.8;
    scene.add(bush);
  }
  function addRock(x, z) {
    var r = rand(0.3, 0.7);
    var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: hsl(28, 12, rand(28, 40)), roughness: 1, flatShading: true }));
    rock.position.set(x, r * 0.5, z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    scene.add(rock);
  }
  var grassTexBlade = makeGrassBladeTexture();
  var grassMat = new THREE.MeshStandardMaterial({ map: grassTexBlade, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  var grassGeo = new THREE.PlaneGeometry(0.7, 0.55);
  function addGrassTuft(x, z) {
    var g = new THREE.Group();
    var p1 = new THREE.Mesh(grassGeo, grassMat);
    var p2 = new THREE.Mesh(grassGeo, grassMat);
    p2.rotation.y = Math.PI / 2;
    p1.userData.shadow = "receive";
    p2.userData.shadow = "receive";
    g.add(p1); g.add(p2);
    var s = rand(0.7, 1.6);
    g.scale.set(s, s, s);
    g.position.set(x, 0.55 * s / 2, z);
    g.rotation.y = rand(0, Math.PI);
    scene.add(g);
  }

  // 敷地内西側の大木（航空写真: 建物西に樹木帯）
  addTree(-12.5, 10, 1.4);
  addTree(-13, 24, 1.2);
  addTree(-13.5, 33, 1.1);
  addTree(-22, 6, 1.0);
  addTree(-23, -18, 1.0);
  addTree(-24, -28, 0.95);
  addTree(37, -20, 1.0);
  addTree(38, -4, 1.05);
  // 敷地外
  addTree(-20, 54, 1.2);
  addTree(28, 52, 1.0);
  addTree(-40, -30, 0.9);
  addTree(46, -34, 1.0);

  // ---------------------------------------------------------------
  // 木の 3Dモデル差し替え
  //   asset/model/ に tree.obj(+tree.mtl) か tree.glb があれば全部の木を置き換える。
  //   ・無ければ何もしない（手続き生成の木のまま＝壊れない）
  //   ・元サイズを自動計測して TREE_TARGET_H(m) に正規化 → どんな木でも合う
  // ---------------------------------------------------------------
  var TREE_TARGET_H = 4.5;   // シーン内での木の高さ目安(m)。大きすぎ/小さすぎたらここを調整
  var treeReplaced = false;
  function useTreeModel(model) {
    if (treeReplaced) return;   // obj/glb 二重適用を防ぐ
    treeReplaced = true;
    // 法線が無いOBJは陰影が出ないので補う
    model.traverse(function (o) {
      if (o.isMesh && o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    });
    var box = new THREE.Box3().setFromObject(model);
    var size = new THREE.Vector3(); box.getSize(size);
    var norm = TREE_TARGET_H / (size.y || 1);   // 元の高さを目標高さに合わせる倍率
    treeProcedural.forEach(function (g) { scene.remove(g); });   // 手続き生成の木を撤去
    treePlacements.forEach(function (p) {
      var m = model.clone(true);
      var s = norm * p.scale;
      m.scale.setScalar(s);
      m.position.set(p.x, -box.min.y * s, p.z);   // 足元を地面(y=0)に合わせる
      m.rotation.y = rand(0, Math.PI * 2);
      m.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(m);
    });
  }
  (function loadTreeModel() {
    // OBJ（+MTLで色付け）を優先。Quaternius などはこの形式
    if (typeof THREE.OBJLoader !== "undefined") {
      var loadObj = function (materials) {
        var obj = new THREE.OBJLoader();
        if (materials) obj.setMaterials(materials);
        obj.setPath("asset/model/");
        obj.load("tree.obj", function (o) { useTreeModel(o); }, undefined, function () {});
      };
      if (typeof THREE.MTLLoader !== "undefined") {
        var mtl = new THREE.MTLLoader();
        mtl.setPath("asset/model/");
        mtl.load("tree.mtl", function (materials) { materials.preload(); loadObj(materials); },
          undefined, function () { loadObj(null); });   // mtl無し→obj単体
      } else {
        loadObj(null);
      }
    }
    // glb も置いてあれば試す（任意）
    if (typeof THREE.GLTFLoader !== "undefined") {
      new THREE.GLTFLoader().load("asset/model/tree.glb", function (gltf) { useTreeModel(gltf.scene); },
        undefined, function () {});
    }
  })();

  // ---------------------------------------------------------------
  // 【お試し】ポンプ室の3Dモデル読み込み（asset/model/building.glb があれば表示）
  //   ・無ければ何も出ない（壊れない）。まずは見た目確認用
  //   ・位置/大きさ/向きは下の定数で調整。Meshy等の高ポリゴンは重い場合あり
  //   ・既存のコード製建物とは別の場所(西側)に置いて見比べられるようにしている
  // ---------------------------------------------------------------
  var BUILDING_POS = { x: -48, y: 0, z: 16 };  // 敷地の西側。F(浮遊)で見に行ける
  var BUILDING_TARGET_H = 9;                   // 高さの目安(m)。大小はここで調整
  var BUILDING_ROT_Y = 0;                      // 向き(ラジアン)。裏向きなら Math.PI 等
  (function loadBuildingModel() {
    if (typeof THREE.GLTFLoader === "undefined") return;
    new THREE.GLTFLoader().load("asset/model/building.glb", function (gltf) {
      var model = gltf.scene;
      var box = new THREE.Box3().setFromObject(model);
      var size = new THREE.Vector3(); box.getSize(size);
      var s = BUILDING_TARGET_H / (size.y || 1);
      model.scale.setScalar(s);
      box.setFromObject(model);
      var center = new THREE.Vector3(); box.getCenter(center);
      model.position.set(-center.x, -box.min.y, -center.z);  // 原点に中心・足元をy=0へ
      var wrap = new THREE.Group();
      wrap.add(model);
      wrap.position.set(BUILDING_POS.x, BUILDING_POS.y, BUILDING_POS.z);
      wrap.rotation.y = BUILDING_ROT_Y;
      model.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(wrap);
    }, undefined, function () { /* 無ければ何もしない */ });
  })();

  for (var bi = 0; bi < 30; bi++) {
    var bx2 = rand(-24, 40), bz2 = rand(-29, 56);
    if (!blockedForProp(bx2, bz2)) addBush(bx2, bz2);
  }
  for (var rk = 0; rk < 12; rk++) {
    var rx = rand(-22, 34), rz = rand(-28, 46);
    if (!blockedForProp(rx, rz)) addRock(rx, rz);
  }
  // 敷地内は草を濃く（広い前庭 z:-29..44 を含む）
  for (var gt = 0; gt < 420; gt++) {
    var gx = rand(-24, 40), gz = rand(-29, 44);
    if (!blockedForGrass(gx, gz)) addGrassTuft(gx, gz);
  }
  // 敷地外まばら
  for (var gt2 = 0; gt2 < 50; gt2++) {
    var gx2 = rand(-48, 56), gz2 = rand(-30, 60);
    if (gx2 > -27 && gx2 < 43 && gz2 > -31 && gz2 < 51) continue;
    if (!blockedForGrass(gx2, gz2)) addGrassTuft(gx2, gz2);
  }

  // ---------------------------------------------------------------
  // 広告: 動画3面 + 静止画3面（北側の広告プラザに横並び）
  //   追加素材は asset/ に以下の名前で置く（無ければ「準備中」表示）:
  //     動画  : ad-movie-2.mp4 , ad-movie-3.mp4
  //     静止画: ad-image-2.png , ad-image-3.png
  // ---------------------------------------------------------------
  var VIDEO_FILES = [
    "asset/ad-movie-1.mp4",
    "asset/ad-movie-2.mp4",
    "asset/ad-movie-3.mp4"
  ];
  var IMAGE_FILES = [
    "asset/exemate.png",
    "asset/ad-image-2.png",
    "asset/ad-image-3.png"
  ];

  var adVideos = [];
  var adMuted = true;

  function makeAdPlaceholderTexture(title, sub) {
    var c = makeCanvas(512, 288);
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, 0, 288);
    g.addColorStop(0, "#1c2530"); g.addColorStop(1, "#0f1620");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 288);
    ctx.strokeStyle = "rgba(200,162,74,0.55)"; ctx.lineWidth = 6; ctx.setLineDash([14, 10]);
    ctx.strokeRect(16, 16, 480, 256); ctx.setLineDash([]);
    ctx.fillStyle = "#c8a24a"; ctx.textAlign = "center";
    ctx.font = "bold 40px 'Hiragino Kaku Gothic ProN',sans-serif";
    ctx.fillText(title, 256, 130);
    ctx.fillStyle = "#8fa0ac"; ctx.font = "22px 'Hiragino Kaku Gothic ProN',sans-serif";
    ctx.fillText(sub, 256, 180);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  function makeVideoScreenMat(src, idx) {
    var mat = new THREE.MeshBasicMaterial({ map: makeAdPlaceholderTexture("動画広告 " + (idx + 1), "AD MOVIE — 準備中") });
    var v = document.createElement("video");
    v.src = encodeURI(src);
    v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute("playsinline", ""); v.preload = "auto"; v.crossOrigin = "anonymous";
    var vtex = new THREE.VideoTexture(v);
    vtex.minFilter = THREE.LinearFilter; vtex.magFilter = THREE.LinearFilter; vtex.encoding = THREE.sRGBEncoding;
    v.addEventListener("loadeddata", function () { mat.map = vtex; mat.needsUpdate = true; });
    adVideos.push(v);
    return mat;
  }
  function makeImageScreenMat(src, idx) {
    var mat = new THREE.MeshBasicMaterial({ map: makeAdPlaceholderTexture("静止画広告 " + (idx + 1), "AD IMAGE — 準備中") });
    new THREE.TextureLoader().load(src, function (t) {
      t.encoding = THREE.sRGBEncoding; mat.map = t; mat.needsUpdate = true;
    }, undefined, function () { /* 失敗時はプレースホルダのまま */ });
    return mat;
  }

  function tryPlayVideo() {
    adVideos.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () { }); });
  }
  function setAdMuted(m) { adVideos.forEach(function (v) { v.muted = m; }); }

  function addMonitor(x, z, rotY, w, h, screenMat, label) {
    var group = new THREE.Group();
    var legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.7, metalness: 0.3 });
    var legGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.2, 10);
    var l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-w * 0.32, 1.1, 0); group.add(l1);
    var l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(w * 0.32, 1.1, 0); group.add(l2);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5, metalness: 0.4 }));
    frame.position.set(0, 2.2 + h / 2, 0); group.add(frame);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.set(0, 2.2 + h / 2, 0.17);
    screen.userData.shadow = "none";
    group.add(screen);
    if (label) {
      var lc = makeCanvas(512, 96); var lx = lc.getContext("2d");
      lx.fillStyle = "#c8a24a"; lx.fillRect(0, 0, 512, 96);
      lx.fillStyle = "#1a1206"; lx.font = "bold 44px 'Hiragino Kaku Gothic ProN',sans-serif";
      lx.textAlign = "center"; lx.textBaseline = "middle"; lx.fillText(label, 256, 50);
      var lt = new THREE.CanvasTexture(lc); lt.encoding = THREE.sRGBEncoding;
      var band = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, 0.7), new THREE.MeshBasicMaterial({ map: lt }));
      band.position.set(0, 2.2 + h + 0.55, 0.17);
      band.userData.shadow = "none";
      group.add(band);
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
    // 支柱は板の裏側(-z)へ寄せて前面へのめり込みを防ぐ
    var p1 = new THREE.Mesh(postGeo, postMat); p1.position.set(-1.1, 1.4, -0.22); group.add(p1);
    var p2 = new THREE.Mesh(postGeo, postMat); p2.position.set(1.1, 1.4, -0.22); group.add(p2);
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

  // 正面の広い前庭に広告を左右で配置（通路を挟んで動画3面＝左 / 静止画3面＝右）。
  // 通路を歩くと自然に目に入る「広告アベニュー」。間隔を広く取り窮屈感をなくす。
  var AD_W = 5, AD_H = 2.9;
  var AD_ZS = [-6, -14, -22];    // 前庭 z（ゆったり配置）
  var AD_LX = -12, AD_RX = 13;   // 左右の列（通路 x≈0.9 から離す）
  for (var av = 0; av < 3; av++) {
    addMonitor(AD_LX, AD_ZS[av], Math.PI / 2, AD_W, AD_H, makeVideoScreenMat(VIDEO_FILES[av], av), "動画広告 " + (av + 1));
  }
  for (var ai = 0; ai < 3; ai++) {
    addMonitor(AD_RX, AD_ZS[ai], -Math.PI / 2, AD_W, AD_H, makeImageScreenMat(IMAGE_FILES[ai], ai), "静止画広告 " + (ai + 1));
  }

  addSignboard(20, -24, -Math.PI / 2, ["PROJECT", "遠賀川水源地ポンプ室", "メタバース保存プロジェクト", "プロトタイプ v1.0"], "#6c3483");

  // ---------------------------------------------------------------
  // 影の一括設定
  // ---------------------------------------------------------------
  scene.traverse(function (o) {
    if (!o.isMesh) return;
    var m = o.userData.shadow;
    if (m === "none") { o.castShadow = false; o.receiveShadow = false; }
    else if (m === "receive") { o.castShadow = false; o.receiveShadow = true; }
    else { o.castShadow = true; o.receiveShadow = true; }
  });

  // ---------------------------------------------------------------
  // 操作系
  // ---------------------------------------------------------------
  camera.position.set(0.9, 1.7, -27);
  camera.rotation.y = Math.PI;

  var controls = new THREE.PointerLockControls(camera, document.body);
  scene.add(controls.getObject());
  var overlay = document.getElementById("overlay");
  var crosshair = document.getElementById("crosshair");
  var hud = document.getElementById("hud");
  var titleBadge = document.getElementById("title-badge");
  var aimHint = document.getElementById("aim-hint");
  var brickDialog = document.getElementById("brick-dialog");
  var guide = document.getElementById("controls-guide");
  var flyBadge = document.getElementById("fly-badge");

  // タッチ端末判定 & スマホ用の入力状態
  var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  var mobileActive = false;
  var joy = { active: false, x: 0, y: 0 };   // x:右+ / y:前+（アナログ）
  var touchRun = false;
  var lookEuler = new THREE.Euler(0, Math.PI, 0, "YXZ");
  var LOOK_SENS = 0.0042, PITCH_MAX = Math.PI / 2 - 0.05;
  var layoutEditMode = false;          // ⚙️配置変更モード中は視点操作を止める
  var applySavedLayout = function () { };  // setupSettings が実体を入れる
  // PCは設定を開く間だけポインターロックを外す（ロック中はカーソルが無く⚙を押せないため）。
  // この解除では「クリックしてスタート」のオーバーレイを出さないので、その区別に使う。
  var settingsMode = false;
  var toggleSettingsPanel = function () { };  // setupSettings が実体を入れる

  function active() { return controls.isLocked || mobileActive; }
  function updateFlyBadge() { flyBadge.style.display = (flyMode && active()) ? "block" : "none"; }

  // ⚙️ボタンはタイトルバッジの実高を測って真下に置く（機種・文字サイズで折り返すため）
  // パネルは画面内に収まる高さに制限し、あふれたらスクロールさせる。
  // 横向きスマホは CSS 高さが 300px 程度しかなく、ボタンの下に置くと入り切らないので
  // その場合は画面上端から使う。
  // 画面の高さは端末・ブラウザで3つの値が食い違う:
  //   documentElement.clientHeight … レイアウトビューポート（position:fixed の基準はこれ）
  //   visualViewport.height        … 実際に見えている領域（アドレスバー・ピンチで変わる）
  //   innerHeight                  … その中間で、chrome を含むことがある
  // fixed 配置の要素の高さを別の基準で決めると、画面外にはみ出したまま中身だけ
  // スクロールする（＝最後までスクロールしても見えない）ので、最小値を採って必ず収める。
  function viewportH() {
    var h = window.innerHeight;
    var de = document.documentElement;
    if (de && de.clientHeight) h = Math.min(h, de.clientHeight);
    var vv = window.visualViewport;
    if (vv && vv.height) h = Math.min(h, vv.height);
    return h;
  }
  function viewportW() {
    var w = window.innerWidth;
    var de = document.documentElement;
    if (de && de.clientWidth) w = Math.min(w, de.clientWidth);
    var vv = window.visualViewport;
    if (vv && vv.width) w = Math.min(w, vv.width);
    return w;
  }
  function placeSettingsBtn() {
    var btn = document.getElementById("settings-btn");
    var panel = document.getElementById("settings-panel");
    var r = titleBadge.getBoundingClientRect();
    var top = (r.height ? r.bottom : 58) + 10;
    btn.style.top = top + "px";

    var H = viewportH();
    var narrow = H < 460;
    var pTop = narrow ? 8 : top + 52;
    panel.style.top = pTop + "px";
    // 横向きは⚙の真下に置けないぶん、⚙を覆って閉じられなくならないよう左隣にずらす
    panel.style.right = narrow ? "68px" : "14px";
    panel.style.maxHeight = Math.max(120, H - pTop - 12) + "px";
  }
  // Android は回転時の resize が「回転前の古いサイズ」のまま飛んでくることがあり、
  // その1回を信じて計算すると、横向きなのに縦向きの高さで組んでしまう。
  // そこで resize イベントに頼らず、毎フレーム実寸を見て“変わったら組み直す”。
  // （縦横比が変わるのはユーザー操作の一瞬だけなので、比較のコストは無視できる）
  var reflowUI = function () { };   // setupSettings が実体を入れる
  var lastVW = 0, lastVH = 0;
  function watchViewport() {
    var w = viewportW(), h = viewportH();
    if (w === lastVW && h === lastVH) return;
    lastVW = w; lastVH = h;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    reflowUI();
  }

  if (isTouch) {
    var kd = document.getElementById("keys-desktop");
    var km = document.getElementById("keys-mobile");
    if (kd) kd.style.display = "none";
    if (km) km.style.display = "block";
    var sb = document.getElementById("start-btn");
    if (sb) sb.textContent = "タップしてスタート";
  } else {
    // PCは⚙をクリックできない（ロック中はカーソルが無い）ので O キーで開く。
    // 「操作方法」の現在値もPC向けの表記にする。
    var imt = document.getElementById("im-touch");
    if (imt) imt.textContent = "マウス＋キーボード";
    var sbtn = document.getElementById("settings-btn");
    if (sbtn) sbtn.title = "設定（O キー）";
  }

  function startMobile() {
    if (mobileActive) return;
    mobileActive = true;
    camera.rotation.order = "YXZ";
    lookEuler.setFromQuaternion(camera.quaternion, "YXZ");
    overlay.style.display = "none";
    crosshair.style.display = "none";
    hud.style.display = "none";
    titleBadge.style.display = "block";
    guide.style.display = "none";
    document.getElementById("touch-ui").style.display = "block";
    document.getElementById("look-layer").style.display = "block";
    document.getElementById("settings-btn").style.display = "flex";
    document.body.classList.add("mobile");
    flyBadge.textContent = "✈ 浮遊モード ON";   // キー説明はスマホでは不要
    placeSettingsBtn();
    applySavedLayout();   // 保存済みのコントローラー配置を反映
    updateFlyBadge();
    tryPlayVideo();
  }

  overlay.addEventListener("click", function () {
    if (isTouch) { startMobile(); tryPlayVideo(); }
    else { controls.lock(); tryPlayVideo(); }
  });
  controls.addEventListener("lock", function () {
    settingsMode = false;
    overlay.style.display = "none"; crosshair.style.display = "block";
    hud.style.display = "block"; titleBadge.style.display = "block";
    guide.style.display = "block";
    document.getElementById("settings-btn").style.display = "flex";
    placeSettingsBtn();
    updateFlyBadge();
    tryPlayVideo();
  });
  controls.addEventListener("unlock", function () {
    // 設定を開くための解除なら、オーバーレイは出さずに画面をそのまま見せておく
    if (settingsMode) { crosshair.style.display = "none"; aimHint.style.display = "none"; return; }
    document.getElementById("settings-btn").style.display = "none";
    overlay.style.display = "flex"; crosshair.style.display = "none";
    hud.style.display = "none"; titleBadge.style.display = "none";
    guide.style.display = "none";
    aimHint.style.display = "none";
    flyBadge.style.display = "none";
    closeBrickDialog();
  });

  var keys = {};
  window.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyM") { adMuted = !adMuted; setAdMuted(adMuted); tryPlayVideo(); }
    if (e.code === "KeyQ") closeBrickDialog();
    if (e.code === "KeyF" && !e.repeat) { flyMode = !flyMode; velY = 0; updateFlyBadge(); }
    if (e.code === "KeyO" && !e.repeat && !isTouch) toggleSettingsPanel();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("wheel", function (e) {
    camera.fov = clamp(camera.fov + e.deltaY * 0.02, 12, 75);
    camera.updateProjectionMatrix();
  }, { passive: true });

  var colliders = [
    { minX: -TOTAL_W / 2 - 0.6, maxX: TOTAL_W / 2 + 0.6, minZ: -0.6, maxZ: BUILD_LEN + 0.6 },
    { minX: 11.4, maxX: 31.1, minZ: -0.1, maxZ: 36.1 },    // 貯水池+フェンス
    { minX: 18.2, maxX: 21.8, minZ: 37.7, maxZ: 41.3 },    // 水タンク
    { minX: -12.4, maxX: -11.6, minZ: -24, maxZ: -4 },     // 前庭 左（動画）広告列
    { minX: 12.6, maxX: 13.4, minZ: -24, maxZ: -4 },       // 前庭 右（静止画）広告列
    // 敷地フェンス（門 x -1..4 は通行可）
    { minX: SITE.minX - 0.2, maxX: SITE.gateX0, minZ: SITE.minZ - 0.25, maxZ: SITE.minZ + 0.25 },
    { minX: SITE.gateX1, maxX: SITE.maxX + 0.2, minZ: SITE.minZ - 0.25, maxZ: SITE.minZ + 0.25 },
    { minX: SITE.minX - 0.2, maxX: SITE.maxX + 0.2, minZ: SITE.maxZ - 0.25, maxZ: SITE.maxZ + 0.25 },
    { minX: SITE.minX - 0.25, maxX: SITE.minX + 0.25, minZ: SITE.minZ, maxZ: SITE.maxZ },
    { minX: SITE.maxX - 0.25, maxX: SITE.maxX + 0.25, minZ: SITE.minZ, maxZ: SITE.maxZ }
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
  var velY = 0, onGround = true, bobT = 0, flyMode = false;
  var forwardV = new THREE.Vector3(), rightV = new THREE.Vector3();
  var clock = new THREE.Clock();

  function updateMovement(dt) {
    var obj = controls.getObject();
    var moveZ = 0, moveX = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) moveZ += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) moveZ -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) moveX += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) moveX -= 1;
    if (joy.active) { moveX += joy.x; moveZ += joy.y; }
    var mag = Math.hypot(moveX, moveZ);
    var moving = mag > 0.12;              // スティックのデッドゾーン
    var analog = Math.min(mag, 1);        // 傾き量で速度を可変（キーは常に1）

    if (flyMode) {
      // 浮遊モード: 重力なし・XZは視線方向、上下は Space / Shift。コライダー無視で自由に。
      var fspeed = (keys["ControlLeft"] || keys["KeyC"]) ? 22 : 11;
      if (moving) {
        moveX /= mag; moveZ /= mag;
        camera.getWorldDirection(forwardV);
        forwardV.y = 0; forwardV.normalize();
        rightV.set(-forwardV.z, 0, forwardV.x);
        obj.position.x += (forwardV.x * moveZ + rightV.x * moveX) * fspeed * analog * dt;
        obj.position.z += (forwardV.z * moveZ + rightV.z * moveX) * fspeed * analog * dt;
      }
      var up = 0;
      if (keys["Space"]) up += 1;
      if (keys["ShiftLeft"] || keys["ShiftRight"]) up -= 1;
      obj.position.y += up * fspeed * dt;
      obj.position.x = clamp(obj.position.x, -80, 80);
      obj.position.z = clamp(obj.position.z, -80, 80);
      obj.position.y = clamp(obj.position.y, 0.6, 70);
      velY = 0; onGround = false;
      return;
    }

    var speed = (keys["ShiftLeft"] || keys["ShiftRight"]) ? 11 : 5.8;
    if (moving) {
      moveX /= mag; moveZ /= mag;
      camera.getWorldDirection(forwardV);
      forwardV.y = 0; forwardV.normalize();
      rightV.set(-forwardV.z, 0, forwardV.x);
      var dx = (forwardV.x * moveZ + rightV.x * moveX) * speed * analog * dt;
      var dz = (forwardV.z * moveZ + rightV.z * moveX) * speed * analog * dt;
      var candX = obj.position.x + dx, candZ = obj.position.z + dz;
      if (!collides(candX, obj.position.z)) obj.position.x = candX;
      if (!collides(obj.position.x, candZ)) obj.position.z = candZ;
      obj.position.x = clamp(obj.position.x, -80, 80);
      obj.position.z = clamp(obj.position.z, -80, 80);
    }

    if (keys["Space"] && onGround) { velY = JUMP_V; onGround = false; }
    velY += GRAVITY * dt;
    var groundY = EYE + (moving && onGround ? Math.sin(bobT += dt * (speed > 8 ? 14 : 9)) * 0.045 : 0);
    obj.position.y += velY * dt;
    if (obj.position.y <= groundY) { obj.position.y = groundY; velY = 0; onGround = true; }
  }

  // ---------------------------------------------------------------
  // レンガ選択
  // ---------------------------------------------------------------
  var raycaster = new THREE.Raycaster();
  var centerNDC = new THREE.Vector2(0, 0);
  var highlight = new THREE.Mesh(
    new THREE.PlaneGeometry(BRICK_W_M - 0.03, BRICK_H_M - 0.03),
    new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthTest: false })
  );
  highlight.visible = false;
  highlight.renderOrder = 5;
  highlight.userData.shadow = "none";
  scene.add(highlight);

  var aimBrick = null;

  // 指定NDC座標のレイキャストで当たったレンガ情報を返す（無ければ null）
  function pickBrick(ndc, maxDist) {
    maxDist = maxDist || 9;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObject(wallBox);
    if (!hits.length || hits[0].distance > maxDist || !hits[0].uv || !hits[0].face) return null;
    var h = hits[0];
    var info = wallFaceInfo[h.face.materialIndex];
    if (!info) return null;

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
    return { key: key, donor: donor, label: info.label + "-" + r + "-" + k, pos: pos, rotY: info.rotY };
  }

  function updateAim() {
    aimBrick = pickBrick(centerNDC);
    if (!aimBrick) {
      highlight.visible = false;
      aimHint.style.display = "none";
      return;
    }
    var donor = aimBrick.donor;
    highlight.position.copy(aimBrick.pos);
    highlight.rotation.set(0, aimBrick.rotY, 0);
    highlight.material.color.set(donor ? 0xffd54a : 0xbfd8ff);
    highlight.visible = true;
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
      rows.innerHTML = rowHTML("刻印番号", ab.label) + rowHTML("状態", "刻印の受付が可能です");
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
  // スマホ用タッチ操作（スティック / 視点ドラッグ / ピンチ / タップ / ボタン）
  // ---------------------------------------------------------------
  (function setupTouch() {
    // --- 移動スティック（右下） ---
    var joyBase = document.getElementById("joystick");
    var joyKnob = document.getElementById("joy-knob");
    var joyId = null, joyCX = 0, joyCY = 0;
    var JOY_R = 52;
    function joyUpdate(t) {
      var dx = t.clientX - joyCX, dy = t.clientY - joyCY;
      var len = Math.hypot(dx, dy);
      var cl = Math.min(len, JOY_R);
      var ang = Math.atan2(dy, dx);
      var kx = (len > 0.0001 ? Math.cos(ang) : 0) * cl;
      var ky = (len > 0.0001 ? Math.sin(ang) : 0) * cl;
      joyKnob.style.transform = "translate(calc(-50% + " + kx.toFixed(1) + "px), calc(-50% + " + ky.toFixed(1) + "px))";
      joy.active = true;
      joy.x = kx / JOY_R;   // 右+
      joy.y = -ky / JOY_R;  // 上ドラッグ=前+
    }
    function joyReset() {
      joyId = null; joy.active = false; joy.x = 0; joy.y = 0;
      joyKnob.style.transform = "translate(-50%,-50%)";
    }
    joyBase.addEventListener("touchstart", function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      joyId = t.identifier;
      var rect = joyBase.getBoundingClientRect();
      joyCX = rect.left + rect.width / 2;
      joyCY = rect.top + rect.height / 2;
      joyUpdate(t);
    }, { passive: false });
    joyBase.addEventListener("touchmove", function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++)
        if (e.changedTouches[i].identifier === joyId) joyUpdate(e.changedTouches[i]);
    }, { passive: false });
    function joyEnd(e) {
      for (var i = 0; i < e.changedTouches.length; i++)
        if (e.changedTouches[i].identifier === joyId) joyReset();
    }
    joyBase.addEventListener("touchend", joyEnd);
    joyBase.addEventListener("touchcancel", joyEnd);

    // --- 視点ドラッグ・ピンチ・タップ（全画面レイヤー） ---
    var lookLayer = document.getElementById("look-layer");
    var lookLast = null, pinchLast = null, tapInfo = null;
    function touchDist(ts) {
      var dx = ts[0].clientX - ts[1].clientX, dy = ts[0].clientY - ts[1].clientY;
      return Math.hypot(dx, dy);
    }
    lookLayer.addEventListener("touchstart", function (e) {
      e.preventDefault();
      if (layoutEditMode) return;
      if (e.targetTouches.length >= 2) {
        pinchLast = touchDist(e.targetTouches); lookLast = null; tapInfo = null;
      } else {
        var t = e.targetTouches[0];
        lookLast = { x: t.clientX, y: t.clientY };
        tapInfo = { x: t.clientX, y: t.clientY, t: performance.now(), moved: false };
        pinchLast = null;
      }
    }, { passive: false });
    lookLayer.addEventListener("touchmove", function (e) {
      e.preventDefault();
      if (layoutEditMode) return;
      if (e.targetTouches.length >= 2) {
        var d = touchDist(e.targetTouches);
        if (pinchLast != null) {
          camera.fov = clamp(camera.fov - (d - pinchLast) * 0.08, 12, 75);
          camera.updateProjectionMatrix();
        }
        pinchLast = d; lookLast = null; tapInfo = null;
        return;
      }
      var t = e.targetTouches[0];
      if (lookLast) {
        // タップ判定中（まだ動いていない）は、しきい値を超えるまで視点を動かさない。
        // これで「軽くタップ」しても視点がブレず、選択がキャンセルされない。
        if (tapInfo && !tapInfo.moved) {
          if (Math.abs(t.clientX - tapInfo.x) > 14 || Math.abs(t.clientY - tapInfo.y) > 14) {
            tapInfo.moved = true;
            lookLast = { x: t.clientX, y: t.clientY };  // ドラッグ開始点をここに
          }
          return;
        }
        var dx = t.clientX - lookLast.x, dy = t.clientY - lookLast.y;
        // フリック（景色をつかんで動かす）操作: 指の向きと逆に視点が回る
        lookEuler.y += dx * LOOK_SENS;
        lookEuler.x = clamp(lookEuler.x + dy * LOOK_SENS, -PITCH_MAX, PITCH_MAX);
        camera.quaternion.setFromEuler(lookEuler);
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }, { passive: false });
    lookLayer.addEventListener("touchend", function (e) {
      e.preventDefault();
      if (e.targetTouches.length === 0) {
        if (tapInfo && !tapInfo.moved && performance.now() - tapInfo.t < 500) tapSelect(tapInfo.x, tapInfo.y);
        lookLast = null; pinchLast = null; tapInfo = null;
      } else {
        var t = e.targetTouches[0];
        lookLast = { x: t.clientX, y: t.clientY }; pinchLast = null; tapInfo = null;
      }
    }, { passive: false });

    function tapSelect(cx, cy) {
      tryPlayVideo();
      var ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      var ab = pickBrick(ndc, 26);   // タップは離れた壁でも拾えるよう距離を広げる
      if (ab) openBrickDialog(ab);
      else if (dialogOpen) closeBrickDialog();
    }

    // --- アクションボタン ---
    var tbJump = document.getElementById("tb-jump");
    var tbDown = document.getElementById("tb-down");
    var tbRun = document.getElementById("tb-run");
    var tbFly = document.getElementById("tb-fly");
    var tbMute = document.getElementById("tb-mute");

    function bindHold(el, code) {
      el.addEventListener("touchstart", function (e) { e.preventDefault(); e.stopPropagation(); keys[code] = true; }, { passive: false });
      var up = function (e) { e.preventDefault(); keys[code] = false; };
      el.addEventListener("touchend", up, { passive: false });
      el.addEventListener("touchcancel", up, { passive: false });
    }
    bindHold(tbJump, "Space");       // 通常=ジャンプ / 浮遊=上昇
    bindHold(tbDown, "ShiftRight");  // 浮遊=下降

    tbRun.addEventListener("touchstart", function (e) {
      e.preventDefault(); e.stopPropagation();
      touchRun = !touchRun; keys["ShiftLeft"] = touchRun;
      tbRun.classList.toggle("on", touchRun);
    }, { passive: false });

    tbFly.addEventListener("touchstart", function (e) {
      e.preventDefault(); e.stopPropagation();
      flyMode = !flyMode; velY = 0; updateFlyBadge();
      if (flyMode) { touchRun = false; keys["ShiftLeft"] = false; tbRun.classList.remove("on"); }
      tbFly.classList.toggle("on", flyMode);
      tbJump.textContent = flyMode ? "上昇" : "ジャンプ";
      tbDown.style.display = flyMode ? "flex" : "none";
      tbRun.style.display = flyMode ? "none" : "flex";
      reflowUI();   // ボタンが増減して高さが変わるので画面内に収め直す
    }, { passive: false });

    tbMute.addEventListener("touchstart", function (e) {
      e.preventDefault(); e.stopPropagation();
      adMuted = !adMuted; setAdMuted(adMuted); tryPlayVideo();
      tbMute.textContent = adMuted ? "🔇" : "🔊";
    }, { passive: false });

    // --- ⚙️ 設定 / コントローラー配置 ---
    // 大画面だと既定の「左下ボタン + 右下スティック」は手が遠すぎるため、
    // プリセット or ドラッグで自由に配置でき、localStorage に保存する。
    // 「操作方法」は将来のスマホリモコン/ジェスチャーを差し込む枠だけ用意。
    (function setupSettings() {
      var settingsBtn = document.getElementById("settings-btn");
      var panel = document.getElementById("settings-panel");
      var editBar = document.getElementById("layout-edit-bar");
      var joyEl = document.getElementById("joystick");
      var btnsEl = document.getElementById("touch-buttons");
      var targets = { joystick: joyEl, buttons: btnsEl };
      var handles = { joystick: document.getElementById("dh-joystick"), buttons: document.getElementById("dh-buttons") };
      var LS_KEY = "nakamashi.layout.v1";
      var layout = null;

      function load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { return null; } }
      function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch (e) { } }

      // 画面内に収めつつ left/top で配置（既定の right/bottom 指定を打ち消す）
      // はみ出しの判定は必ず viewportW/H（fixed の基準に合わせた実寸）で行う。
      // innerWidth/Height はブラウザUIを含むことがあり、縦→横で画面外に置いてしまう。
      function setPos(el, left, top) {
        var r = el.getBoundingClientRect();
        left = clamp(left, 4, Math.max(4, viewportW() - r.width - 4));
        top = clamp(top, 4, Math.max(4, viewportH() - r.height - 4));
        el.style.left = left + "px"; el.style.top = top + "px";
        el.style.right = "auto"; el.style.bottom = "auto";
        return { left: left, top: top };
      }
      function applyLayout() {
        if (!layout) return;
        Object.keys(targets).forEach(function (k) {
          if (layout[k]) setPos(targets[k], layout[k].left, layout[k].top);
        });
      }
      function resetLayout() {
        layout = null;
        try { localStorage.removeItem(LS_KEY); } catch (e) { }
        Object.keys(targets).forEach(function (k) {
          var el = targets[k];
          el.style.left = ""; el.style.top = ""; el.style.right = ""; el.style.bottom = "";
        });
      }
      function snapshot() {
        var o = {};
        Object.keys(targets).forEach(function (k) {
          var r = targets[k].getBoundingClientRect();
          o[k] = { left: r.left, top: r.top };
        });
        return o;
      }
      applySavedLayout = function () { layout = load(); applyLayout(); };

      function preset(kind) {
        resetLayout();   // 一度既定に戻して実寸を測る
        var W = viewportW(), H = viewportH();
        var jr = joyEl.getBoundingClientRect(), br = btnsEl.getBoundingClientRect();
        var p = {};
        if (kind === "right") {
          p.joystick = { left: W - jr.width - 26, top: H - jr.height - 34 };
          p.buttons = { left: 20, top: H - br.height - 30 };
        } else if (kind === "left") {
          p.joystick = { left: 26, top: H - jr.height - 34 };
          p.buttons = { left: W - br.width - 20, top: H - br.height - 30 };
        } else if (kind === "big") {
          // 大画面向け: 中央下に左右をまとめ、両手が届く距離にする
          var cx = W / 2;
          p.joystick = { left: cx + 50, top: H - jr.height - 40 };
          p.buttons = { left: cx - 50 - br.width, top: H - br.height - 40 };
        }
        layout = p; applyLayout(); layout = snapshot(); save();
      }

      function showHandles(show) {
        Object.keys(handles).forEach(function (k) {
          var h = handles[k];
          if (!show) { h.style.display = "none"; return; }
          var r = targets[k].getBoundingClientRect();
          h.style.left = r.left + "px"; h.style.top = r.top + "px";
          h.style.width = r.width + "px"; h.style.height = r.height + "px";
          h.style.display = "block";
        });
      }
      function setEdit(on) {
        layoutEditMode = on;
        editBar.style.display = on ? "flex" : "none";
        panel.style.display = "none";
        showHandles(on);
      }

      Object.keys(handles).forEach(function (k) {
        var h = handles[k], t = targets[k];
        var sx = 0, sy = 0, ol = 0, ot = 0, dragging = false;
        h.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          try { h.setPointerCapture(e.pointerId); } catch (err) { }
          var r = t.getBoundingClientRect();
          ol = r.left; ot = r.top; sx = e.clientX; sy = e.clientY; dragging = true;
        });
        h.addEventListener("pointermove", function (e) {
          if (!dragging) return;
          e.preventDefault();
          var pos = setPos(t, ol + (e.clientX - sx), ot + (e.clientY - sy));
          h.style.left = pos.left + "px"; h.style.top = pos.top + "px";
        });
        function end() {
          if (!dragging) return;
          dragging = false;
          layout = snapshot(); save();
        }
        h.addEventListener("pointerup", end);
        h.addEventListener("pointercancel", end);
      });

      function tap(el, fn) {
        el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
      }
      function openPanel() {
        placeSettingsBtn();   // 開く直前に実寸で測る（回転直後でも確実）
        panel.style.display = "block";
      }
      function closePanel() {
        panel.style.display = "none";
        // PCで設定のために外していたロックを戻す（閉じるのクリック＝ユーザー操作なので lock 可）
        if (settingsMode) { settingsMode = false; controls.lock(); }
      }
      // PCは O キーから、スマホは⚙のタップから呼ばれる共通の入口
      toggleSettingsPanel = function () {
        if (panel.style.display === "block") { closePanel(); return; }
        if (!isTouch) {
          if (!controls.isLocked) return;   // スタート前は開かない（オーバーレイの下になる）
          settingsMode = true;
          controls.unlock();
        }
        openPanel();
      };
      tap(settingsBtn, function () {
        if (panel.style.display === "block") closePanel(); else openPanel();
      });
      tap(document.getElementById("settings-close"), closePanel);
      tap(document.getElementById("lp-right"), function () { preset("right"); });
      tap(document.getElementById("lp-left"), function () { preset("left"); });
      tap(document.getElementById("lp-big"), function () { preset("big"); });
      tap(document.getElementById("lp-reset"), function () { resetLayout(); });
      tap(document.getElementById("lp-edit"), function () { setEdit(true); });
      tap(document.getElementById("layout-done"), function () { setEdit(false); });

      // 画面サイズ/向きが変わったら画面内に収め直す
      // 画面サイズ/向きが変わったら組み直す（呼び出しは watchViewport から）
      reflowUI = function () {
        if (layout) applyLayout();
        if (layoutEditMode) showHandles(true);
        placeSettingsBtn();
      };
    })();

    // --- 😊 顔の向きで視点移動（ジェスチャー操作） ---
    // MediaPipe Face Landmarker を CDN から遅延読込（有効にした時だけ約3MB取得）。
    // 顔の回転行列 facialTransformationMatrixes から yaw/pitch を取り出す。
    // 「顔を向けた方向へ視点も飛ぶ」方式だと画面から目が離れて酔い、狙いも定まらないので、
    // 傾けている“量”を回転“速度”に変換する（正面に戻せば止まる＝画面を見たまま回せる）。
    (function setupGesture() {
      var wrap = document.getElementById("face-cam-wrap");
      var video = document.getElementById("face-cam");
      var statusEl = document.getElementById("face-status");
      var calibEl = document.getElementById("face-calib");
      var calibCount = document.getElementById("face-calib-count");
      var btn = document.getElementById("im-gesture");
      var invBtn = document.getElementById("im-gesture-invert");
      var headBtn = document.getElementById("im-gesture-head");
      var gazeBtn = document.getElementById("im-gesture-gaze");
      var subBtns = [headBtn, gazeBtn, invBtn];

      var MP_VER = "0.10.14";
      var MP_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VER;
      var MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/" +
        "face_landmarker/float16/1/face_landmarker.task";

      // モード別の調整値。head は顔の向き（ラジアン）、gaze は目の動き（0..1のスコア）で
      // 単位が違うため別々に持つ。dead=遊び / full=最高速に達する量 / yaw,pitch=最高速(rad/s)
      var TUNE = {
        head: { dead: 0.09, full: 0.30, yaw: 1.5, pitch: 0.9 },   // 約5°で反応・17°で最高速（首の負担を減らす）
        gaze: { dead: 0.15, full: 0.55, yaw: 1.3, pitch: 0.8 }
      };
      var mode = "head";
      var SMOOTH = 0.35;    // 検出値のローパス（検出が15fpsなので少し強めに追従させる）
      // 顔検出は重い。毎フレーム(60fps)走らせると 3D 描画と食い合って全体がカクつく。
      // 顔の動きは速くないので 15fps で十分。視点の回転自体は毎フレーム適用するので
      // 検出を間引いても動きは滑らかなまま。
      var DETECT_MS = 66;

      var on = false, loading = false, stream = null, lm = null;
      var token = 0;        // 準備中に OFF された非同期処理を捨てるための世代番号
      var invert = false, calibrating = false;
      var base = null;                  // 正面を向いた時の基準値
      var cur = { yaw: 0, pitch: 0 };   // 平滑化した顔の向き
      var seen = false, lastT = 0, lastVideoT = -1, lastDetect = 0;

      function setStatus(t, cls) { statusEl.textContent = t; statusEl.className = cls || ""; }

      function loadMediaPipe(cb, err) {
        if (window.__mpVision) { cb(window.__mpVision); return; }
        // ES5 のクラシックスクリプトからは import できないので module スクリプトを差し込む
        var s = document.createElement("script");
        s.type = "module";
        s.textContent =
          "import { FilesetResolver, FaceLandmarker } from '" + MP_BASE + "';\n" +
          "window.__mpVision = { FilesetResolver: FilesetResolver, FaceLandmarker: FaceLandmarker };\n" +
          "window.dispatchEvent(new Event('mp-loaded'));";
        var to = setTimeout(function () { err("読み込めませんでした（通信）"); }, 25000);
        window.addEventListener("mp-loaded", function () {
          clearTimeout(to); cb(window.__mpVision);
        }, { once: true });
        document.head.appendChild(s);
      }

      function createLandmarker(mp, cb, err) {
        mp.FilesetResolver.forVisionTasks(MP_BASE + "/wasm").then(function (fs) {
          return mp.FaceLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,             // 視線モード用（同じモデルに含まれる）
            outputFacialTransformationMatrixes: true // 顔の向きモード用
          });
        }).then(cb, function (e) { err("モデルを準備できません: " + (e && e.message ? e.message : e)); });
      }

      function startCam(cb, err) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          err("この端末ではカメラを使えません"); return;
        }
        // 顔の向きが分かれば良いので解像度は低いほど軽い（高解像度でも精度は上がらない）
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 240 }, height: { ideal: 180 }, frameRate: { ideal: 15, max: 20 } },
          audio: false
        }).then(function (st) {
          stream = st; video.srcObject = st;
          var p = video.play();
          if (p && p.catch) p.catch(function () { });
          cb();
        }, function (e) {
          err(e && e.name === "NotAllowedError" ? "カメラが許可されませんでした" : "カメラを開けません");
        });
      }

      // yaw/pitch はどちらのモードでも符号の意味を揃える:
      //   yaw +  = 左を向いた（lookEuler.y に足すと視点が左へ回る）
      //   pitch += 上を向いた
      // 4x4 列優先。R[row][col] = m[col*4+row]。第2列 = 顔の正面ベクトル（カメラ空間）
      function faceAngles(m) {
        var fx = m[8], fy = m[9], fz = m[10];
        return { yaw: Math.atan2(fx, fz), pitch: Math.asin(clamp(fy, -1, 1)) };
      }

      // 目の動きは blendshape のスコアで得られる。In=鼻側 / Out=こめかみ側なので、
      // 「本人から見て右を見る」＝ 左目In + 右目Out。
      function gazeAngles(cats) {
        var b = {};
        for (var i = 0; i < cats.length; i++) b[cats[i].categoryName] = cats[i].score;
        var right = ((b.eyeLookInLeft || 0) + (b.eyeLookOutRight || 0)) / 2;
        var left = ((b.eyeLookOutLeft || 0) + (b.eyeLookInRight || 0)) / 2;
        var up = ((b.eyeLookUpLeft || 0) + (b.eyeLookUpRight || 0)) / 2;
        var down = ((b.eyeLookDownLeft || 0) + (b.eyeLookDownRight || 0)) / 2;
        return { yaw: left - right, pitch: up - down };
      }

      // モードに応じて検出結果から yaw/pitch を取り出す（顔が写っていなければ null）
      function read(res) {
        if (!res) return null;
        if (mode === "gaze") {
          var f = res.faceBlendshapes && res.faceBlendshapes[0];
          return (f && f.categories) ? gazeAngles(f.categories) : null;
        }
        var mats = res.facialTransformationMatrixes;
        return (mats && mats.length) ? faceAngles(mats[0].data) : null;
      }

      // 遊びの外側だけ 0→1 に伸ばし、二乗で中央付近を穏やかにする
      function rate(v) {
        var t = TUNE[mode];
        var a = Math.abs(v);
        if (a <= t.dead) return 0;
        var k = Math.min((a - t.dead) / (t.full - t.dead), 1);
        return (v < 0 ? -1 : 1) * k * k;
      }

      function applyLook(dt) {
        var t = TUNE[mode];
        var ry = rate(cur.yaw - base.yaw) * t.yaw * dt * (invert ? -1 : 1);
        var rp = rate(cur.pitch - base.pitch) * t.pitch * dt;
        if (ry === 0 && rp === 0) return;
        // PCのマウス視点(PointerLockControls)やスマホのドラッグで回った分を取り込んでから足す。
        // これを省くと、他の操作で回した瞬間に顔の分だけ視点が飛ぶ。
        lookEuler.setFromQuaternion(camera.quaternion, "YXZ");
        lookEuler.y += ry;
        lookEuler.x = clamp(lookEuler.x + rp, -PITCH_MAX, PITCH_MAX);
        camera.quaternion.setFromEuler(lookEuler);
      }

      function tick() {
        if (!on) return;
        requestAnimationFrame(tick);
        var now = performance.now();
        var dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0;
        lastT = now;
        if (!lm || video.readyState < 2) return;

        // 間引き（DETECT_MS）＋ 同じ映像フレームは2度解析しない
        if (now - lastDetect >= DETECT_MS && video.currentTime !== lastVideoT) {
          lastDetect = now;
          lastVideoT = video.currentTime;
          var res = null;
          try { res = lm.detectForVideo(video, now); } catch (e) { return; }
          var a = read(res);
          if (a) {
            if (!seen) { seen = true; cur.yaw = a.yaw; cur.pitch = a.pitch; setStatus("顔を認識中", "ok"); }
            cur.yaw += (a.yaw - cur.yaw) * SMOOTH;
            cur.pitch += (a.pitch - cur.pitch) * SMOOTH;
          } else if (seen) {
            seen = false; setStatus("顔が見つかりません");
          }
        }
        // active() が false = PCで設定を開いている最中など。顔だけで勝手に回らないように
        if (seen && base && !calibrating && !layoutEditMode && active()) applyLook(dt);
      }

      // 正面を向いた状態を基準にする（人によってカメラの角度も姿勢も違うため）
      function calibrate() {
        calibrating = true;
        calibEl.firstChild.nodeValue = (mode === "gaze")
          ? "画面の中央をまっすぐ見てください" : "正面（画面の中央）を向いてください";
        calibEl.style.display = "block";
        var n = 3;
        calibCount.textContent = n;
        var iv = setInterval(function () {
          n--;
          if (n > 0) { calibCount.textContent = n; return; }
          clearInterval(iv);
          calibEl.style.display = "none";
          calibrating = false;
          base = seen ? { yaw: cur.yaw, pitch: cur.pitch } : { yaw: 0, pitch: 0 };
          setStatus((mode === "gaze") ? "視線で視点が回ります" : "顔を向けると視点が回ります", "ok");
        }, 1000);
      }

      function closeCam() {
        if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
        video.srcObject = null;
      }

      function showSubBtns(show) {
        subBtns.forEach(function (b) { b.style.display = show ? "block" : "none"; });
      }
      function setMode(m) {
        mode = m;
        headBtn.classList.toggle("on", m === "head");
        gazeBtn.classList.toggle("on", m === "gaze");
        seen = false; base = null;   // 単位が変わるので基準を取り直す
        if (on) calibrate();
      }

      function stop() {
        token++;
        on = false; loading = false; base = null; seen = false; lastT = 0; lastVideoT = -1;
        closeCam();
        wrap.style.display = "none";
        calibEl.style.display = "none";
        showSubBtns(false);
        btn.classList.remove("on");
      }

      function start() {
        if (loading || on) return;
        var my = ++token;
        function alive() { return my === token; }
        function fail(msg) {
          if (!alive()) return;
          setStatus(msg, "err");
          on = false; loading = false;
          closeCam();
          btn.classList.remove("on");
        }
        loading = true;
        btn.classList.add("on");
        wrap.style.display = "block";
        setStatus("カメラを準備中…");
        startCam(function () {
          if (!alive()) { closeCam(); return; }
          // wasm + モデルで数MB。回線次第で十数秒かかるので初回だけである旨を出す
          setStatus("認識モデルを取得中…\n（初回のみ・数MB）");
          loadMediaPipe(function (mp) {
            if (!alive()) { closeCam(); return; }
            createLandmarker(mp, function (landmarker) {
              if (!alive()) { closeCam(); return; }
              lm = landmarker; loading = false; on = true;
              showSubBtns(true);
              headBtn.classList.toggle("on", mode === "head");
              gazeBtn.classList.toggle("on", mode === "gaze");
              requestAnimationFrame(tick);
              calibrate();
            }, fail);
          }, fail);
        }, fail);
      }

      function onTap(el, fn) {
        el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
      }
      onTap(btn, function () { if (on || loading) stop(); else start(); });
      onTap(headBtn, function () { setMode("head"); });
      onTap(gazeBtn, function () { setMode("gaze"); });
      onTap(invBtn, function () {
        invert = !invert;
        invBtn.classList.toggle("on", invert);
        if (on) calibrate();   // 反転したら基準も取り直す
      });
    })();

    // --- ダイアログの閉じるボタン（スマホ） ---
    var bdClose = document.getElementById("bd-close");
    if (isTouch) bdClose.style.display = "flex";
    function doClose(e) { e.preventDefault(); e.stopPropagation(); closeBrickDialog(); }
    bdClose.addEventListener("touchstart", doClose, { passive: false });
    bdClose.addEventListener("click", doClose);
  })();

  // ---------------------------------------------------------------
  // メインループ
  // ---------------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    watchViewport();
    var dt = Math.min(clock.getDelta(), 0.05);
    if (controls.isLocked) {
      updateMovement(dt);
      updateAim();
    } else if (mobileActive) {
      updateMovement(dt);
    }
    renderer.render(scene, camera);
  }
  animate();

  // ※ resize イベントは使わない。回転直後は古い値が来るため watchViewport で実寸を監視する。
})();

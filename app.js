/* 遠賀川水源地ポンプ室 メタバース保存プロジェクト — プロトタイプ v0.2
   Three.js r128 (classic global build) + PointerLockControls
   追加: ジャンプ / 木・草・小物でリアル化 / レンガ拡大 / 署名をレンガ内に収める
        / 動画モニター(mp4) / 静止画看板(exemate.png) / 大型モニター
*/

(function () {
  "use strict";

  // ---------------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------------
  function rand(min, max) { return min + Math.random() * (max - min); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hsl(h, s, l) { return "hsl(" + Math.round(h) + "," + Math.max(0, Math.round(s)) + "%," + clamp(Math.round(l), 0, 100) + "%)"; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function makeCanvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  // 寄付者名/メッセージのプレースホルダー（すべて仮の汎用テキスト・短め）
  var NAME_POOL = [
    "田中", "鈴木", "YAMADA", "佐藤家", "感謝", "STUDIO K",
    "N.K.", "夢を", "SAKURA", "2026", "○○工業", "がんばれ",
    "T.M.", "みらい", "HOPE", "つながる", "FRIEND", "MEMBER",
    "遠賀川", "水源地", "K.S.", "応援", "THANKS", "刻印",
    "中間市", "ありがとう", "未来へ", "A.Y.", "GOOD", "1919"
  ];

  // ---------------------------------------------------------------
  // レンガ格子パラメータ（大きめのレンガ）
  // ---------------------------------------------------------------
  var PX_PER_M = 110;
  var BRICK_W_M = 0.42;   // レンガ長さ（拡大）
  var BRICK_H_M = 0.16;   // レンガ高さ（拡大）
  var MORTAR_M = 0.022;

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
      ctx.beginPath(); ctx.arc(cx, cy, r + w * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "#c9b48f"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = "#33454e"; ctx.fill();
      ctx.strokeStyle = "rgba(210,222,226,0.55)";
      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy); ctx.lineTo(cx + r * 0.8, cy);
      ctx.moveTo(cx, cy - r * 0.8); ctx.lineTo(cx, cy + r * 0.8);
      ctx.stroke();
    } else {
      var pad = w * 0.12;
      archPath(ctx, x - pad, y - pad * 0.6, w + pad * 2, h + pad * 1.4);
      ctx.fillStyle = style === "door" ? "#5a4632" : "#c9b48f";
      ctx.fill();
      archPath(ctx, x, y, w, h);
      ctx.fillStyle = style === "door" ? "#20160e" : "#33454e";
      ctx.fill();
      if (style === "door") {
        ctx.fillStyle = "#150e07";
        ctx.fillRect(x + w * 0.38, y + h * 0.26, w * 0.24, h * 0.56);
        ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = Math.max(1, w * 0.02);
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.1); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(210,222,226,0.5)";
        ctx.lineWidth = Math.max(1, w * 0.035);
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
        ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // レンガ壁テクスチャ（レンガ格子に沿って署名を1枚ずつ収める）
  // ---------------------------------------------------------------
  function makeBrickWallTexture(opts) {
    var cw = Math.min(4096, Math.round(opts.realW * PX_PER_M));
    var ch = Math.min(2048, Math.round(opts.realH * PX_PER_M));
    var canvas = makeCanvas(cw, ch);
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#3f3830";
    ctx.fillRect(0, 0, cw, ch);

    var brickW = BRICK_W_M * PX_PER_M;
    var brickH = BRICK_H_M * PX_PER_M;
    var mortar = Math.max(1, MORTAR_M * PX_PER_M);
    var windows = opts.windows || [];
    var door = opts.door || null;

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

    // レンガ本体 + 同じ格子上に署名を配置
    var nameProb = opts.nameProb || 0;
    var rows = Math.ceil(ch / brickH) + 1;
    for (var r = 0; r < rows; r++) {
      var y = ch - (r + 1) * brickH;
      var offset = (r % 2 === 0) ? 0 : brickW / 2;
      var x = -offset;
      while (x < cw) {
        var bw = brickW - mortar, bh = brickH - mortar;
        var p = Math.random(), color;
        if (p < 0.5) color = hsl(11 + rand(-6, 6), 44 + rand(-8, 8), 33 + rand(-7, 10));
        else if (p < 0.72) color = hsl(30 + rand(-8, 8), 22 + rand(-6, 10), 60 + rand(-10, 12));
        else if (p < 0.88) color = hsl(18 + rand(-6, 6), 16 + rand(-5, 5), 22 + rand(-6, 6));
        else color = hsl(38, 14, 76);
        ctx.fillStyle = color;
        ctx.fillRect(x + mortar / 2, y + mortar / 2, bw, bh);
        // レンガ内の陰影
        ctx.fillStyle = "rgba(0,0,0,0.10)";
        ctx.fillRect(x + mortar / 2, y + bh * 0.72, bw, bh * 0.28);

        // 署名（このレンガの中央に、収まるサイズで）
        var bcx = x + brickW / 2, bcy = y + brickH / 2;
        if (Math.random() < nameProb && bcx > brickW && bcx < cw - brickW && !isOverOpening(bcx, bcy)) {
          drawSignatureInBrick(ctx, bcx, bcy, bw, bh, choice(NAME_POOL));
        }
        x += brickW;
      }
    }

    // 蔦の緑シミ
    var ivyN = opts.ivyDensity || 0;
    for (var i = 0; i < ivyN; i++) {
      var bx = rand(0, cw);
      var by = Math.random() < 0.5 ? rand(0, ch * 0.4) : rand(ch * 0.6, ch);
      var rad = rand(ch * 0.06, ch * 0.24);
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
      var a = rand(0.35, 0.62);
      g.addColorStop(0, "rgba(46,82,36," + a + ")");
      g.addColorStop(0.6, "rgba(56,96,42," + (a * 0.5) + ")");
      g.addColorStop(1, "rgba(56,96,42,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
    }

    // 窓・扉（署名の上に描いて塞ぐ）
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
    tex.needsUpdate = true;
    return tex;
  }

  // 1つのレンガ内に確実に収まる署名（彫り込み風）
  function drawSignatureInBrick(ctx, cx, cy, bw, bh, txt) {
    var maxW = bw * 0.84;
    var fs = bh * 0.62;
    ctx.save();
    ctx.font = "700 " + fs.toFixed(1) + "px \"Hiragino Kaku Gothic ProN\",\"Yu Gothic\",\"Meiryo\",sans-serif";
    var w = ctx.measureText(txt).width;
    if (w > maxW) {
      fs *= maxW / w;
      ctx.font = "700 " + fs.toFixed(1) + "px \"Hiragino Kaku Gothic ProN\",\"Yu Gothic\",\"Meiryo\",sans-serif";
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 彫り込み: 暗い影 + 明るいハイライト
    ctx.fillStyle = "rgba(20,13,8,0.6)";
    ctx.fillText(txt, cx + 1, cy + 1.2);
    ctx.fillStyle = "rgba(232,222,202,0.5)";
    ctx.fillText(txt, cx - 0.6, cy - 0.6);
    ctx.restore();
  }

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
      var x = Math.random() * 512, y = Math.random() * 512;
      var l = 28 + Math.random() * 26;
      ctx.fillStyle = "hsl(" + (88 + rand(-16, 16)) + "," + (34 + rand(-10, 10)) + "%," + l + "%)";
      ctx.fillRect(x, y, 2, 2);
    }
    // 土のムラ
    for (var k = 0; k < 40; k++) {
      var bx = Math.random() * 512, by = Math.random() * 512, rr = rand(20, 70);
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      g.addColorStop(0, "rgba(90,72,45,0.35)"); g.addColorStop(1, "rgba(90,72,45,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    tex.anisotropy = 8;
    return tex;
  }

  function makeGrassBladeTexture() {
    var c = makeCanvas(64, 64);
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 64, 64);
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
    var pos = new Float32Array([
      p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2],
      p1[0], p1[1], p1[2], p3[0], p3[1], p3[2], p4[0], p4[1], p4[2]
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
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
  scene.fog = new THREE.Fog(0xbcccd4, 70, 280);

  var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 600);

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

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ---------------------------------------------------------------
  // 建屋（双子切妻レンガ造り）
  // ---------------------------------------------------------------
  var SHED_HW = 4.6;
  var BUILD_LEN = 36;
  var WALL_H = 6.0;
  var ROOF_H = 4.4;
  var VALLEY_H = WALL_H + ROOF_H * 0.15;
  var TOTAL_W = SHED_HW * 4;

  var buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  function makeLongWallWindows() {
    var arr = [], n = 10;
    for (var i = 0; i < n; i++) {
      arr.push({ cxFrac: 0.075 + (i / (n - 1)) * 0.85, topFrac: 0.2, wFrac: 0.055, hFrac: 0.56, style: "arch" });
    }
    return arr;
  }

  var texOuterA = makeBrickWallTexture({ realW: BUILD_LEN, realH: WALL_H, windows: makeLongWallWindows(), nameProb: 0.05, ivyDensity: 10 });
  var texOuterB = makeBrickWallTexture({ realW: BUILD_LEN, realH: WALL_H, windows: makeLongWallWindows(), nameProb: 0.05, ivyDensity: 8 });
  var texFront = makeBrickWallTexture({
    realW: TOTAL_W, realH: WALL_H,
    windows: [
      { cxFrac: 0.17, topFrac: 0.24, wFrac: 0.08, hFrac: 0.4, style: "arch" },
      { cxFrac: 0.83, topFrac: 0.24, wFrac: 0.08, hFrac: 0.4, style: "arch" }
    ],
    door: { cxFrac: 0.5, wFrac: 0.09, hFrac: 0.6 },
    nameProb: 0.05, ivyDensity: 14
  });
  var texBack = makeBrickWallTexture({ realW: TOTAL_W, realH: WALL_H, windows: [], nameProb: 0.045, ivyDensity: 16 });
  var flatBrick = new THREE.MeshStandardMaterial({ color: 0x51473b, roughness: 0.95 });

  var wallGeo = new THREE.BoxGeometry(TOTAL_W, WALL_H, BUILD_LEN);
  var wallBox = new THREE.Mesh(wallGeo, [
    new THREE.MeshStandardMaterial({ map: texOuterB, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: texOuterA, roughness: 0.95 }),
    flatBrick, flatBrick,
    new THREE.MeshStandardMaterial({ map: texBack, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: texFront, roughness: 0.95 })
  ]);
  wallBox.position.set(0, WALL_H / 2, BUILD_LEN / 2);
  buildingGroup.add(wallBox);

  var roofMat = new THREE.MeshStandardMaterial({ map: makeRoofTexture(), roughness: 0.55, metalness: 0.2 });
  function addRoofSlope(xEave, xRidge, yEave, yRidge) {
    var slopeLen = Math.hypot(xRidge - xEave, yRidge - yEave);
    var m = roofMat.clone(); m.map = roofMat.map;
    buildingGroup.add(makeQuadMesh(
      [xEave, yEave, 0], [xRidge, yRidge, 0], [xRidge, yRidge, BUILD_LEN], [xEave, yEave, BUILD_LEN],
      m, BUILD_LEN / 3, slopeLen / 1.2));
  }
  addRoofSlope(-SHED_HW * 2, -SHED_HW, WALL_H, WALL_H + ROOF_H);
  addRoofSlope(0, -SHED_HW, VALLEY_H, WALL_H + ROOF_H);
  addRoofSlope(SHED_HW * 2, SHED_HW, WALL_H, WALL_H + ROOF_H);
  addRoofSlope(0, SHED_HW, VALLEY_H, WALL_H + ROOF_H);

  function makeGableTriTexture(style) {
    var c = makeCanvas(768, 768);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3f3830"; ctx.fillRect(0, 0, 768, 768);
    var bw = BRICK_W_M * PX_PER_M, bh = BRICK_H_M * PX_PER_M, mort = MORTAR_M * PX_PER_M;
    for (var r = 0; r * bh < 768; r++) {
      var y = 768 - (r + 1) * bh;
      var offset = (r % 2 === 0) ? 0 : bw / 2;
      for (var x = -offset; x < 768; x += bw) {
        var p = Math.random(), color;
        if (p < 0.5) color = hsl(11 + rand(-6, 6), 44 + rand(-8, 8), 33 + rand(-7, 10));
        else if (p < 0.72) color = hsl(30 + rand(-8, 8), 22, 60);
        else color = hsl(18, 16, 24);
        ctx.fillStyle = color;
        ctx.fillRect(x + mort, y + mort, bw - mort * 2, bh - mort * 2);
      }
    }
    if (style === "circle") drawWindow(ctx, 255, 290, 250, 250, "circle");
    else if (style === "arch") drawWindow(ctx, 275, 210, 210, 360, "arch");
    for (var i = 0; i < 12; i++) {
      var bx = rand(0, 768), by = rand(380, 768), rr = rand(80, 220);
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      g.addColorStop(0, "rgba(46,82,36,0.55)"); g.addColorStop(1, "rgba(46,82,36,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  var gableCircleTex = makeGableTriTexture("circle");
  var gableArchTex = makeGableTriTexture("arch");
  var gablePlainTex = makeGableTriTexture("plain");

  function addGableTri(xOuter, xRidge, z, tex) {
    var p1 = [xOuter, WALL_H, z], p2 = [xRidge, WALL_H + ROOF_H, z], p3 = [0, VALLEY_H, z];
    var mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
    var minX = Math.min(xOuter, xRidge, 0), maxX = Math.max(xOuter, xRidge, 0);
    var minY = Math.min(WALL_H, WALL_H + ROOF_H, VALLEY_H), maxY = Math.max(WALL_H, WALL_H + ROOF_H, VALLEY_H);
    function uv(p) { return [(p[0] - minX) / (maxX - minX), (p[1] - minY) / (maxY - minY)]; }
    buildingGroup.add(makeTriMesh(p1, p2, p3, mat, uv(p1), uv(p2), uv(p3)));
  }
  addGableTri(-SHED_HW * 2, -SHED_HW, 0, gableCircleTex);
  addGableTri(SHED_HW * 2, SHED_HW, 0, gableArchTex);
  addGableTri(-SHED_HW * 2, -SHED_HW, BUILD_LEN, gablePlainTex);
  addGableTri(SHED_HW * 2, SHED_HW, BUILD_LEN, gablePlainTex);

  function addChimney(x, z) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x6b4230, roughness: 0.9 }));
    base.position.y = WALL_H + ROOF_H + 0.6;
    g.add(base);
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.35 }));
    pipe.position.y = WALL_H + ROOF_H + 3.0;
    g.add(pipe);
    g.position.set(x, 0, z);
    buildingGroup.add(g);
  }
  addChimney(-SHED_HW, 5);
  addChimney(SHED_HW, 5.6);

  // 正面（-z側）の低い附属屋（下屋）— 航空写真参照
  (function addAnnex() {
    var aw = 13, ad = 4.4, ahBack = 3.4, ahFront = 2.6;
    var ax = -1.5, azFront = -ad;   // 建屋facade(z=0)の手前に張り出す
    var annexTex = makeBrickWallTexture({
      realW: aw, realH: ahFront, windows: [], door: { cxFrac: 0.5, wFrac: 0.16, hFrac: 0.78 },
      nameProb: 0.03, ivyDensity: 5
    });
    var sideMat = new THREE.MeshStandardMaterial({ color: 0x9c9084, roughness: 0.95 });
    var frontMat = new THREE.MeshStandardMaterial({ map: annexTex, roughness: 0.95 });
    // 壁ボックス（前面のみブリック、他はモルタル色）
    var walls = new THREE.Mesh(new THREE.BoxGeometry(aw, ahFront, ad), [
      sideMat, sideMat, flatBrick, flatBrick, sideMat, frontMat
    ]);
    walls.position.set(ax, ahFront / 2, azFront + ad / 2);
    buildingGroup.add(walls);
    // 片流れ屋根（背が高い建屋側=奥 → 手前へ下る）
    var roofSlope = makeQuadMesh(
      [ax - aw / 2, ahBack, 0], [ax + aw / 2, ahBack, 0],
      [ax + aw / 2, ahFront, azFront], [ax - aw / 2, ahFront, azFront],
      roofMat.clone(), aw / 3, ad / 2);
    buildingGroup.add(roofSlope);
  })();

  // ---------------------------------------------------------------
  // 建屋周りの小物（リアル化）: 配管・柵・メーター・コンクリ土間
  // ---------------------------------------------------------------
  var pipeMat = new THREE.MeshStandardMaterial({ color: 0x2f6ea5, roughness: 0.5, metalness: 0.3 });
  var railMat = new THREE.MeshStandardMaterial({ color: 0xd9b422, roughness: 0.6, metalness: 0.2 });
  var concreteMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.95 });

  // コンクリ土間（正面右手・写真参照）
  var pad = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), concreteMat);
  pad.rotation.x = -Math.PI / 2; pad.position.set(11, 0.02, -6);
  scene.add(pad);

  // 青い配管
  for (var pi = 0; pi < 3; pi++) {
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 9, 12), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(6 + pi * 0.6, 0.3 + pi * 0.02, -3 - pi * 1.1);
    scene.add(pipe);
  }
  // 黄色い手すり
  for (var ri = 0; ri < 4; ri++) {
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), railMat);
    post.position.set(4 + ri * 1.6, 0.55, -9.5);
    scene.add(post);
  }
  var railBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.08), railMat);
  railBar.position.set(6.4, 1.0, -9.5);
  scene.add(railBar);

  // 電柱 + 電線（写真の雰囲気）
  var poleMat = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.8 });
  var poleXs = [-34, -12, 12, 34];
  var poleZ = -30, poleTops = [];
  poleXs.forEach(function (px) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 8), poleMat);
    pole.position.set(px, 4.5, poleZ); scene.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), new THREE.MeshStandardMaterial({ color: 0x5a3a24 }));
    arm.position.set(px, 8.2, poleZ); scene.add(arm);
    poleTops.push(new THREE.Vector3(px, 8.5, poleZ));
  });
  var wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  for (var w2 = 0; w2 < poleTops.length - 1; w2++) {
    [-0.7, 0, 0.7].forEach(function (off) {
      var a = poleTops[w2].clone().add(new THREE.Vector3(off, 0, 0));
      var b = poleTops[w2 + 1].clone().add(new THREE.Vector3(off, 0, 0));
      var mid = a.clone().lerp(b, 0.5); mid.y -= 0.8;
      var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      var geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
      scene.add(new THREE.Line(geo, wireMat));
    });
  }

  // ---------------------------------------------------------------
  // 木・茂み・草・岩でリアル化
  // ---------------------------------------------------------------
  var trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4128, roughness: 0.95 });
  function foliageMat() { return new THREE.MeshStandardMaterial({ color: hsl(rand(95, 130), rand(38, 55), rand(26, 40)), roughness: 0.9, flatShading: true }); }

  function tooCloseToBuilding(x, z, margin) {
    margin = margin || 3;
    return (x > -TOTAL_W / 2 - margin && x < TOTAL_W / 2 + margin && z > -margin && z < BUILD_LEN + margin);
  }

  function addTree(x, z) {
    var g = new THREE.Group();
    var th = rand(3.0, 5.5);
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, th, 7), trunkMat);
    trunk.position.y = th / 2; g.add(trunk);
    var n = 3 + Math.floor(Math.random() * 2);
    for (var k = 0; k < n; k++) {
      var r = rand(1.2, 2.0);
      var fol = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliageMat());
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

  // 草（クロスプレーンのアルファ）
  var grassTex = makeGrassBladeTexture();
  var grassMat = new THREE.MeshStandardMaterial({ map: grassTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  var grassGeo = new THREE.PlaneGeometry(0.7, 0.55);
  function addGrassTuft(x, z) {
    var g = new THREE.Group();
    var p1 = new THREE.Mesh(grassGeo, grassMat);
    var p2 = new THREE.Mesh(grassGeo, grassMat); p2.rotation.y = Math.PI / 2;
    g.add(p1); g.add(p2);
    var s = rand(0.7, 1.5);
    g.scale.set(s, s, s);
    g.position.set(x, 0.55 * s / 2, z);
    scene.add(g);
  }

  // 配置
  var placed = 0, guard = 0;
  while (placed < 22 && guard < 400) {
    guard++;
    var tx = rand(-70, 70), tz = rand(-60, 90);
    if (tooCloseToBuilding(tx, tz, 6) || Math.hypot(tx, tz + 5) < 8) continue;
    addTree(tx, tz); placed++;
  }
  // 建屋を挟む大きめの木（航空写真: 東西に大木）
  addTree(-26, 16); addTree(-24, 10);
  addTree(28, 20); addTree(30, 12);
  for (var b = 0; b < 40; b++) {
    var bx = rand(-75, 75), bz = rand(-60, 95);
    if (tooCloseToBuilding(bx, bz, 3)) continue;
    addBush(bx, bz);
  }
  for (var rk = 0; rk < 24; rk++) {
    var rx = rand(-70, 70), rz = rand(-55, 90);
    if (tooCloseToBuilding(rx, rz, 3)) continue;
    addRock(rx, rz);
  }
  for (var gt = 0; gt < 240; gt++) {
    var gx = rand(-75, 75), gz = rand(-60, 95);
    if (tooCloseToBuilding(gx, gz, 2.5)) continue;
    addGrassTuft(gx, gz);
  }

  // ---------------------------------------------------------------
  // 広告: 動画モニター(mp4) / 静止画看板(png) / 説明看板
  // ---------------------------------------------------------------
  // 動画（ローカルサーバー経由推奨）
  var video = document.createElement("video");
  video.src = encodeURI("asset/福岡県中間市世界遺産　『遠賀川水源地ポンプ室』紹介動画.mp4");
  video.loop = true;
  video.muted = true;            // 自動再生のためミュート開始（後で解除可）
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
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
    if (pr && pr.then) pr.then(function () { videoPending = false; }).catch(function () { /* ユーザー操作待ち */ });
  }

  // 静止画
  var imgMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  new THREE.TextureLoader().load("asset/exemate.png", function (t) {
    t.encoding = THREE.sRGBEncoding;
    imgMat.map = t; imgMat.color.set(0xffffff); imgMat.needsUpdate = true;
  });

  // 大型モニター（フレーム + 脚 + スクリーン）
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
    // ラベル帯
    if (label) {
      var lc = makeCanvas(512, 96); var lx = lc.getContext("2d");
      lx.fillStyle = "#c8a24a"; lx.fillRect(0, 0, 512, 96);
      lx.fillStyle = "#1a1206"; lx.font = "bold 46px 'Hiragino Kaku Gothic ProN',sans-serif";
      lx.textAlign = "center"; lx.textBaseline = "middle"; lx.fillText(label, 256, 50);
      var lt = new THREE.CanvasTexture(lc); lt.encoding = THREE.sRGBEncoding;
      var band = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, 0.7), new THREE.MeshBasicMaterial({ map: lt }));
      band.position.set(0, 2.2 + h + 0.55, 0.17); group.add(band);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
  }

  // 説明看板（テキスト）
  function makeSignTexture(lines, accent) {
    var c = makeCanvas(512, 340);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#f4f1e9"; ctx.fillRect(0, 0, 512, 340);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 512, 56);
    ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 330);
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(lines[0], 256, 38);
    ctx.fillStyle = "#333"; ctx.font = "bold 40px 'Hiragino Kaku Gothic ProN',sans-serif";
    ctx.fillText(lines[1], 256, 150);
    ctx.font = "22px 'Hiragino Kaku Gothic ProN',sans-serif"; ctx.fillStyle = "#666";
    ctx.fillText(lines[2] || "", 256, 200);
    ctx.fillStyle = "#999"; ctx.font = "18px sans-serif";
    ctx.fillText(lines[3] || "", 256, 300);
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
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
    board.position.set(0, 2.7, 0); group.add(board);
    group.position.set(x, 0, z); group.rotation.y = rotY;
    scene.add(group);
  }

  // 大型 動画モニター（正面やや左、プレイヤーの初期視界内）
  addMonitor(-20, -14, Math.PI * 0.16, 8, 4.5, videoScreenMat, "遠賀川水源地ポンプ室 紹介動画");
  // 大型 静止画看板（正面右）
  addMonitor(22, -12, -Math.PI * 0.2, 6, 4, imgMat, "SPONSOR / exemate");
  // 説明看板いくつか
  addSignboard(-30, 20, Math.PI * 0.35, ["SUPPORT", "寄付者名をレンガに刻印", "あなたの名前をここに", "近づくと文字が読めます"], "#1e8449");
  addSignboard(30, 26, -Math.PI * 0.4, ["SPONSOR", "広告募集中", "企業広告・PR動画を掲載", "AD SPACE"], "#c0392b");
  addSignboard(0, 92, Math.PI, ["PROJECT", "遠賀川水源地ポンプ室", "メタバース保存プロジェクト", "プロトタイプ v0.2"], "#6c3483");

  // ---------------------------------------------------------------
  // 操作（PointerLockControls + ジャンプ）
  // ---------------------------------------------------------------
  camera.position.set(10, 1.7, -24);
  camera.rotation.y = Math.PI; // 建屋（+z方向）を向く

  var controls = new THREE.PointerLockControls(camera, document.body);
  scene.add(controls.getObject());
  var overlay = document.getElementById("overlay");
  var crosshair = document.getElementById("crosshair");
  var hud = document.getElementById("hud");
  var titleBadge = document.getElementById("title-badge");

  overlay.addEventListener("click", function () { controls.lock(); tryPlayVideo(); });
  controls.addEventListener("lock", function () {
    overlay.style.display = "none"; crosshair.style.display = "block";
    hud.style.display = "block"; titleBadge.style.display = "block";
    tryPlayVideo();
  });
  controls.addEventListener("unlock", function () {
    overlay.style.display = "flex"; crosshair.style.display = "none";
    hud.style.display = "none"; titleBadge.style.display = "none";
  });

  var keys = {};
  window.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyM") { video.muted = !video.muted; tryPlayVideo(); } // M で動画の音声ON/OFF
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("wheel", function (e) {
    camera.fov = clamp(camera.fov + e.deltaY * 0.02, 15, 75);
    camera.updateProjectionMatrix();
  }, { passive: true });

  // 建屋の簡易コリジョン
  var COLL_MINX = -TOTAL_W / 2 - 0.6, COLL_MAXX = TOTAL_W / 2 + 0.6;
  var COLL_MINZ = -0.6, COLL_MAXZ = BUILD_LEN + 0.6;
  function collides(x, z) {
    if (x > COLL_MINX && x < COLL_MAXX && z > COLL_MINZ && z < COLL_MAXZ) return true;
    // 附属屋（下屋）: x[-8,5], z[-4.4,0]
    if (x > -8.6 && x < 5.6 && z > -5.0 && z < 0.6) return true;
    return false;
  }

  // ジャンプ物理
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
    if (moving) {
      var len = Math.hypot(moveX, moveZ); moveX /= len; moveZ /= len;
      camera.getWorldDirection(forwardV); forwardV.y = 0; forwardV.normalize();
      rightV.set(-forwardV.z, 0, forwardV.x);
      var speed = (keys["ShiftLeft"] || keys["ShiftRight"]) ? 11 : 5.8;
      var dx = (forwardV.x * moveZ + rightV.x * moveX) * speed * dt;
      var dz = (forwardV.z * moveZ + rightV.z * moveX) * speed * dt;
      var candX = obj.position.x + dx, candZ = obj.position.z + dz;
      if (!collides(candX, obj.position.z)) obj.position.x = candX;
      if (!collides(obj.position.x, candZ)) obj.position.z = candZ;
      obj.position.x = clamp(obj.position.x, -150, 150);
      obj.position.z = clamp(obj.position.z, -150, 150);
    }

    // ジャンプ
    if (keys["Space"] && onGround) { velY = JUMP_V; onGround = false; }
    velY += GRAVITY * dt;
    var groundY = EYE + (moving && onGround ? Math.sin(bobT += dt * (speed > 8 ? 14 : 9)) * 0.045 : 0);
    obj.position.y += velY * dt;
    if (obj.position.y <= groundY) { obj.position.y = groundY; velY = 0; onGround = true; }
  }

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (controls.isLocked) updateMovement(dt);
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

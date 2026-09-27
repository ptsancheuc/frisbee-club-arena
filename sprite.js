(() => {
  const rows = ['          BBBB      ','         BTTTTB     ','         BTTTTTB    ','         BDDTETBBB  ','         BDDTTTCCCN ',' B       BDDTTCCCCN ',' BTB    BTTTTTCCCBB ',' BTTBBBBTTTRRRBB    ','  BTTTTTTTTRRRB     ','   BTTTTTTTTTTB     ','   BTTTTTTTTTTB     ','   BTTTTTTTTTB      ','    BTTBBBBTTB      ','    BTTB  BTTB      ','    BCCB  BCCB      ','    BBBB  BBBB      '];
  function make(color = '#cf9560') {
    const palette = { B: '#73513b', T: color, D: '#a86b43', C: '#f4ddb0', E: '#293d35', N: '#344034', R: '#e26c47' };
    return rows.flatMap(row => Array.from({ length: 20 }, (_, x) => palette[row[x]] || null));
  }
  function valid(pixels) { return Array.isArray(pixels) && pixels.length === 320 && pixels.every(c => c === null || /^#[0-9a-f]{6}$/i.test(c)); }
  function draw(ctx, pixels, x, y, size = 3) {
    pixels.forEach((c, i) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x + i % 20 * size, y + Math.floor(i / 20) * size, size + .05, size + .05); } });
  }
  window.DogArt = { make, valid, draw };
})();

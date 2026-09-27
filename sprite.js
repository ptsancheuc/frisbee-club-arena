(() => {
  const rows = ['          BBBB      ','         BTTTTB     ','         BTTTTTB    ','         BDDTETBBB  ','         BDDTTTCCCN ',' B       BDDTTCCCCN ',' BTB    BTTTTTCCCBB ',' BTTBBBBTTTRRRBB    ','  BTTTTTTTTRRRB     ','   BTTTTTTTTTTB     ','   BTTTTTTTTTTB     ','   BTTTTTTTTTB      ','    BTTBBBBTTB      ','    BTTB  BTTB      ','    BCCB  BCCB      ','    BBBB  BBBB      '];
  const breeds = { mestizo: 'Mestizo', corgi: 'Corgi', dalmata: 'Dálmata', husky: 'Husky', salchicha: 'Salchicha' };
  function make(color = '#cf9560', breed = 'mestizo') {
    const palette = { B: '#73513b', T: color, D: '#a86b43', C: '#f4ddb0', E: '#293d35', N: '#344034', R: '#e26c47' };
    const pixels = rows.flatMap(row => Array.from({ length: 20 }, (_, x) => palette[row[x]] || null));
    const base = {corgi:'#dca45f',dalmata:'#f3eee4',husky:'#8c9ba4',salchicha:'#9d6443'}[breed];
    if (base) for(let i=0;i<pixels.length;i++) if(pixels[i]===color) pixels[i]=base;
    if(breed==='dalmata') for(const [x,y] of [[5,8],[8,10],[11,7],[12,2],[6,12]]) for(let j=0;j<2;j++) if(pixels[y*20+x+j]) pixels[y*20+x+j]='#35413f';
    if(breed==='corgi'||breed==='husky') for(const x of [10,14]) { pixels[x]='#73513b'; pixels[20+x]=base; pixels[40+x]=base; }
    if(breed==='husky') { pixels[3*20+13]='#72c9df'; for(let x=10;x<14;x++) pixels[5*20+x]='#ecece2'; }
    if(breed==='corgi'||breed==='salchicha') {
      const copy=pixels.slice(); pixels.fill(null);
      for(let y=0;y<16;y++) for(let x=0;x<20;x++) { const ny=y<12?Math.min(13,y+2):y; pixels[ny*20+x]=copy[y*20+x] || pixels[ny*20+x]; }
      if(breed==='salchicha') for(let y=8;y<12;y++) for(let x=2;x<10;x++) pixels[y*20+x]=base;
    }
    return pixels;
  }
  function valid(pixels) { return Array.isArray(pixels) && pixels.length === 320 && pixels.every(c => c === null || /^#[0-9a-f]{6}$/i.test(c)); }
  function draw(ctx, pixels, x, y, size = 3) {
    pixels.forEach((c, i) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x + i % 20 * size, y + Math.floor(i / 20) * size, size + .05, size + .05); } });
  }
  window.DogArt = { make, valid, draw, breeds };
})();

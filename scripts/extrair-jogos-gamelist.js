const https = require('https');
const url = 'https://raw.githubusercontent.com/SteamTools-Team/GameList/main/games.json';

// Jogos gratuitos conhecidos (Free To Play) - excluir
const FREE_APPIDS = new Set(['730','570','578080','1172470','230410','552520','440','236390','359550','438100','3419430','2507950','2767030','1973530','1203220','1665460','1938090']);

// POPULAR_APPIDS do launcher - prioridade
const POPULAR = [730,271590,578080,1172470,1085660,1938090,230410,1245620,381210,1091500,570,552520,105600,4000,252490,346110,1229490,1426210,377160,489830,292030,236390,359550,218620,413150,227300,440900,221100,728880,1174180,1599340,306130,588650,594570,275850,322330,391540,617290,739630,1159690,4069520,1817070,2050650,2183900,1142710,1551360,1817230];

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const games = JSON.parse(data).filter(g => g.type === 'game' && g.appid && g.name);
    const byId = {};
    games.forEach(g => { byId[String(g.appid)] = g.name; });
    
    const paid = [];
    for (const aid of POPULAR) {
      const id = String(aid);
      if (!FREE_APPIDS.has(id) && byId[id]) {
        paid.push({ appid: id, name: byId[id] });
        if (paid.length >= 50) break;
      }
    }
    
    if (paid.length < 50) {
      for (const g of games) {
        if (paid.length >= 50) break;
        const id = String(g.appid);
        if (!FREE_APPIDS.has(id) && !paid.find(p => p.appid === id)) {
          paid.push({ appid: id, name: g.name });
        }
      }
    }
    
    console.log(JSON.stringify(paid.slice(0, 50), null, 2));
  });
}).on('error', e => console.error(e));

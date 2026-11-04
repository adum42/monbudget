// Serveur local minimal pour les tests Playwright (#9).
// Il sert uniquement index.html (la racine du repo) sur 127.0.0.1 : l'app y tourne comme en local,
// donc sur la base TEST grâce à l'aiguillage de #20 (127.0.0.1 n'est pas un domaine de prod).
// Aucune dépendance : Node seul. Usage : node e2e/serveur.js [port]
const http=require('http');
const fs=require('fs');
const path=require('path');

const port=Number(process.argv[2])||8123;
const fichier=path.join(__dirname,'..','..','index.html');

http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'||url.pathname==='/index.html'){
    // Relu à chaque requête : une modification de index.html est prise en compte sans relancer le serveur.
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    res.end(fs.readFileSync(fichier));
    return;
  }
  // Pas d'icône dans l'app : 204 au lieu d'un 404 qui ajouterait une erreur dans la console.
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
  res.end('Introuvable');
}).listen(port,'127.0.0.1',()=>console.log(`[serveur de test] http://127.0.0.1:${port}/`));

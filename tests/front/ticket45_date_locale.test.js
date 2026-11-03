// Tests unitaires de dateLocaleISO (#45) : date du jour dans le fuseau du navigateur, pas en UTC.
// Usage : TZ=Europe/Paris node tests/front/ticket45_date_locale.test.js [index.html]
// Le bloc « DATE DU JOUR : FONCTION PURE (#45) » est extrait tel quel de index.html : on teste le vrai code.
// Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');

// Les cas « minuit » n'ont de sens que si l'heure locale diffère de l'UTC : on impose Paris.
if(process.env.TZ!=='Europe/Paris'){
  console.log('KO  ce test doit être lancé avec TZ=Europe/Paris (TZ actuel : '+(process.env.TZ||'non défini')+')');
  process.exit(1);
}

const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const debut=html.indexOf('// ── DATE DU JOUR : FONCTION PURE (#45)');
const fin=html.indexOf('// ── MODAL TX');
assert.ok(debut>0&&fin>debut,'bloc de la fonction pure #45 introuvable dans '+fichier);
const dateLocaleISO=new Function(html.slice(debut,fin)+';return dateLocaleISO;')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};
// new Date(a, m, j, h, mn) = heure LOCALE (ici Paris). m commence à 0.
const local=(a,m,j,h=12,mn=0)=>new Date(a,m-1,j,h,mn);

// Vérifie d'abord que l'environnement reproduit bien le bug : sinon les cas « minuit » ne prouvent rien.
cas('environnement : Paris = UTC+1 en hiver, UTC+2 en été',()=>{
  assert.strictEqual(local(2026,11,1,0,30).getTimezoneOffset(),-60);
  assert.strictEqual(local(2026,7,1,1,30).getTimezoneOffset(),-120);
});
cas('environnement : toISOString donne bien la veille à 00h30 (bug reproduit)',()=>
  assert.strictEqual(local(2026,11,1,0,30).toISOString().slice(0,10),'2026-10-31'));

// Heure d'hiver (UTC+1)
cas('hiver : 01/11/2026 00h30 -> 2026-11-01 (et non 2026-10-31)',()=>
  assert.strictEqual(dateLocaleISO(local(2026,11,1,0,30)),'2026-11-01'));
cas('hiver : 01/11/2026 00h00 pile -> 2026-11-01',()=>
  assert.strictEqual(dateLocaleISO(local(2026,11,1,0,0)),'2026-11-01'));
cas('hiver : 01/11/2026 00h59 -> 2026-11-01',()=>
  assert.strictEqual(dateLocaleISO(local(2026,11,1,0,59)),'2026-11-01'));
cas('hiver : 01/01/2027 00h30 -> 2027-01-01 (changement d\'année)',()=>
  assert.strictEqual(dateLocaleISO(local(2027,1,1,0,30)),'2027-01-01'));
cas('hiver : 31/12/2026 23h30 -> 2026-12-31',()=>
  assert.strictEqual(dateLocaleISO(local(2026,12,31,23,30)),'2026-12-31'));
cas('hiver : 31/12/2026 23h59 -> 2026-12-31',()=>
  assert.strictEqual(dateLocaleISO(local(2026,12,31,23,59)),'2026-12-31'));

// Heure d'été (UTC+2)
cas('été : 01/07/2026 01h30 -> 2026-07-01 (et non 2026-06-30)',()=>
  assert.strictEqual(dateLocaleISO(local(2026,7,1,1,30)),'2026-07-01'));
cas('été : 01/07/2026 00h10 -> 2026-07-01',()=>
  assert.strictEqual(dateLocaleISO(local(2026,7,1,0,10)),'2026-07-01'));
cas('été : 31/07/2026 23h30 -> 2026-07-31',()=>
  assert.strictEqual(dateLocaleISO(local(2026,7,31,23,30)),'2026-07-31'));

// Jours de changement d'heure (2026 : 29/03 et 25/10)
cas('passage à l\'heure d\'été : 29/03/2026 01h30 et 03h30 -> 2026-03-29',()=>{
  assert.strictEqual(dateLocaleISO(local(2026,3,29,1,30)),'2026-03-29');
  assert.strictEqual(dateLocaleISO(local(2026,3,29,3,30)),'2026-03-29');
});
cas('passage à l\'heure d\'hiver : 25/10/2026 00h30 et 02h30 -> 2026-10-25',()=>{
  assert.strictEqual(dateLocaleISO(local(2026,10,25,0,30)),'2026-10-25');
  assert.strictEqual(dateLocaleISO(local(2026,10,25,2,30)),'2026-10-25');
});

// Format
cas('jour et mois à un chiffre complétés : 05/03/2026 -> 2026-03-05',()=>
  assert.strictEqual(dateLocaleISO(local(2026,3,5)),'2026-03-05'));
cas('29/02/2028 (année bissextile) -> 2028-02-29',()=>
  assert.strictEqual(dateLocaleISO(local(2028,2,29)),'2028-02-29'));
cas('format AAAA-MM-JJ (10 caractères)',()=>
  assert.match(dateLocaleISO(local(2026,11,3)),/^\d{4}-\d{2}-\d{2}$/));
cas('slice(0,7) donne le mois AAAA-MM (usage de currentMonth)',()=>
  assert.strictEqual(dateLocaleISO(local(2026,11,1,0,30)).slice(0,7),'2026-11'));

// En journée : même résultat qu'avant (toISOString), donc aucun changement visible
cas('en journée : identique à l\'ancien calcul (12h, 14h, 22h)',()=>{
  for(const h of [12,14,22])
    for(const d of [local(2026,11,3,h),local(2026,7,15,h)])
      assert.strictEqual(dateLocaleISO(d),d.toISOString().slice(0,10));
});

// Sans argument : la date du jour
cas('sans argument : date du jour locale',()=>{
  const avant=new Date();const r=dateLocaleISO();const apres=new Date();
  assert.ok([dateLocaleISO(avant),dateLocaleISO(apres)].includes(r),r);
});
cas('ne modifie pas la date passée en argument',()=>{
  const d=local(2026,11,1,0,30);const t=d.getTime();dateLocaleISO(d);assert.strictEqual(d.getTime(),t);
});

console.log(ko?ko+' échec(s) / '+n:'Tous les cas passent ('+n+')');process.exit(ko?1:0);

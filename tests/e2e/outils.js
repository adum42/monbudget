// Outils partagés des tests Playwright (#9).
//
// Ce fichier fournit des « fixtures » : des objets préparés avant chaque test et rangés après.
// Un test les demande par leur nom dans ses paramètres, par exemple :
//     test('mon test', async ({app, base}) => { ... });
//
//   journal  : erreurs de la console, erreurs JavaScript et messages « [monbudget] » de la page.
//              À la fin du test, toute erreur non attendue fait échouer le test.
//   reseau   : interception du réseau. Les CDN sont servis depuis tests/node_modules (versions
//              épinglées, pas d'Internet nécessaire) ; toute requête vers un autre site, ou vers un
//              projet Supabase autre que TEST, est bloquée et fait échouer le test.
//   base     : faux Supabase en mémoire (tables, écritures reçues, erreur forcée). Sans connexion.
//   app      : la page de l'app ouverte, connectée à la fausse base, bandeau TEST contrôlé.
//
// L'horloge de la page est figée au mercredi 4 novembre 2026, 10 h, heure de Paris :
// le mois affiché, les dates par défaut et les résultats sont donc toujours les mêmes.
const base=require('@playwright/test');
const {expect}=base;
const fs=require('fs');
const path=require('path');

const TEST='ebupazakzfbpptmlrzze';   // TEST « monbudget-test » : le seul projet Supabase autorisé
const PROD='artvpflfhvouyngzgqob';   // PROD « budget-app » : tout appel vers lui fait échouer le test
const HEURE_FIGEE=new Date('2026-11-04T10:00:00+01:00');

// CDN de index.html servis depuis node_modules (versions fixées dans tests/package.json).
const MODULES=path.join(__dirname,'..','node_modules');
const CDN={
  'cdn.jsdelivr.net':path.join(MODULES,'@supabase/supabase-js/dist/umd/supabase.js'),
  'cdnjs.cloudflare.com':path.join(MODULES,'chart.js/dist/chart.umd.js'),
};
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'};

// ── Jeu de données fictif de la fausse base ─────────────────────────────
const UTILISATEUR={id:'00000000-0000-4000-8000-0000000000a1',aud:'authenticated',role:'authenticated',email:'test.qa@exemple.invalid'};
function donneesInitiales(){
  return {
    categories:[
      {id:'c1',user_id:UTILISATEUR.id,nom:'TEST QA Courses',emoji:'🛒',couleur:'#22C97A',type:'les deux'},
      {id:'c2',user_id:UTILISATEUR.id,nom:'TEST QA Loisirs',emoji:'🎮',couleur:'#8B5CF6',type:'les deux'},
    ],
    comptes:[
      {id:'k1',user_id:UTILISATEUR.id,nom:'TEST QA Compte courant',type:'courant',par_defaut:true,couleur:'#5B6EF5',solde_initial:1000,date_solde_initial:'2026-09-30',plafond:null},
      {id:'k2',user_id:UTILISATEUR.id,nom:'TEST QA Livret',type:'livret',par_defaut:false,couleur:'#22C97A',solde_initial:500,date_solde_initial:'2026-09-30',plafond:null},
    ],
    transactions:[
      {id:'t1',user_id:UTILISATEUR.id,description:'TEST QA Salaire',montant:2000,type:'entrée',categorie_id:null,date:'2026-11-01',tricount:'non',epingle:false,note:null,compte_id:'k1',compte_dest_id:null},
      {id:'t2',user_id:UTILISATEUR.id,description:'TEST QA Boulangerie',montant:4.2,type:'sortie',categorie_id:'c1',date:'2026-11-03',tricount:'non',epingle:true,note:null,compte_id:'k1',compte_dest_id:null},
      {id:'t3',user_id:UTILISATEUR.id,description:'TEST QA Loyer octobre',montant:650,type:'sortie',categorie_id:null,date:'2026-10-05',tricount:'non',epingle:false,note:null,compte_id:'k1',compte_dest_id:null},
    ],
    soldes:[],
    v_soldes_comptes:[],   // vue de #5 : vide ici, l'onglet Comptes n'est pas testé dans ce socle
  };
}

// Jeton de session factice (non signé : la fausse base ne le vérifie pas).
function sessionFactice(){
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const maintenant=Math.floor(HEURE_FIGEE.getTime()/1000);
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:UTILISATEUR.id,role:'authenticated',iat:maintenant,exp:maintenant+3600})+'.signature-factice';
  return {access_token:jwt,refresh_token:'factice',token_type:'bearer',expires_in:3600,expires_at:maintenant+3600,user:UTILISATEUR};
}

// ── Fausse base : un sous-ensemble de l'API REST de Supabase (PostgREST) ─────
// Gère ce que l'app utilise : lecture d'une table, insertion, modification et suppression
// filtrées par « colonne=eq.valeur ». Chaque écriture reçue est notée dans base.ecritures.
function creerFausseBase(){
  const b={tables:donneesInitiales(),ecritures:[],erreurForcee:null,compteur:0};
  // La prochaine écriture renverra cette erreur Postgres (ex. '23514'), comme le ferait Supabase.
  b.forcerErreur=code=>{b.erreurForcee=code;};

  const filtres=url=>[...url.searchParams].filter(([k])=>!['select','order','limit','offset','on_conflict','columns'].includes(k))
    .map(([col,v])=>[col,v.replace(/^eq\./,'')]);
  const correspond=(ligne,f)=>f.every(([col,v])=>String(ligne[col])===v);

  b.repondre=async(route,url)=>{
    const req=route.request();
    const methode=req.method();
    if(methode==='OPTIONS') return route.fulfill({status:204,headers:CORS});
    if(url.pathname.startsWith('/auth/v1/user')) return route.fulfill({json:UTILISATEUR,headers:CORS});
    if(url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({status:204,headers:CORS});
    if(url.pathname.startsWith('/auth/v1/')) return route.fulfill({json:sessionFactice(),headers:CORS});

    const table=url.pathname.replace('/rest/v1/','');
    if(!(table in b.tables)) return route.fulfill({status:404,json:{code:'42P01',message:`table ${table} absente de la fausse base`},headers:CORS});
    const f=filtres(url);

    if(methode==='GET'||methode==='HEAD'){
      let lignes=b.tables[table].filter(l=>correspond(l,f));
      // Comptage seul (select(..., {count:'exact', head:true})) : le total est dans l'en-tête.
      if(methode==='HEAD') return route.fulfill({status:200,body:'',headers:{...CORS,'content-range':`*/${lignes.length}`}});
      const select=url.searchParams.get('select')||'*';
      if(table==='transactions'&&select.includes('categories(')){
        // jointure « categories(nom,emoji) » demandée par loadTransactions
        lignes=lignes.map(t=>{
          const c=b.tables.categories.find(x=>x.id===t.categorie_id);
          return {...t,categories:c?{nom:c.nom,emoji:c.emoji}:null};
        });
      }else if(select!=='*'){
        // liste simple de colonnes : select('montant,type')
        const cols=select.split(',');
        lignes=lignes.map(l=>Object.fromEntries(cols.map(c=>[c,l[c]])));
      }
      return route.fulfill({json:lignes,headers:CORS});
    }

    const corps=req.postData()?JSON.parse(req.postData()):null;
    b.ecritures.push({methode,table,corps,filtres:Object.fromEntries(f)});
    if(b.erreurForcee){
      const code=b.erreurForcee;b.erreurForcee=null;
      return route.fulfill({status:400,json:{code,message:'erreur simulée '+code,details:null,hint:null},headers:CORS});
    }
    if(methode==='POST'){
      for(const ligne of [].concat(corps)) b.tables[table].push({id:'nouveau-'+(++b.compteur),...ligne});
      return route.fulfill({status:201,body:'',headers:CORS});
    }
    if(methode==='PATCH'){
      b.tables[table].filter(l=>correspond(l,f)).forEach(l=>Object.assign(l,corps));
      return route.fulfill({status:204,body:'',headers:CORS});
    }
    if(methode==='DELETE'){
      const supprimees=b.tables[table].filter(l=>correspond(l,f)).map(l=>l.id);
      b.tables[table]=b.tables[table].filter(l=>!correspond(l,f));
      // FK transactions.categorie_id « on delete set null » (#44)
      if(table==='categories') b.tables.transactions.forEach(t=>{if(supprimees.includes(t.categorie_id)) t.categorie_id=null;});
      return route.fulfill({status:204,body:'',headers:CORS});
    }
    return route.fulfill({status:405,body:'',headers:CORS});
  };
  return b;
}

// ── Contrôle du bandeau, avant toute action (règle de Quentin) ─────────────
// 1) URL locale, 2) bandeau « Environnement de TEST » visible, 3) message console « environnement : test ».
async function verifierEnvironnementTest(page,journal){
  const hote=new URL(page.url()).hostname;
  expect(['127.0.0.1','localhost'],`URL non autorisée : ${page.url()}`).toContain(hote);
  await expect(page.locator('#env-banner')).toBeVisible();
  await expect(page.locator('#env-banner')).toHaveText('Environnement de TEST');
  await expect.poll(()=>journal.logs,{message:'message console « [monbudget] environnement : test » absent'})
    .toContain('[monbudget] environnement : test');
}

const test=base.test.extend({
  // Avec une session déjà ouverte (true) ou sur l'écran de connexion (false). Modifiable par test.use().
  avecSession:[true,{option:true}],
  // false : fausse base en mémoire. true : vraie base TEST (tests connectés, voir connecte.spec.js).
  baseReelle:[false,{option:true}],

  journal:async({page},use)=>{
    const j={erreurs:[],logs:[],horsTest:[],attendues:[]};
    // Les tests qui provoquent volontairement une erreur la déclarent : j.attendre(/erreur 23514/)
    j.attendre=motif=>j.attendues.push(motif);
    page.on('console',m=>{
      if(m.text().startsWith('[monbudget] environnement')) j.logs.push(m.text());
      if(m.type()==='error') j.erreurs.push(m.text());
    });
    page.on('pageerror',e=>j.erreurs.push('Erreur JavaScript : '+e.message));
    await use(j);
    // Après le test : aucune requête bloquée, aucune erreur non attendue.
    expect(j.horsTest,'requêtes vers un site non autorisé').toEqual([]);
    const inattendues=j.erreurs.filter(e=>!j.attendues.some(m=>m.test(e)));
    expect(inattendues,'erreurs dans la console').toEqual([]);
  },

  base:async({},use)=>{await use(creerFausseBase());},

  reseau:async({context,journal,base,baseReelle},use)=>{
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1'||url.hostname==='localhost') return route.continue();
      if(CDN[url.hostname]) return route.fulfill({path:CDN[url.hostname],contentType:'application/javascript'});
      if(url.hostname.endsWith('fonts.googleapis.com')||url.hostname.endsWith('fonts.gstatic.com'))
        return route.fulfill({body:'',contentType:'text/css'});   // police Syne : sans effet sur les tests
      if(url.hostname===`${TEST}.supabase.co`) return baseReelle?route.continue():base.repondre(route,url);
      journal.horsTest.push(url.hostname+url.pathname);
      return route.abort('blockedbyclient');
    });
    await use();
  },

  app:async({page,context,journal,reseau,avecSession,baseReelle},use)=>{
    // Avec la vraie base, l'horloge reste réelle : un jeton Supabase daté du 04/11/2026 serait refusé.
    if(!baseReelle) await page.clock.setFixedTime(HEURE_FIGEE);
    if(avecSession&&!baseReelle){
      // Session déposée avant le chargement : l'app démarre directement connectée.
      await context.addInitScript(([cle,valeur])=>localStorage.setItem(cle,valeur),
        [`sb-${TEST}-auth-token`,JSON.stringify(sessionFactice())]);
    }
    await page.goto('/');
    await verifierEnvironnementTest(page,journal);
    if(avecSession) await expect(page.locator('#app-screen')).toBeVisible();
    await use(page);
  },
});

module.exports={test,expect,TEST,PROD,HEURE_FIGEE,UTILISATEUR,CDN,verifierEnvironnementTest};

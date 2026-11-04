// Tester une fonction pure de index.html DANS la page (#9).
//
// Les fonctions de index.html sont globales : page.evaluate(() => maFonction(...)) les appelle
// dans le vrai navigateur, avec le vrai fuseau horaire et la vraie locale. C'est complémentaire
// des tests Node de tests/front/ (plus rapides, mais hors navigateur).
//
// Modèle pour un nouveau cas :
//     const r = await app.evaluate(() => maFonction(argument));
//     expect(r).toBe(valeurAttendue);
// Attention : le code passé à evaluate s'exécute dans la page, il ne voit pas les variables du test.
// Pour lui passer une valeur : app.evaluate(x => maFonction(x), valeur).
const {test,expect,verifierEnvironnementTest}=require('./outils');

test('lireMontant accepte la virgule décimale',async({app})=>{
  expect(await app.evaluate(()=>lireMontant('12,50'))).toBe(12.5);
  expect(await app.evaluate(()=>Number.isNaN(lireMontant('abc')))).toBe(true);
});

test('voyantCompte : les règles validées le 03/11, dans l\'ordre',async({app})=>{
  // Une ligne de la vue v_soldes_comptes réduite aux colonnes utiles, et le texte attendu.
  const cas=[
    [{date_dernier_solde_banque:null},'Aucun relevé'],
    [{date_dernier_solde_banque:'2026-09-30',nb_jours_depuis_releve:35,ecart:-12},'⏱ 35 jours'],   // ancien, même avec écart
    [{date_dernier_solde_banque:'2026-09-01',nb_jours_depuis_releve:20,ecart:null},'Relevé à saisir'],
    [{date_dernier_solde_banque:'2026-11-01',nb_jours_depuis_releve:3,ecart:'0.01'},'⚠ écart'],     // l'API renvoie parfois une chaîne
    [{date_dernier_solde_banque:'2026-11-01',nb_jours_depuis_releve:14,ecart:0},'✓ rapproché'],
    [{date_dernier_solde_banque:'2026-10-20',nb_jours_depuis_releve:15,ecart:0},'✓ il y a 15 j'],
  ];
  for(const [ligne,attendu] of cas){
    expect(await app.evaluate(l=>voyantCompte(l).texte,ligne),JSON.stringify(ligne)).toBe(attendu);
  }
});

test('dateLocaleISO suit l\'heure de Paris, pas l\'UTC',async({app})=>{
  // 4 novembre 2026, 0 h 30 à Paris = 3 novembre 23 h 30 en UTC.
  expect(await app.evaluate(()=>dateLocaleISO(new Date('2026-11-03T23:30:00Z')))).toBe('2026-11-04');
  expect(await app.evaluate(()=>new Date('2026-11-03T23:30:00Z').toISOString().slice(0,10))).toBe('2026-11-03');
});

test('ouverture juste après minuit : mois et date de Paris (#45)',async({page,journal,reseau})=>{
  // Pas de fixture « app » (heure figée à 10 h) : l'horloge est figée ici au 1er novembre,
  // 0 h 30 à Paris, soit encore le 31 octobre en UTC. Sans session : écran de connexion.
  await page.clock.setFixedTime(new Date('2026-10-31T23:30:00Z'));
  await page.goto('/');
  await verifierEnvironnementTest(page,journal);
  expect(await page.evaluate(()=>dateLocaleISO())).toBe('2026-11-01');
  expect(await page.evaluate(()=>currentMonth)).toBe('2026-11');   // variable calculée au chargement
});

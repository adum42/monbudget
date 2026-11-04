// Configuration Playwright de monbudget (#9). Documentation : tests/README.md.
//
// Deux familles de tests dans e2e/ :
//   - *.spec.js sans « connecte » : Supabase simulé dans la page (aucun réseau, aucun secret).
//     Ils tournent partout, à 1280 px et à 390 px.
//   - connecte.spec.js : vraie connexion à la base TEST avec l'utilisateur de test
//     (variables TEST_EMAIL / TEST_PASSWORD). Ignorés si ces variables sont absentes.
const {defineConfig,devices}=require('@playwright/test');

const CI=!!process.env.CI;                       // GitHub Actions définit CI=true
const PORT=Number(process.env.PORT_TESTS)||8123;

module.exports=defineConfig({
  testDir:'./e2e',
  timeout:30_000,                 // durée max d'un test
  expect:{timeout:5_000},         // durée max d'attente d'un expect(...) (l'app est asynchrone)
  fullyParallel:true,
  forbidOnly:CI,                  // un test.only oublié fait échouer la CI
  retries:0,                      // pas de nouvel essai : un test instable doit se voir, pas se cacher
  workers:CI?2:undefined,
  reporter:CI
    ?[['list'],['github'],['html',{open:'never'}]]
    :[['list'],['html',{open:'never'}]],

  use:{
    baseURL:`http://127.0.0.1:${PORT}`,
    locale:'fr-FR',
    timezoneId:'Europe/Paris',    // les dates de l'app sont calculées dans le fuseau du navigateur (#45)
    trace:'retain-on-failure',    // en cas d'échec : trace à rejouer avec « npx playwright show-trace »
    screenshot:'only-on-failure',
    // Session cloud : le Chromium de Playwright ne peut pas être téléchargé, on donne celui du système.
    launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{},
  },

  // Playwright lance le serveur local avant les tests et l'arrête après.
  webServer:{
    command:`node e2e/serveur.js ${PORT}`,
    url:`http://127.0.0.1:${PORT}/`,
    reuseExistingServer:!CI,
    timeout:10_000,
  },

  projects:[
    // Sans connexion (Supabase simulé), à deux largeurs d'écran.
    {name:'bureau-1280',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800}},testIgnore:/connecte/},
    {name:'mobile-390',use:{...devices['Desktop Chrome'],viewport:{width:390,height:844}},testIgnore:/connecte/},
    // Connectés à la base TEST : projet à part, lancé en CI dans une étape sans rapport publié
    // (le repo est public : un artefact serait téléchargeable par tout compte GitHub).
    {name:'connecte',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800}},testMatch:/connecte\.spec\.js/},
  ],
});

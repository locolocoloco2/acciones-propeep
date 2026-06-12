// ══════════════════════════════════════════
// ARRANQUE — restaurar sesión si sigue vigente
// ══════════════════════════════════════════
(function(){
  if(restoreSession()){
    enterApp(SESSION);
  }
})();

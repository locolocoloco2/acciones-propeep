// ══════════════════════════════════════════
// CONFIGURACIÓN DEL SISTEMA
// Firmantes del reporte de nómina + tramos ISR
// Persistencia en localStorage
// ══════════════════════════════════════════

var CONFIG_KEY = 'propeep_config';

// Valores por defecto
var CONFIG_DEFAULT = {
  firmantes: [
    {nombre:'PEDRO A. CID MARTINEZ', cargo:'ENCARGADO (A) DE REGISTRO, CONTROL Y NOMINA'},
    {nombre:'JONEY R. DOTEL COLL', cargo:'DIRECTOR (A) DE RECURSOS HUMANOS'},
    {nombre:'JESUS MIGUEL OZUNA PAULINO', cargo:'DIRECTOR ADMINISTRATIVO FINANCIERO (INTERINO)'},
    {nombre:'ROBERT D. POLANCO TEJADA', cargo:'DIRECTOR (A) DE PROYECTOS ESTRATEGICOS Y ESPECIALES DE LA PRESIDENCIA'},
  ],
  // Tramos ISR anuales RD (escala vigente)
  isrTramos: [
    {desde:0,        hasta:416220.00,  tasa:0,    fijo:0},
    {desde:416220.01,hasta:624329.00,  tasa:15,   fijo:0},
    {desde:624329.01,hasta:867123.00,  tasa:20,   fijo:31216},
    {desde:867123.01,hasta:null,       tasa:25,   fijo:79776},
  ],
};

// Aplicar config (merge con defaults)
function aplicarConfig(c){
  window.PROPEEP_CONFIG = {
    firmantes: (c && c.firmantes && c.firmantes.length) ? c.firmantes : JSON.parse(JSON.stringify(CONFIG_DEFAULT.firmantes)),
    isrTramos: (c && c.isrTramos && c.isrTramos.length) ? c.isrTramos : JSON.parse(JSON.stringify(CONFIG_DEFAULT.isrTramos)),
  };
}

// Carga inicial sincrónica: usa caché de localStorage para tener algo de inmediato
function cargarConfigCache(){
  try{
    var raw = localStorage.getItem(CONFIG_KEY);
    aplicarConfig(raw ? JSON.parse(raw) : null);
  }catch(e){ aplicarConfig(null); }
}

// Carga desde Supabase (fuente de verdad, compartida entre todos los usuarios)
async function cargarConfigBD(){
  try{
    var r = await fetch(SUPA_URL+'/rest/v1/configuracion?clave=eq.general&select=valor', {headers: SUPA_HEADERS});
    if(r.ok){
      var data = await r.json();
      if(data && data.length && data[0].valor){
        aplicarConfig(data[0].valor);
        // refrescar caché local
        try{ localStorage.setItem(CONFIG_KEY, JSON.stringify(window.PROPEEP_CONFIG)); }catch(e){}
        return true;
      }
    }
  }catch(e){ console.warn('cargarConfigBD error', e); }
  return false;
}

// Inicializar: primero caché, luego BD en segundo plano
cargarConfigCache();
cargarConfigBD();

// ── Abrir / cerrar modal ──
function abrirConfig(){
  renderConfigFirmantes();
  renderConfigISR();
  document.getElementById('config-modal').style.display = 'block';
}
function cerrarConfig(){
  document.getElementById('config-modal').style.display = 'none';
}

// ── Render firmantes ──
function renderConfigFirmantes(){
  var cont = document.getElementById('config-firmantes');
  var fm = window.PROPEEP_CONFIG.firmantes;
  cont.innerHTML = fm.map(function(f, i){
    return '<div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;align-items:end">'+
      '<div><label>Nombre — Firma '+(i+1)+'</label><input type="text" id="cfg-fm-nombre-'+i+'" value="'+(f.nombre||'').replace(/"/g,'&quot;')+'"></div>'+
      '<div><label>Cargo</label><input type="text" id="cfg-fm-cargo-'+i+'" value="'+(f.cargo||'').replace(/"/g,'&quot;')+'"></div>'+
    '</div>';
  }).join('');
}

// ── Render tramos ISR ──
function renderConfigISR(){
  var cont = document.getElementById('config-isr');
  var tr = window.PROPEEP_CONFIG.isrTramos;
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr 70px 1fr;gap:8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--texto2)">'+
    '<div>Desde (RD$)</div><div>Hasta (RD$)</div><div>Tasa %</div><div>Cuota Fija (RD$)</div></div>';
  html += tr.map(function(t, i){
    return '<div style="display:grid;grid-template-columns:1fr 1fr 70px 1fr;gap:8px">'+
      '<input type="number" id="cfg-isr-desde-'+i+'" value="'+t.desde+'" step="any">'+
      '<input type="number" id="cfg-isr-hasta-'+i+'" value="'+(t.hasta===null?'':t.hasta)+'" step="any" placeholder="(sin límite)">'+
      '<input type="number" id="cfg-isr-tasa-'+i+'" value="'+t.tasa+'" step="any">'+
      '<input type="number" id="cfg-isr-fijo-'+i+'" value="'+t.fijo+'" step="any">'+
    '</div>';
  }).join('');
  cont.innerHTML = html;
}

// ── Guardar ──
function guardarConfig(){
  // Pedir validación de cédula (con guiones) antes de guardar
  mostrarValidacionConfig();
}

// Recolecta los valores actuales del formulario y los guarda (tras validar cédula)
function ejecutarGuardadoConfig(){
  var fm = window.PROPEEP_CONFIG.firmantes.map(function(f, i){
    return {
      nombre: (document.getElementById('cfg-fm-nombre-'+i)||{value:f.nombre}).value.trim(),
      cargo:  (document.getElementById('cfg-fm-cargo-'+i)||{value:f.cargo}).value.trim(),
    };
  });
  var tr = window.PROPEEP_CONFIG.isrTramos.map(function(t, i){
    var hasta = (document.getElementById('cfg-isr-hasta-'+i)||{value:''}).value.trim();
    return {
      desde: parseFloat((document.getElementById('cfg-isr-desde-'+i)||{value:t.desde}).value)||0,
      hasta: hasta==='' ? null : parseFloat(hasta),
      tasa:  parseFloat((document.getElementById('cfg-isr-tasa-'+i)||{value:t.tasa}).value)||0,
      fijo:  parseFloat((document.getElementById('cfg-isr-fijo-'+i)||{value:t.fijo}).value)||0,
    };
  });
  window.PROPEEP_CONFIG = {firmantes:fm, isrTramos:tr};
  // Caché local inmediato
  try{ localStorage.setItem(CONFIG_KEY, JSON.stringify(window.PROPEEP_CONFIG)); }catch(e){}
  // Guardar en Supabase (compartido entre todos los usuarios)
  cfgSt('Guardando en base de datos...', 'info');
  guardarConfigBD(window.PROPEEP_CONFIG).then(function(ok){
    cfgSt(ok ? 'Configuración guardada correctamente para todos los usuarios.'
             : 'Guardado local, pero falló el guardado en base de datos. Verifica la conexión.',
          ok ? 'ok' : 'err');
  });
}

// ── Validación por cédula antes de guardar ──
function mostrarValidacionConfig(){
  var modal = document.getElementById('config-valida-modal');
  if(modal){
    var inp = document.getElementById('config-valida-cedula');
    if(inp) inp.value = '';
    var st = document.getElementById('config-valida-status');
    if(st) st.style.display = 'none';
    modal.style.display = 'flex';
    if(inp) inp.focus();
  }
}

function cerrarValidacionConfig(){
  var modal = document.getElementById('config-valida-modal');
  if(modal) modal.style.display = 'none';
}

function confirmarValidacionConfig(){
  var inp = document.getElementById('config-valida-cedula');
  var ingresada = (inp ? inp.value : '').trim();
  // Cédula del usuario en sesión, formateada con guiones
  var cedulaSesion = (typeof SESSION !== 'undefined' && SESSION && SESSION.cedula) ? SESSION.cedula : '';
  var cedulaConGuiones = (typeof fmtCed === 'function') ? fmtCed(cedulaSesion) : cedulaSesion;
  // Normalizar ambas (solo dígitos) para comparar, pero exigir que el usuario haya escrito guiones
  var soloDigitosIngresada = ingresada.replace(/[^0-9]/g,'');
  var soloDigitosSesion = String(cedulaSesion).replace(/[^0-9]/g,'');
  var tieneGuiones = ingresada.indexOf('-') >= 0;

  var st = document.getElementById('config-valida-status');
  function vSt(msg, tipo){ if(st){ st.textContent=msg; st.className='status '+tipo; st.style.display='block'; } }

  if(!tieneGuiones){
    vSt('Debes escribir la cédula con guiones (000-0000000-0).', 'err');
    return;
  }
  if(soloDigitosIngresada !== soloDigitosSesion || soloDigitosSesion===''){
    vSt('La cédula no coincide con la del usuario autorizado.', 'err');
    return;
  }
  // Validación correcta → cerrar modal y guardar
  cerrarValidacionConfig();
  ejecutarGuardadoConfig();
}

async function guardarConfigBD(cfg){
  try{
    var r = await fetch(SUPA_URL+'/rest/v1/configuracion', {
      method: 'POST',
      headers: Object.assign({}, SUPA_HEADERS, {'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify({clave:'general', valor:cfg, updated_at:new Date().toISOString()}),
    });
    return r.ok;
  }catch(e){ console.warn('guardarConfigBD error', e); return false; }
}

function resetConfig(){
  window.PROPEEP_CONFIG = JSON.parse(JSON.stringify(CONFIG_DEFAULT));
  try{ localStorage.removeItem(CONFIG_KEY); }catch(e){}
  renderConfigFirmantes();
  renderConfigISR();
  // Guardar los defaults también en BD para que se propague a todos
  guardarConfigBD(window.PROPEEP_CONFIG).then(function(ok){
    cfgSt(ok ? 'Valores por defecto restaurados para todos los usuarios.' : 'Valores restaurados localmente.', 'info');
  });
}

function cfgSt(msg, tipo){
  var el = document.getElementById('config-status');
  if(!el) return;
  el.textContent = msg; el.className='status '+tipo; el.style.display='block';
}

// Mostrar botón de config solo para Victor (llamado desde applyRoleUI)
function mostrarBotonConfig(esVictor){
  var btn = document.getElementById('btn-config');
  if(btn) btn.style.display = esVictor ? 'inline-flex' : 'none';
}

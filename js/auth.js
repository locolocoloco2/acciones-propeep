// ══════════════════════════════════════════
// SESSION
// ══════════════════════════════════════════
let SESSION = null;

function fmtCedula(inp){
  // Tomar solo los dígitos y limitar a 11
  var d = inp.value.replace(/[^0-9]/g,'').slice(0,11);
  var out = d;
  if(d.length > 10){
    // 000-0000000-0
    out = d.slice(0,3) + '-' + d.slice(3,10) + '-' + d.slice(10);
  } else if(d.length > 3){
    // 000-0000000
    out = d.slice(0,3) + '-' + d.slice(3);
  }
  inp.value = out;
}

async function doLogin(){
  const raw = document.getElementById('login-cedula').value.replace(/-/g,'').trim();
  const errEl = document.getElementById('login-err');
  const btnEl = document.getElementById('login-btn');
  if(!raw){ if(errEl){ errEl.textContent='Ingresa tu cédula.'; errEl.style.display='block'; } return; }

  // Estado "cargando"
  if(btnEl){ btnEl.disabled = true; btnEl.dataset.txt = btnEl.textContent; btnEl.textContent = 'Verificando...'; }
  if(errEl) errEl.style.display = 'none';

  try{
    const c = getSupa();
    if(c){
      // 1) Resolver correo a partir de la cédula
      const { data: correo, error: eCorreo } = await c.rpc('correo_por_cedula', { p_cedula: raw });
      if(!eCorreo && correo){
        // 2) Iniciar sesión en Supabase Auth (correo + cédula como contraseña)
        const { data: sess, error: eAuth } = await c.auth.signInWithPassword({ email: correo, password: raw });
        if(!eAuth && sess && sess.user){
          // 3) Obtener el perfil (nombre, rol, cédula)
          const { data: perfil, error: ePerf } = await c.from('perfiles')
            .select('cedula,nombre,rol').eq('id', sess.user.id).single();
          if(!ePerf && perfil){
            const found = { cedula: perfil.cedula, nombre: perfil.nombre, rol: perfil.rol };
            restoreBtn(btnEl);
            enterApp(found);
            saveSession();
            return;
          }
        }
      }
    }
    // ── Respaldo local (si no hay internet o Supabase falla) ──
    const users = _getUsers();
    const found = users.find(u => u.cedula === raw);
    if(found){
      restoreBtn(btnEl);
      enterApp(found);
      saveSession();
      return;
    }
    // Falló todo
    restoreBtn(btnEl);
    if(errEl){ errEl.textContent = 'Cédula no autorizada. Acceso denegado.'; errEl.style.display = 'block'; }
    document.getElementById('login-cedula').value = '';
  }catch(err){
    console.warn('doLogin error', err);
    // Intentar respaldo local ante cualquier excepción
    const users = _getUsers();
    const found = users.find(u => u.cedula === raw);
    restoreBtn(btnEl);
    if(found){ enterApp(found); saveSession(); return; }
    if(errEl){ errEl.textContent = 'No se pudo verificar. Revisa tu conexión e intenta de nuevo.'; errEl.style.display = 'block'; }
  }
}

function restoreBtn(btnEl){
  if(btnEl){ btnEl.disabled = false; if(btnEl.dataset.txt) btnEl.textContent = btnEl.dataset.txt; }
}

function applyRoleUI(){
  const rol = SESSION.rol;
  const tabForm = document.getElementById('tab-form');
  const tabLote = document.getElementById('tab-lote');
  const tabHist = document.getElementById('tab-hist');

  if(rol === 'readonly'){
    tabForm.style.display = 'none';
    tabLote.style.display = 'none';
    tabHist.style.display = 'none';
    const tCH = document.getElementById('tab-certhist'); if(tCH) tCH.style.display = 'none';
    let tabRes = document.getElementById('tab-resumen');
    if(!tabRes){
      tabRes = document.createElement('div');
      tabRes.className = 'tab active';
      tabRes.id = 'tab-resumen';
      tabRes.textContent = 'Resumen por Mes';
      tabRes.onclick = function(){ switchTab('resumen'); };
      document.querySelector('.tabs').appendChild(tabRes);
    }
    tabRes.style.display = '';
    ['form','lote','hist'].forEach(function(id){
      const p = document.getElementById('panel-'+id);
      if(p) p.classList.remove('active');
    });
    document.getElementById('panel-resumen').classList.add('active');
    const sel = document.getElementById('res-year');
    sel.innerHTML = '';
    const yr = new Date().getFullYear();
    for(let y=yr; y>=yr-3; y--){
      sel.innerHTML += '<option value="'+y+'"'+(y===yr?' selected':'')+'>'+y+'</option>';
    }
    renderResumen();
  } else if(rol === 'vacperm'){
    tabLote.style.display = 'none';
  } else {
    tabForm.style.display = '';
    tabLote.style.display = '';
    tabHist.style.display = '';
    const tCH2 = document.getElementById('tab-certhist'); if(tCH2) tCH2.style.display = '';
    const tabRes = document.getElementById('tab-resumen');
    if(tabRes) tabRes.style.display = 'none';
  }
  // Pestañas especiales
  const _vk=atob('MjIzMDEyNTU2MDQ=');
  const _isV=(SESSION && SESSION.cedula===_vk);
  const tabISR = document.getElementById('tab-isr');
  if(tabISR) tabISR.style.display = _isV ? '' : 'none';
  const tabRegalia = document.getElementById('tab-regalia');
  if(tabRegalia) tabRegalia.style.display = _isV ? '' : 'none';

  const tabRep = document.getElementById('tab-reporte');
  if(tabRep) tabRep.style.display = _isV ? '' : 'none';
  const tabNP = document.getElementById('tab-nominapdf');
  if(tabNP) tabNP.style.display = _isV ? '' : 'none';
  if(typeof mostrarBotonConfig === 'function') mostrarBotonConfig(_isV);
  // Ocultar secciones del menú sin módulos visibles
  document.querySelectorAll('.nav-section').forEach(function(sec){
    const visible = Array.from(sec.querySelectorAll('.tab')).some(function(t){ return t.style.display !== 'none'; });
    sec.style.display = visible ? '' : 'none';
  });
}

function doLogout(){
  clearSession();
  SESSION = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-cedula').value = '';
  histData = [];
  const tabRes = document.getElementById('tab-resumen');
  if(tabRes){ tabRes.style.display = 'none'; tabRes.classList.remove('active'); }
  ['form','lote','hist'].forEach(function(id){
    const t = document.getElementById('tab-'+id);
    if(t){ t.style.display=''; t.classList.remove('active'); }
    const p = document.getElementById('panel-'+id);
    if(p) p.classList.remove('active');
  });
  document.getElementById('tab-form').classList.add('active');
  document.getElementById('panel-form').classList.add('active');
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
}
function switchTab(t){
  closeSidebar();
  ['form','lote','hist','cert','certhist','isr','reporte','nominapdf','regalia','resumen'].forEach(function(id){
    const tab = document.getElementById('tab-'+id);
    const panel = document.getElementById('panel-'+id);
    if(tab) tab.classList.toggle('active', id===t);
    if(panel) panel.classList.toggle('active', id===t);
  });
  if(t==='hist') loadHist();
  if(t==='certhist') loadCertHist();
  if(t==='resumen') renderResumen();
}


// ── Persistencia de sesión: 30 min deslizantes ──
const SESSION_KEY = 'propeep_session';
const SESSION_MIN = 30;

function enterApp(found){
  SESSION = found;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-name-badge').textContent = found.nombre;
  const roles = {'admin':'Administrador','vacperm':'Vacaciones y Permisos','readonly':'Solo lectura'};
  const rb = document.getElementById('user-role-badge');
  if(rb) rb.textContent = roles[found.rol]||found.rol;
  document.getElementById('login-err').style.display = 'none';
  applyRoleUI();
  applyNatRestrictions();
  loadHist();
  // Recargar configuración compartida desde la base de datos
  if(typeof cargarConfigBD === 'function') cargarConfigBD();
}

function saveSession(){
  if(!SESSION) return;
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify({u:SESSION, exp:Date.now()+SESSION_MIN*60000})); }catch(e){}
}

function restoreSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !s.u || Date.now() > s.exp){ localStorage.removeItem(SESSION_KEY); return false; }
    SESSION = s.u;
    saveSession();
    return true;
  }catch(e){ return false; }
}

function clearSession(){
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
  // Cerrar sesión en Supabase Auth también
  try{ var c = getSupa(); if(c) c.auth.signOut(); }catch(e){}
}

document.addEventListener('click', function(){ if(SESSION) saveSession(); });

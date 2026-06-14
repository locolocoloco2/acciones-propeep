// ══════════════════════════════════════════
// ACTUALIZAR NÓMINA MENSUAL (solo Víctor)
// Carga "Relación de Personal Administrativo" y reemplaza nomina_mayo2026
// ══════════════════════════════════════════

var cmData = [];  // empleados parseados del Excel

function cmHandle(input){ if(input.files && input.files.length) cmLoad(input.files[0]); }
function cmOnDrop(e){
  e.preventDefault();
  document.getElementById('cm-zona').classList.remove('over');
  if(e.dataTransfer && e.dataTransfer.files.length) cmLoad(e.dataTransfer.files[0]);
}

function cmSt(id, msg, tipo){
  var el = document.getElementById('cm-'+id);
  if(!el) return;
  el.textContent = msg; el.className = 'status '+tipo; el.style.display='block';
}

// Convierte fecha de Excel/ISO a DD/MM/AAAA
function cmFecha(v){
  if(!v) return '';
  var s = String(v).trim();
  // ISO "2025-08-01 00:00:00" o "2025-08-01"
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[3]+'/'+m[2]+'/'+m[1];
  // Número serial de Excel
  if(/^\d+$/.test(s)){
    var n = parseInt(s);
    if(n > 30000 && n < 60000){
      var d = new Date(Math.round((n - 25569) * 86400 * 1000));
      var dd = String(d.getUTCDate()).padStart(2,'0');
      var mm = String(d.getUTCMonth()+1).padStart(2,'0');
      return dd+'/'+mm+'/'+d.getUTCFullYear();
    }
  }
  return s;
}

function cmLoad(file){
  document.getElementById('cm-label').textContent = 'Cargando '+file.name+'...';
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:false});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var all = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      // Buscar fila de cabecera (la que tiene CEDULA)
      var hi = all.findIndex(function(r){
        return r.some(function(c){ return String(c).toUpperCase().indexOf('CEDULA')>=0; });
      });
      if(hi<0) hi=0;
      // Mapear índices por nombre de columna (robusto al orden)
      var head = all[hi].map(function(c){ return String(c).toUpperCase().trim(); });
      function col(name){ return head.findIndex(function(h){ return h.indexOf(name)>=0; }); }
      var iCed = col('CEDULA'), iNom = col('NOMBRE'), iSexo = col('SEXO'),
          iPue = col('PUESTO'), iIng = col('INGRESO'), iDep = col('DEPARTAMENTO'),
          iSue = col('SUELDO');

      cmData = [];
      all.slice(hi+1).forEach(function(r){
        var ced = String(r[iCed]||'').replace(/[^0-9]/g,'');
        if(!ced) return;
        cmData.push({
          cedula: ced,
          nombre: String(r[iNom]||'').trim().toUpperCase(),
          sexo: String(r[iSexo]||'').trim().toUpperCase(),
          puesto: String(r[iPue]||'').trim().toUpperCase(),
          fecha_ingreso: cmFecha(r[iIng]),
          departamento: String(r[iDep]||'').trim().toUpperCase(),
          sueldo: parseFloat(String(r[iSue]||'').replace(/[^0-9.]/g,''))||0,
        });
      });

      if(!cmData.length){ cmSt('status','No se encontraron empleados válidos en el archivo.','err'); return; }

      document.getElementById('cm-label').textContent = file.name+' — '+cmData.length+' empleados';
      document.getElementById('cm-zona').style.borderColor='var(--azul)';
      document.getElementById('cm-zona').style.background='var(--azul-claro)';
      cmRenderPreview();
      document.getElementById('cm-preview').style.display='block';
      cmSt('status', cmData.length+' empleados cargados. Revisa la vista previa antes de reemplazar.','ok');
    }catch(err){ cmSt('status','Error al leer: '+err.message,'err'); }
  };
  reader.readAsArrayBuffer(file);
}

function cmRenderPreview(){
  // Tarjetas resumen
  var totalSueldo = cmData.reduce(function(t,e){ return t+(e.sueldo||0); },0);
  var deptos = {};
  cmData.forEach(function(e){ deptos[e.departamento] = (deptos[e.departamento]||0)+1; });
  var cards = [
    ['Empleados', String(cmData.length), 'var(--azul)'],
    ['Departamentos', String(Object.keys(deptos).length), 'var(--azul)'],
    ['Masa Salarial', 'RD$ '+totalSueldo.toLocaleString('es-DO'), '#155C30'],
  ];
  document.getElementById('cm-resumen').innerHTML = cards.map(function(c){
    return '<div style="background:var(--gris);border:1px solid var(--gris2);border-radius:var(--radio);padding:13px 15px">'+
      '<div style="font-size:9px;font-weight:700;color:var(--texto2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px">'+c[0]+'</div>'+
      '<div style="font-size:15px;font-weight:600;color:'+c[2]+'">'+c[1]+'</div></div>';
  }).join('');

  // Tabla (primeros 100 para no saturar)
  var muestra = cmData.slice(0,100);
  var html = '<table><thead><tr><th>Cédula</th><th>Nombre</th><th>Sexo</th><th>Puesto</th><th>Depto.</th><th>Ingreso</th><th>Sueldo</th></tr></thead><tbody>';
  muestra.forEach(function(e){
    html += '<tr>';
    html += '<td>'+fmtCed(e.cedula)+'</td>';
    html += '<td><strong>'+e.nombre+'</strong></td>';
    html += '<td>'+(e.sexo||'—')+'</td>';
    html += '<td>'+(e.puesto||'—')+'</td>';
    html += '<td>'+(e.departamento||'—')+'</td>';
    html += '<td>'+(e.fecha_ingreso||'—')+'</td>';
    html += '<td>RD$ '+(e.sueldo||0).toLocaleString('es-DO')+'</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  if(cmData.length>100) html += '<div style="padding:8px;font-size:11px;color:var(--texto2)">Mostrando 100 de '+cmData.length+' empleados.</div>';
  document.getElementById('cm-tabla').innerHTML = html;
}

// Reemplazar nómina: borra todo y vuelve a insertar
async function cmConfirmar(){
  if(!cmData.length){ cmSt('confirm-status','No hay datos para guardar.','err'); return; }
  if(!confirm('Esto reemplazará TODA la nómina actual con '+cmData.length+' empleados. ¿Continuar?')) return;

  cmSt('confirm-status','Reemplazando nómina... no cierres la ventana.','info');
  var headers = (typeof refrescarHeadersAuth==='function') ? (await refrescarHeadersAuth(), SUPA_HEADERS) : SUPA_HEADERS;

  try{
    // 1) Borrar toda la nómina actual
    var del = await fetch(SUPA_URL+'/rest/v1/nomina_mayo2026?cedula=neq.__none__', {
      method:'DELETE',
      headers: Object.assign({}, SUPA_HEADERS, {'Prefer':'return=minimal'}),
    });
    if(!del.ok && del.status!==404){
      var t = await del.text();
      cmSt('confirm-status','Error al limpiar la nómina anterior (código '+del.status+'). '+t.slice(0,120),'err');
      return;
    }

    // 2) Insertar en lotes de 200
    var ok = true, insertados = 0;
    for(var i=0;i<cmData.length;i+=200){
      var lote = cmData.slice(i,i+200);
      var r = await fetch(SUPA_URL+'/rest/v1/nomina_mayo2026', {
        method:'POST',
        headers: Object.assign({}, SUPA_HEADERS, {'Prefer':'return=minimal'}),
        body: JSON.stringify(lote),
      });
      if(r.ok){ insertados += lote.length; }
      else { ok=false; var et = await r.text(); console.warn('Insert lote error', et); break; }
      cmSt('confirm-status','Insertando... '+insertados+' / '+cmData.length,'info');
    }

    if(ok){
      // Refrescar la nómina en memoria para que el buscador la use de inmediato
      if(typeof cargarNominaLive==='function') await cargarNominaLive();
      cmSt('confirm-status','Nómina actualizada correctamente: '+insertados+' empleados. El buscador de Certificaciones ya usa la nueva nómina.','ok');
    }else{
      cmSt('confirm-status','Se insertaron '+insertados+' de '+cmData.length+'. Hubo un error; revisa la consola.','err');
    }
  }catch(e){
    cmSt('confirm-status','Error: '+e.message,'err');
  }
}

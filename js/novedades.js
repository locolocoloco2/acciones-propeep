// ══════════════════════════════════════════
// NOVEDADES DE NÓMINA — Comparativo entre períodos
// ══════════════════════════════════════════

const NOV_COLS = ['nomina','cedula','nombre','cargo','sueldo_bruto','isr','inabi',
  'ss_emp','sfs_emp','sfs_empl','ss_empl','dep_adic','riesgo',
  'total_desc','sueldo_neto'];

let novDataA = {}; // período anterior
let novDataB = {}; // período nuevo
let novFilesA = 0;
let novFilesB = 0;
let novResultado = null;

// ── Parsing ──
function novParseFile(file){
  return new Promise(function(resolve){
    const reader = new FileReader();
    reader.onload = function(e){
      try{
        const wb = XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:false});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        // Buscar fila de cabeceras (la que tiene 'cedula' o 'Empleado')
        let hi = allRows.findIndex(function(r){
          return r.some(function(c){ return String(c).toLowerCase().includes('cedula'); });
        });
        if(hi < 0) hi = 3; // fallback fila 4 (index 3)
        const rows = allRows.slice(hi+1);
        const result = {};
        rows.forEach(function(r){
          if(!r[1]) return;
          const cedula = String(r[1]).trim().replace(/\s/g,'');
          if(!cedula) return;
          const obj = {
            nomina:     String(r[0]||'').trim(),
            cedula:     cedula,
            nombre:     String(r[2]||'').trim(),
            cargo:      String(r[3]||'').trim(),
            sueldo_bruto: parseFloat(r[4])||0,
            isr:        parseFloat(r[5])||0,
            inabi:      parseFloat(r[6])||0,
            ss_emp:     parseFloat(r[7])||0,
            sfs_emp:    parseFloat(r[8])||0,
            sfs_empl:   parseFloat(r[9])||0,
            ss_empl:    parseFloat(r[10])||0,
            dep_adic:   parseFloat(r[11])||0,
            riesgo:     parseFloat(r[12])||0,
            total_desc: parseFloat(r[13])||0,
            sueldo_neto:parseFloat(r[14])||0,
            archivo:    file.name,
          };
          result[cedula] = obj;
        });
        resolve(result);
      }catch(err){ console.warn('Error leyendo', file.name, err); resolve({}); }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Drag & Drop ──
function novOnDrop(e, lado){
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('nov-zona-'+lado).classList.remove('over');
  var files = e.dataTransfer ? e.dataTransfer.files : null;
  if(files && files.length) novLoadFiles(files, lado);
}

function novLoadFiles(files, lado){
  if(!files || !files.length) return;
  // Convert FileList to plain array
  var arr = [];
  for(var i=0; i<files.length; i++) arr.push(files[i]);

  // Show loading state immediately
  var zona   = document.getElementById('nov-zona-'+lado);
  var label  = document.getElementById('nov-label-'+lado);
  var lista  = document.getElementById('nov-lista-'+lado);
  label.textContent = 'Cargando '+arr.length+' archivo(s)...';
  zona.style.borderColor = '#92400E';
  lista.innerHTML = '';

  // Parse files sequentially using recursive index approach (no for...of)
  var merged = {};
  function parseNext(idx){
    if(idx >= arr.length){
      // All done
      if(lado === 'a'){
        novDataA = merged;
        novFilesA = arr.length;
      } else {
        novDataB = merged;
        novFilesB = arr.length;
      }
      var n = Object.keys(merged).length;
      label.textContent = arr.length+' archivo(s) · '+n+' empleados cargados';
      zona.style.borderColor = 'var(--azul)';
      zona.style.background  = 'var(--azul-claro)';
      lista.innerHTML = arr.map(function(f){
        return '<div style="color:var(--ok)">&#x2713; '+f.name+'</div>';
      }).join('');
      // Enable compare button if both sides loaded
      var btn = document.getElementById('nov-btn-comparar');
      if(btn && Object.keys(novDataA).length>0 && Object.keys(novDataB).length>0){
        btn.disabled = false;
        btn.style.opacity = '1';
      }
      return;
    }
    novParseFile(arr[idx]).then(function(data){
      Object.assign(merged, data);
      label.textContent = 'Procesando '+(idx+1)+'/'+arr.length+'...';
      parseNext(idx+1);
    });
  }
  parseNext(0);
}

// ── Comparar ──
function novComparar(){
  const A = novDataA, B = novDataB;
  const ingresos = [], salidas = [], cambios = [], iguales = [];

  // Ingresos: en B pero no en A
  Object.keys(B).forEach(function(c){
    if(!A[c]) ingresos.push(B[c]);
  });
  // Salidas: en A pero no en B
  Object.keys(A).forEach(function(c){
    if(!B[c]) salidas.push(A[c]);
  });
  // Cambios / Permanentes
  Object.keys(A).forEach(function(c){
    if(!B[c]) return;
    const a = A[c], b = B[c];
    if(Math.abs(a.sueldo_bruto - b.sueldo_bruto) > 0.01 || a.cargo !== b.cargo){
      cambios.push({antes: a, despues: b});
    } else {
      iguales.push(b);
    }
  });

  novResultado = {ingresos, salidas, cambios, iguales};

  // Tarjetas de resumen
  function sumar(arr){ return arr.reduce(function(s,e){ return s + (e.sueldo_bruto||0); }, 0); }
  const cards = document.getElementById('nov-cards');
  cards.innerHTML = novCard('Ingresos', ingresos.length, sumar(ingresos), '#EEF7F1', '#155C30') +
    novCard('Salidas', salidas.length, sumar(salidas), '#FBF0F2', '#9E1B32') +
    novCard('Cambios', cambios.length, sumar(cambios.map(function(c){return c.despues;})) - sumar(cambios.map(function(c){return c.antes;})), '#FEF3C7', '#92400E', true);

  // Renderizar paneles
  novRenderTabla('ingresos', ingresos, ['Cédula','Nombre','Cargo','Sueldo Bruto','ISR','INABI','TSS Emp.','TSS Empl.','Dep. Adic.','Riesgo','Sueldo Neto'], function(e){
    return [fmtCed(e.cedula), e.nombre, e.cargo,
      e.sueldo_bruto, e.isr, e.inabi,
      e.ss_emp+e.sfs_emp, e.ss_empl+e.sfs_empl,
      e.dep_adic, e.riesgo, e.sueldo_neto];
  });
  novRenderTabla('salidas', salidas, ['Cédula','Nombre','Cargo','Sueldo Bruto','ISR','INABI','TSS Emp.','TSS Empl.','Dep. Adic.','Riesgo','Sueldo Neto'], function(e){
    return [fmtCed(e.cedula), e.nombre, e.cargo,
      e.sueldo_bruto, e.isr, e.inabi,
      e.ss_emp+e.sfs_emp, e.ss_empl+e.sfs_empl,
      e.dep_adic, e.riesgo, e.sueldo_neto];
  });
  novRenderCambios(cambios);
  novRenderResumen(ingresos, salidas, cambios, iguales);

  document.getElementById('nov-results').style.display = 'block';
  novTab('ingresos');
}

function novCard(titulo, n, monto, bgColor, fgColor, esDiff){
  const fmt = Math.abs(monto).toLocaleString('es-DO',{minimumFractionDigits:2});
  const prefijo = esDiff ? (monto>=0?'+':'-') : '';
  return `<div style="background:${bgColor};border:1px solid ${fgColor}33;border-radius:var(--radio);padding:16px 18px">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${fgColor};margin-bottom:6px">${titulo}</div>
    <div style="font-size:18px;font-weight:700;color:${fgColor}">${n} empleado${n!==1?'s':''}</div>
    <div style="font-size:12px;color:${fgColor};opacity:.8;margin-top:2px">${prefijo}RD$ ${fmt}</div>
  </div>`;
}

const PESO_COLS_NOV = new Set([4,5,6,7,8,9,10,11]); // 1-indexed

function novRenderTabla(panel, rows, hdrs, getRow){
  const div = document.getElementById('nov-panel-'+panel);
  if(!rows.length){
    div.innerHTML = '<div class="hist-loading">Sin registros.</div>';
    return;
  }
  const sorted = rows.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });
  let html = '<div class="table-wrap"><table><thead><tr>'+hdrs.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>';
  sorted.forEach(function(e,i){
    const vals = getRow(e);
    html += '<tr>'+vals.map(function(v,ci){
      if(typeof v === 'number'){
        return '<td style="text-align:right">'+v.toLocaleString('es-DO',{minimumFractionDigits:2})+'</td>';
      }
      return '<td>'+(v||'—')+'</td>';
    }).join('')+'</tr>';
  });
  // Totales
  const numCols = hdrs.length;
  html += '<tr style="background:var(--azul);color:#fff;font-weight:700">';
  html += '<td colspan="3">TOTAL ('+rows.length+' empleados)</td>';
  for(let ci=4; ci<=numCols; ci++){
    const sum = rows.reduce(function(s,e){ const v=getRow(e)[ci-1]; return s+(typeof v==='number'?v:0); },0);
    html += '<td style="text-align:right">'+sum.toLocaleString('es-DO',{minimumFractionDigits:2})+'</td>';
  }
  html += '</tr></tbody></table></div>';
  div.innerHTML = html;
}

function novRenderCambios(cambios){
  const div = document.getElementById('nov-panel-cambios');
  if(!cambios.length){ div.innerHTML='<div class="hist-loading">Sin cambios registrados.</div>'; return; }
  let html = '<div class="table-wrap"><table><thead><tr><th>Cédula</th><th>Nombre</th><th>Cargo Anterior</th><th>Cargo Nuevo</th><th>Sueldo Anterior</th><th>Sueldo Nuevo</th><th>Diferencia</th></tr></thead><tbody>';
  cambios.sort(function(a,b){ return a.antes.nombre.localeCompare(b.antes.nombre); }).forEach(function(c){
    const diff = c.despues.sueldo_bruto - c.antes.sueldo_bruto;
    const color = diff>0?'#155C30':diff<0?'#9E1B32':'inherit';
    const bg = diff>0?'#EEF7F1':diff<0?'#FBF0F2':'';
    html += `<tr${bg?' style="background:'+bg+'"':''}>
      <td>${fmtCed(c.antes.cedula)}</td>
      <td><strong>${c.antes.nombre}</strong></td>
      <td>${c.antes.cargo}</td>
      <td>${c.despues.cargo}</td>
      <td style="text-align:right">${c.antes.sueldo_bruto.toLocaleString('es-DO',{minimumFractionDigits:2})}</td>
      <td style="text-align:right">${c.despues.sueldo_bruto.toLocaleString('es-DO',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:${color};font-weight:600">${diff>=0?'+':''}${diff.toLocaleString('es-DO',{minimumFractionDigits:2})}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function novRenderResumen(ingresos, salidas, cambios, iguales){
  const div = document.getElementById('nov-panel-resumen');

  function sumRow(arr, label, color){
    if(!arr.length) return '';
    function s(fn){ return arr.reduce(function(t,e){ return t+fn(e); },0); }
    function f(n){ return n.toLocaleString('es-DO',{minimumFractionDigits:2}); }
    return `<tr style="color:${color}">
      <td><strong>${label} (${arr.length})</strong></td>
      <td style="text-align:right">${f(s(function(e){return e.sueldo_bruto;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.isr;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.inabi;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.ss_emp+e.sfs_emp;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.ss_empl+e.sfs_empl;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.dep_adic;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.riesgo;}))}</td>
      <td style="text-align:right"><strong>${f(s(function(e){return e.sueldo_neto;}))}</strong></td>
    </tr>`;
  }

  const allB = ingresos.concat(cambios.map(function(c){return c.despues;})).concat(iguales);
  const allA = salidas.concat(cambios.map(function(c){return c.antes;})).concat(iguales);

  function totalRow(arr, label){
    function s(fn){ return arr.reduce(function(t,e){ return t+fn(e); },0); }
    function f(n){ return n.toLocaleString('es-DO',{minimumFractionDigits:2}); }
    return `<tr style="background:var(--azul);color:#fff;font-weight:700">
      <td>${label} (${arr.length})</td>
      <td style="text-align:right">${f(s(function(e){return e.sueldo_bruto;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.isr;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.inabi;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.ss_emp+e.sfs_emp;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.ss_empl+e.sfs_empl;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.dep_adic;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.riesgo;}))}</td>
      <td style="text-align:right">${f(s(function(e){return e.sueldo_neto;}))}</td>
    </tr>`;
  }

  let html = `<div class="table-wrap"><table>
    <thead><tr><th>Concepto</th><th>Sueldo Bruto</th><th>ISR</th><th>Seg. Vida INABI</th><th>TSS Empleado</th><th>TSS Empleador</th><th>Dep. Adicional</th><th>Riesgo Lab.</th><th>Sueldo Neto</th></tr></thead>
    <tbody>`;

  html += sumRow(ingresos, 'Ingresos', '#155C30');
  html += sumRow(salidas, 'Salidas', '#9E1B32');
  html += sumRow(cambios.map(function(c){return c.antes;}), 'Cambios — Antes', '#92400E');
  html += sumRow(cambios.map(function(c){return c.despues;}), 'Cambios — Después', '#92400E');
  html += '<tr><td colspan="9" style="height:4px;background:var(--gris2)"></td></tr>';
  html += totalRow(allA, 'Total Período Anterior');
  html += totalRow(allB, 'Total Período Nuevo');

  // Fila de diferencia neta
  function diffRow(){
    function sA(fn){ return allA.reduce(function(t,e){ return t+fn(e); },0); }
    function sB(fn){ return allB.reduce(function(t,e){ return t+fn(e); },0); }
    function fd(fn){ const d=sB(fn)-sA(fn); return (d>=0?'+':'')+d.toLocaleString('es-DO',{minimumFractionDigits:2}); }
    return `<tr style="background:var(--gris);font-weight:700;font-size:11px">
      <td>Variación Neta</td>
      <td style="text-align:right">${fd(function(e){return e.sueldo_bruto;})}</td>
      <td style="text-align:right">${fd(function(e){return e.isr;})}</td>
      <td style="text-align:right">${fd(function(e){return e.inabi;})}</td>
      <td style="text-align:right">${fd(function(e){return e.ss_emp+e.sfs_emp;})}</td>
      <td style="text-align:right">${fd(function(e){return e.ss_empl+e.sfs_empl;})}</td>
      <td style="text-align:right">${fd(function(e){return e.dep_adic;})}</td>
      <td style="text-align:right">${fd(function(e){return e.riesgo;})}</td>
      <td style="text-align:right">${fd(function(e){return e.sueldo_neto;})}</td>
    </tr>`;
  }
  html += diffRow();
  html += '</tbody></table></div>';
  div.innerHTML = html;
}

// ── Tabs internos ──
function novTab(tab){
  ['ingresos','salidas','cambios','resumen'].forEach(function(t){
    document.getElementById('nov-panel-'+t).style.display = t===tab?'block':'none';
  });
  document.querySelectorAll('.nov-itab').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('onclick').includes("'"+tab+"'"));
  });
}

// ── Reset ──
function novReset(){
  novDataA={}; novDataB={}; novFilesA=0; novFilesB=0; novResultado=null;
  ['a','b'].forEach(function(l){
    document.getElementById('nov-label-'+l).textContent='Arrastra 1 o más archivos Excel';
    document.getElementById('nov-zona-'+l).style.borderColor='';
    document.getElementById('nov-zona-'+l).style.background='';
    document.getElementById('nov-lista-'+l).innerHTML='';
    document.getElementById('nov-fi-'+l).value='';
  });
  document.getElementById('nov-btn-comparar').disabled=true;
  document.getElementById('nov-results').style.display='none';
  document.getElementById('nov-status').style.display='none';
}

// ── Exportar Excel ──
function novExportar(){
  if(!novResultado) return;
  const {ingresos, salidas, cambios, iguales} = novResultado;
  const wb = XLSX.utils.book_new();

  function toRows(arr, tipo){
    return arr.map(function(e){
      return {'Tipo':tipo,'Cédula':fmtCed(e.cedula),'Nombre':e.nombre,'Cargo':e.cargo,
        'Sueldo Bruto':e.sueldo_bruto,'ISR':e.isr,'Seg. Vida INABI':e.inabi,
        'TSS Empleado':e.ss_emp+e.sfs_emp,'TSS Empleador':e.ss_empl+e.sfs_empl,
        'Dep. Adicional':e.dep_adic,'Riesgo Lab.':e.riesgo,'Sueldo Neto':e.sueldo_neto};
    });
  }

  // Hoja 1: Novedades
  const nov = toRows(ingresos,'Ingreso').concat(
    toRows(salidas,'Salida')).concat(
    cambios.map(function(c){ return Object.assign(toRows([c.despues],'Cambio')[0],
      {'Cargo Anterior':c.antes.cargo,'Sueldo Anterior':c.antes.sueldo_bruto,
       'Diferencia':c.despues.sueldo_bruto-c.antes.sueldo_bruto}); }));
  const ws1 = XLSX.utils.json_to_sheet(nov);
  XLSX.utils.book_append_sheet(wb, ws1, 'Novedades');

  // Hoja 2: Resumen
  const allB = ingresos.concat(cambios.map(function(c){return c.despues;})).concat(iguales);
  const allA = salidas.concat(cambios.map(function(c){return c.antes;})).concat(iguales);
  function sumObj(arr, label){
    function s(fn){ return arr.reduce(function(t,e){ return t+fn(e); },0); }
    return {'Concepto':label,'Empleados':arr.length,
      'Sueldo Bruto':s(function(e){return e.sueldo_bruto;}),
      'ISR':s(function(e){return e.isr;}),
      'Seg. Vida INABI':s(function(e){return e.inabi;}),
      'TSS Empleado':s(function(e){return e.ss_emp+e.sfs_emp;}),
      'TSS Empleador':s(function(e){return e.ss_empl+e.sfs_empl;}),
      'Dep. Adicional':s(function(e){return e.dep_adic;}),
      'Riesgo Lab.':s(function(e){return e.riesgo;}),
      'Sueldo Neto':s(function(e){return e.sueldo_neto;})};
  }
  const resumen = [
    sumObj(ingresos,'Ingresos'),
    sumObj(salidas,'Salidas'),
    sumObj(cambios.map(function(c){return c.antes;}),'Cambios — Antes'),
    sumObj(cambios.map(function(c){return c.despues;}),'Cambios — Después'),
    sumObj(allA,'Total Período Anterior'),
    sumObj(allB,'Total Período Nuevo'),
  ];
  const ws2 = XLSX.utils.json_to_sheet(resumen);
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen Financiero');

  XLSX.writeFile(wb, 'Novedades_Nomina_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

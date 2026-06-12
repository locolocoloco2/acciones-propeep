// ══════════════════════════════════════════
// CALCULADORA ISR
// ══════════════════════════════════════════
const ISR_TRAMOS=[{inf:0,sup:34685,tasa:0},{inf:34685.01,sup:52027.42,tasa:0.15},
  {inf:52027.43,sup:72260.25,tasa:0.2},{inf:72260.26,sup:Infinity,tasa:0.25}];
const ISR_AFP=0.0287, ISR_ARS=0.0304, ISR_AFP_T=13330, ISR_ARS_T=7059.79;

function isrRound(n){ return Math.round(n*100)/100; }
function isrFmt(n){ return n.toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function isrCalcISR(base){
  let t=0;
  for(const tr of ISR_TRAMOS){
    if(base<=tr.inf) break;
    t+=(Math.min(base,tr.sup)-tr.inf)*tr.tasa;
  }
  return isrRound(t);
}

function isrCalcEmpleado(sueldo, incentivo){
  if(sueldo===0 && incentivo>0){
    const isr=isrCalcISR(incentivo);
    return {tss:0,isrSueldo:0,isrIncentivo:isr,isrTotal:isr,netoSueldo:0,netoIncentivo:isrRound(incentivo-isr),netoTotal:isrRound(incentivo-isr)};
  }
  const afp=Math.min(isrRound(ISR_AFP*sueldo),ISR_AFP_T);
  const ars=Math.min(isrRound(ISR_ARS*sueldo),ISR_ARS_T);
  const tss=isrRound(afp+ars);
  const base=isrRound(sueldo-tss);
  const isrS=isrCalcISR(base);
  const combined=isrRound(base+incentivo);
  const isrTotal=isrCalcISR(combined);
  const isrI=isrRound(isrTotal-isrS);
  const netoS=isrRound(sueldo-tss-isrS);
  const netoI=isrRound(incentivo-isrI);
  return {tss,isrSueldo:isrS,isrIncentivo:isrI,isrTotal,netoSueldo:netoS,netoIncentivo:netoI,netoTotal:isrRound(netoS+netoI)};
}

let isrData=[];

function isrOnDrop(e){
  e.preventDefault();
  document.getElementById('isr-drop').classList.remove('over');
  const f=e.dataTransfer.files[0]; if(f) isrLoadFile(f);
}

function isrLoadFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){ isrShowError('Archivo vacío.'); return; }
      const keys=Object.keys(rows[0]);
      function fk(opts){ return keys.find(function(k){ return opts.some(function(o){ return k.trim().toUpperCase().includes(o); }); })||null; }
      const kS=fk(['SUELDO','SALARIO','SALARY']);
      const kI=fk(['INCENTIVO','BONO','BONUS','INCENTIVE']);
      if(!kS||!kI){ isrShowError('No se encontraron columnas SUELDO e INCENTIVO.'); return; }
      const kId=fk(['ID']);
      const kCed=fk(['CEDULA','CÉDULA','CED']);
      const kNom=fk(['NOMBRE','NAME','EMPLEADO']);
      const kCar=fk(['CARGO','PUESTO','POSITION']);
      const kDep=fk(['DEPARTAMENTO','DEPTO','AREA','ÁREA']);
      isrData=rows.map(function(r,i){
        const s=parseFloat(r[kS])||0;
        const inc=parseFloat(r[kI])||0;
        return Object.assign({
          id:kId?String(r[kId]):String(i+1),
          cedula:kCed?String(r[kCed]):'',
          nombre:kNom?String(r[kNom]):'Empleado '+(i+1),
          cargo:kCar?String(r[kCar]):'',
          depto:kDep?String(r[kDep]):'',
          sueldo:s, incentivo:inc
        }, isrCalcEmpleado(s,inc));
      });
      document.getElementById('isr-error').style.display='none';
      isrRenderResults();
    }catch(err){ isrShowError('Error al leer: '+err.message); }
  };
  reader.readAsArrayBuffer(file);
}

function isrShowError(msg){
  const el=document.getElementById('isr-error');
  el.textContent='Aviso: '+msg; el.style.display='block';
}

function isrReset(){
  isrData=[];
  document.getElementById('isr-results').style.display='none';
  document.getElementById('isr-fi').value='';
  document.getElementById('isr-error').style.display='none';
}

function isrRenderResults(){
  if(!isrData.length) return;
  const totalS=isrData.reduce(function(a,r){return a+r.sueldo;},0);
  const totalI=isrData.reduce(function(a,r){return a+r.incentivo;},0);
  const totalTSS=isrData.reduce(function(a,r){return a+r.tss;},0);
  const totalISR=isrData.reduce(function(a,r){return a+r.isrTotal;},0);
  const totalNeto=isrData.reduce(function(a,r){return a+r.netoTotal;},0);

  document.getElementById('isr-count').textContent='('+isrData.length+' empleados)';
  document.getElementById('isr-stats').innerHTML=
    '<div class="card" style="background:var(--gris);border-radius:7px;padding:12px"><div style="font-size:10px;font-weight:700;color:#646e7e;text-transform:uppercase;margin-bottom:4px">Bruto Total</div><div style="font-size:15px;font-weight:700;color:var(--azul)">RD$'+isrFmt(totalS+totalI)+'</div></div>'+
    '<div class="card" style="background:var(--gris);border-radius:7px;padding:12px"><div style="font-size:10px;font-weight:700;color:#646e7e;text-transform:uppercase;margin-bottom:4px">Retenciones (TSS+ISR)</div><div style="font-size:15px;font-weight:700;color:#9e1b32">RD$'+isrFmt(totalTSS+totalISR)+'</div></div>'+
    '<div class="card" style="background:var(--gris);border-radius:7px;padding:12px"><div style="font-size:10px;font-weight:700;color:#646e7e;text-transform:uppercase;margin-bottom:4px">Neto Total</div><div style="font-size:15px;font-weight:700;color:#1e6b3c">RD$'+isrFmt(totalNeto)+'</div></div>';

  let html='<table><thead><tr><th>#</th><th>Cédula</th><th>Nombre</th><th>Cargo</th><th>Depto</th><th>Sueldo</th><th>Incentivo</th><th>TSS</th><th>ISR Sueldo</th><th>ISR Incentivo</th><th>ISR Total</th><th>Neto Sueldo</th><th>Neto Incentivo</th><th style="color:#4ade80">Neto Total</th></tr></thead><tbody>';
  isrData.forEach(function(r){
    html+='<tr>';
    html+='<td>'+r.id+'</td>';
    html+='<td>'+fmtCed(r.cedula)+'</td>';
    html+='<td><strong>'+r.nombre+'</strong></td>';
    html+='<td>'+r.cargo+'</td>';
    html+='<td>'+r.depto+'</td>';
    html+='<td>'+isrFmt(r.sueldo)+'</td>';
    html+='<td>'+isrFmt(r.incentivo)+'</td>';
    html+='<td style="color:#9e1b32">'+isrFmt(r.tss)+'</td>';
    html+='<td style="color:#9e1b32">'+isrFmt(r.isrSueldo)+'</td>';
    html+='<td style="color:#9e1b32">'+isrFmt(r.isrIncentivo)+'</td>';
    html+='<td style="color:#9e1b32;font-weight:700">'+isrFmt(r.isrTotal)+'</td>';
    html+='<td>'+isrFmt(r.netoSueldo)+'</td>';
    html+='<td>'+isrFmt(r.netoIncentivo)+'</td>';
    html+='<td style="color:#1e6b3c;font-weight:700">'+isrFmt(r.netoTotal)+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table>';
  document.getElementById('isr-table').innerHTML=html;
  document.getElementById('isr-results').style.display='block';
}

function isrDescargar(){
  if(!isrData.length) return;
  const rows=isrData.map(function(r){
    return {'ID':r.id,'Cédula':fmtCed(r.cedula),'Nombre':r.nombre,'Cargo':r.cargo,'Departamento':r.depto,
      'Sueldo':r.sueldo,'Incentivo':r.incentivo,'TSS':r.tss,
      'ISR Sueldo':r.isrSueldo,'ISR Incentivo':r.isrIncentivo,'ISR Total':r.isrTotal,
      'Neto Sueldo':r.netoSueldo,'Neto Incentivo':r.netoIncentivo,'Neto Total':r.netoTotal};
  });
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:6},{wch:16},{wch:28},{wch:20},{wch:20},{wch:12},{wch:12},{wch:12},{wch:12},{wch:14},{wch:12},{wch:13},{wch:15},{wch:13}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'ISR');
  XLSX.writeFile(wb,'ISR_Retenciones_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

function isrCalcIndividual(){
  const s = parseFloat(document.getElementById('isr-ind-sueldo').value)||0;
  const inc = parseFloat(document.getElementById('isr-ind-incentivo').value)||0;
  const box = document.getElementById('isr-ind-result');
  if(s<=0 && inc<=0){ box.style.display='none'; return; }
  const r = isrCalcEmpleado(s, inc);
  document.getElementById('isr-ind-tss').textContent  = 'RD$ '+isrFmt(r.tss);
  document.getElementById('isr-ind-isrs').textContent = 'RD$ '+isrFmt(r.isrSueldo);
  document.getElementById('isr-ind-isri').textContent = 'RD$ '+isrFmt(r.isrIncentivo);
  document.getElementById('isr-ind-ret').textContent  = 'RD$ '+isrFmt(r.tss + r.isrTotal);
  document.getElementById('isr-ind-neto').textContent = 'RD$ '+isrFmt(r.netoTotal);
  box.style.display='block';
}

function isrDlPlantilla(){
  const rows=[
    {ID:1,CEDULA:'001-0000001-1',NOMBRE:'Juan Pérez',CARGO:'Analista',DEPARTAMENTO:'Recursos Humanos',SUELDO:80000,INCENTIVO:80000},
    {ID:2,CEDULA:'001-0000002-2',NOMBRE:'María Gómez',CARGO:'Coordinadora',DEPARTAMENTO:'Finanzas',SUELDO:55000,INCENTIVO:30000},
  ];
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:6},{wch:16},{wch:28},{wch:20},{wch:22},{wch:12},{wch:12}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Plantilla');
  XLSX.writeFile(wb,'plantilla-isr-rd.xlsx');
}



// ============================================================
// ChronosWork — Test: Call Center 24/7 (CASO REAL DEL USUARIO)
// ============================================================
// Reproduce exactamente el escenario que el usuario describió:
//   - 40 empleados, 24/7
//   - Operación: reportar daños acueducto/energía/gas
//   - 2-3 empleados SOLO nocturnos (22-06), resto solo diurnos
//   - 4-9h por turno, sin pasarse de 42h/sem
//   - En la noche entran MENOS llamadas
//   - Slots tipo 6:15-13:45, 8:00-16:00, etc. (inicio/fin dinámicos)
//
// OBJETIVO: Verificar que el algoritmo v4.0:
//   ✅ Cubre TODA la franja 22:00-06:00 con personal dedicado
//   ✅ Genera turnos que NO exceden las 22:00 cuando el empleado es DAY_ONLY
//   ✅ Distribuye la demanda diurna (4-22h) con slots dinámicos
//   ✅ Respeta 42h/sem por empleado
//   ✅ Usa la demanda configurable (no solo la curva default)
// ============================================================

import { generateAutomaticShifts, classifyEmployee, shiftPagaNocturno } from '../src/core/generateAutomaticShifts.js';
import { addDays, format } from 'date-fns';

// ── 1. Setup: 40 empleados al estilo del Excel del usuario ───────────────
function buildEmpleados() {
  const names = [
    'Juan Perez','Jorge Sanchez','Carolina Lopez','Sofia Garcia','Santiago Torres',
    'Daniel Vargas','Daniela Rios','Mariana Vargas','Camilo Lopez','Miguel Silva',
    'Diana Rodriguez','Natalia Perez','Jorge Romero','Sebastian Silva','Ana Rios',
    'Mateo Diaz','David Mendoza','Sofia Ramirez','Camila Martinez','Isabella Torres',
    'Andrea Navarro','Diego Ortiz','Oscar Lopez','Felipe Ramirez','Ana Silva',
    'Juan Garcia','Mariana Silva','Julian Romero','Julian Rodriguez','Laura Rodriguez',
    'Miguel Rodriguez','Ana Perez','Alejandro Navarro','Carlos Garcia','Carlos Castro',
    'Carolina Lopez','Daniela Rios','Andrea Martinez','Juan Romero','Julian Castro',
  ];
  return names.map((nombre, i) => {
    const id = `20001${String(i).padStart(5, '0')}`;
    // Los primeros 3 son NOCTURNOS DEDICADOS (cubren 22-06)
    // El resto son DIURNOS
    const esNocturno = i < 3;
    return {
      id,
      cedula: id,
      nombre,
      cargo: 'Agente Inbound',
      horas_semanales_contrato: 42,
      horas_max_diarias: 9,
      jornada_preferida: esNocturno ? 'NOCTURNA' : 'DIURNA',
      solo_nocturno: esNocturno,
      solo_diurno: !esNocturno,
      permite_partido: false,
    };
  });
}

// ── 2. Setup: demanda del call center (datos realistas) ──────────────────
//   Pico 8-12h y 14-18h, valle 22-06 (1 persona basta en la noche)
function buildDemandSlots() {
  const slots = [];
  // Slots 0-3 (= 00:00-03:00)  → 1 persona (valle nocturno)
  for (let h = 0; h < 3; h++) {
    slots.push({ day_of_week: 1, start_hour: h, end_hour: h + 1, required_staff: 1 });
    slots.push({ day_of_week: 2, start_hour: h, end_hour: h + 1, required_staff: 1 });
    slots.push({ day_of_week: 3, start_hour: h, end_hour: h + 1, required_staff: 1 });
    slots.push({ day_of_week: 4, start_hour: h, end_hour: h + 1, required_staff: 1 });
    slots.push({ day_of_week: 5, start_hour: h, end_hour: h + 1, required_staff: 1 });
    slots.push({ day_of_week: 6, start_hour: h, end_hour: h + 1, required_staff: 1 });
    slots.push({ day_of_week: 7, start_hour: h, end_hour: h + 1, required_staff: 1 });
  }
  // 03-05: empieza a entrar gente → 2 personas
  for (let h = 3; h < 5; h++) {
    for (let d = 1; d <= 7; d++) {
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: 2 });
    }
  }
  // 05-07: sube → 4 personas (turno mañana empieza)
  for (let h = 5; h < 7; h++) {
    for (let d = 1; d <= 7; d++) {
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: 4 });
    }
  }
  // 07-12: PICO → 6-8 personas
  for (let h = 7; h < 12; h++) {
    for (let d = 1; d <= 7; d++) {
      const staff = d >= 6 ? 4 : 7; // fin de semana menos
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: staff });
    }
  }
  // 12-14: almuerzo de Operadores → 5 personas
  for (let h = 12; h < 14; h++) {
    for (let d = 1; d <= 7; d++) {
      const staff = d >= 6 ? 3 : 5;
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: staff });
    }
  }
  // 14-18: PICO TARDE → 6-8 personas
  for (let h = 14; h < 18; h++) {
    for (let d = 1; d <= 7; d++) {
      const staff = d >= 6 ? 4 : 7;
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: staff });
    }
  }
  // 18-22: cierre gradual → 3 → 2 → 1
  for (let h = 18; h < 22; h++) {
    for (let d = 1; d <= 7; d++) {
      const staff = d >= 6 ? 2 : (h < 20 ? 3 : 2);
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: staff });
    }
  }
  // 22-00: valle nocturno → 1 persona
  for (let h = 22; h < 24; h++) {
    for (let d = 1; d <= 7; d++) {
      slots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: 1 });
    }
  }
  return slots;
}

// ── 3. Setup: 7 días (una semana completa) ───────────────────────────────
function buildDias() {
  // Fecha LOCAL (no new Date('2026-06-15') que se parsea como UTC y desfasa
  // un día en zonas horarias negativas como Colombia UTC-5).
  const start = new Date(2026, 5, 15); // lunes 15-jun-2026
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

// ── 4. RUN DEL ALGORITMO ──────────────────────────────────────────────────
const employees = buildEmpleados();
const demandSlots = buildDemandSlots();
const diasToProcess = buildDias();

const { shifts, warnings } = generateAutomaticShifts({
  employees,
  templates: [],         // Sin templates preestablecidos, slots dinámicos
  absences: [],
  existingShifts: [],
  year: 2026,
  month: 6,
  diasTrabajoArea: [1, 2, 3, 4, 5, 6, 7], // 24/7, todos los días
  diasToProcess,
  demandSlots,
  modoOperacion: '24_7_NIGHT_SPLIT',  // ← caso real del usuario
  nightShiftConfig: { start: '22:00', end: '06:00' },
  patronRotativo: null,
  // ── v4 nuevos ──
  estrategia: 'COVERAGE_FIRST',
  minEmpleadosNoche: 1,           // valle nocturno: 1 persona basta
  nocheSoloDedicados: true,        // solo los 3 nocturnos dedicados
  permiteDiaCubrirNoche: false,    // jamás un diurno cubre noche
  balancearCarga: true,
  rotarSlots: false,
  slotsPorHora: 4,
  snapMinutos: 15,
  minHorasTurnoOverride: 4,
  maxHorasTurnoOverride: 9,
  permiteExtras: false,
  permitePartidos: false,
});

// ── 5. ASERCIONES / VALIDACIONES ──────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else      { failed++; console.log(`  ❌ FAIL: ${msg}`); }
}

console.log('\n📊 RESULTADO DEL ALGORITMO v4.0\n');
console.log(`Generados: ${shifts.length} turnos en ${diasToProcess.length} días`);
console.log(`Warnings: ${warnings.length}`);
console.log(`\n${'='.repeat(70)}\n`);

// ── A. Clasificación de empleados ────────────────────────────────────────
console.log('A. Clasificación de empleados por jornada:');
const nightOnly = employees.filter(e => classifyEmployee(e) === 'NIGHT_ONLY');
const dayOnly   = employees.filter(e => classifyEmployee(e) === 'DAY_ONLY');
assert(nightOnly.length === 3, `3 empleados NIGHT_ONLY (actuales: ${nightOnly.length})`);
assert(dayOnly.length === 37, `37 empleados DAY_ONLY (actuales: ${dayOnly.length})`);

// ── B. Cobertura nocturna 22:00-06:00 ────────────────────────────────────
console.log('\nB. Cobertura nocturna 22:00-06:00 (CASO CRÍTICO):');
let nightCovered = 0;
let nightMissed = 0;
diasToProcess.forEach(d => {
  const dateStr = format(d, 'yyyy-MM-dd');
  const nextDate = addDays(d, 1);
  const nextStr = format(nextDate, 'yyyy-MM-dd');
  const nightShifts = shifts.filter(s => s.start_time === `${dateStr}T22:00`);
  if (nightShifts.length >= 1) nightCovered++;
  else nightMissed++;
});
assert(nightMissed === 0, `Cobertura 22-06: ${nightCovered}/${diasToProcess.length} días cubiertos`);
assert(nightCovered === diasToProcess.length, `TODOS los días tienen al menos 1 nocturno`);

// Verificar que SOLO los NIGHT_ONLY cubren la noche
console.log('\nC. Solo empleados NIGHT_ONLY cubren la noche:');
const wrongNightAssignments = shifts
  .filter(s => s.start_time.includes('T22:00'))
  .filter(s => !nightOnly.some(n => n.id === s.employee_id));
assert(wrongNightAssignments.length === 0, `Ningún DAY_ONLY fue asignado a la noche (${wrongNightAssignments.length} errores)`);

// ── D. Ningún DAY_ONLY tiene turno que toque horario nocturno ────────────
console.log('\nD. Empleados DAY_ONLY no tienen turno nocturno:');
const dayOnlyShifts = shifts.filter(s => dayOnly.some(d => d.id === s.employee_id));
const dayOnlyWithNight = dayOnlyShifts.filter(s => {
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  const startH = start.getHours();
  const endH = end.getHours() + (end.getDate() !== start.getDate() ? 24 : 0);
  // Si termina después de las 19:00, está mal
  return startH >= 19 || endH > 19 || (endH === 19 && end.getMinutes() > 0);
});
assert(dayOnlyWithNight.length === 0, `0 turnos DAY_ONLY cruzan 19:00 (encontrados: ${dayOnlyWithNight.length})`);

// ── E. Duración de turnos 4-9h ───────────────────────────────────────────
console.log('\nE. Duración de turnos:');
const allDurations = shifts.map(s => {
  const hrs = (new Date(s.end_time) - new Date(s.start_time)) / 3600000 - (s.break_minutes || 0) / 60;
  return hrs;
});
const tooShort = allDurations.filter(h => h < 4).length;
const tooLong  = allDurations.filter(h => h > 9).length;
assert(tooShort === 0, `Ningún turno < 4h (encontrados: ${tooShort})`);
assert(tooLong === 0,  `Ningún turno > 9h (encontrados: ${tooLong})`);

// ── F. Respeto del 42h/sem por empleado (POR SEMANA ISO, lun-dom) ─────────
console.log('\nF. Horas semanales por empleado:');
const hoursByEmp = {};   // total del período (solo para la distribución)
const hoursByEmpWeek = {}; // clave: emp|lunesISO  → horas de esa semana
shifts.forEach(s => {
  const hrs = (new Date(s.end_time) - new Date(s.start_time)) / 3600000 - (s.break_minutes || 0) / 60;
  hoursByEmp[s.employee_id] = (hoursByEmp[s.employee_id] || 0) + hrs;
  const sd = new Date(s.start_time);
  const dow = sd.getDay() || 7;
  const mon = new Date(sd);
  mon.setDate(mon.getDate() - dow + 1);
  const wkKey = `${s.employee_id}|${format(mon, 'yyyy-MM-dd')}`;
  hoursByEmpWeek[wkKey] = (hoursByEmpWeek[wkKey] || 0) + hrs;
});
const overworked = Object.entries(hoursByEmpWeek).filter(([_, h]) => h > 42.01);
assert(overworked.length === 0, `Ningún empleado > 42h en ninguna semana ISO (sobrepasados: ${overworked.length})`);

const distrib = Object.entries(hoursByEmp)
  .map(([_, h]) => h)
  .sort((a, b) => a - b);
console.log(`  Distribución horas: min=${distrib[0]?.toFixed(1)} max=${distrib[distrib.length-1]?.toFixed(1)} avg=${(distrib.reduce((a,b)=>a+b,0)/distrib.length).toFixed(1)}`);

// ── G. Cobertura diurna por slot ─────────────────────────────────────────
console.log('\nG. Cobertura diurna (slots 04:00-22:00):');
let totalDayDeficit = 0;
diasToProcess.forEach(d => {
  const dateStr = format(d, 'yyyy-MM-dd');
  const dayShifts = shifts.filter(s => s.start_time.startsWith(dateStr));
  // Para cada hora del 04 al 22, contar cuántos están cubriendo
  for (let h = 4; h < 22; h++) {
    let covering = 0;
    dayShifts.forEach(s => {
      const sh = parseInt(s.start_time.split('T')[1].split(':')[0], 10);
      const eh = parseInt(s.end_time.split('T')[1].split(':')[0], 10)
                 + (s.end_time.split('T')[0] !== s.start_time.split('T')[0] ? 24 : 0);
      if (sh <= h && eh > h) covering++;
    });
    const required = demandSlots.find(ds => ds.day_of_week === (d.getDay() || 7) && ds.start_hour === h)?.required_staff || 0;
    if (covering < required) totalDayDeficit += (required - covering);
  }
});
console.log(`  Déficit diurno total: ${totalDayDeficit} horas-persona`);
assert(totalDayDeficit < 100, `Cobertura diurna razonable (déficit < 100h-persona, actual: ${totalDayDeficit})`);

// ── H. Slots dinámicos (no solo 8h exactos) ─────────────────────────────
console.log('\nH. Variedad de slots dinámicos:');
const startTimes = new Set(shifts.map(s => s.start_time.split('T')[1]));
console.log(`  Horarios de inicio distintos: ${startTimes.size}`);
assert(startTimes.size >= 5, `Hay al menos 5 horarios de inicio distintos (encontrados: ${startTimes.size})`);

// ── Resumen ─────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(70)}`);
console.log(`\n📈 RESUMEN: ${passed} ✅ / ${failed} ❌`);
if (failed > 0) {
  console.log('\n❌ TEST FALLÓ. Revisar el algoritmo.');
  console.log('\nWARNINGS:');
  warnings.slice(0, 10).forEach(w => console.log('  ⚠️', w));
  process.exit(1);
} else {
  console.log('\n🎉 ¡Todos los tests pasaron! El algoritmo v4.0 cubre el caso de call center 24/7.');
  console.log('\nMuestra de turnos generados:');
  shifts.slice(0, 8).forEach(s => {
    const emp = employees.find(e => e.id === s.employee_id);
    console.log(`  ${s.start_time} → ${s.end_time}  |  ${emp?.nombre} (${classifyEmployee(emp)})`);
  });
}

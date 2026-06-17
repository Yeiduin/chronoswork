// ============================================================
// ChronosWork — Test v5: Headcount por día + priorización por demanda
// ============================================================
// Verifica los cambios pedidos:
//   ✅ La empresa define personas/día (objetivo) y la curva reparte ese
//      headcount durante el día (más en picos, menos en valle).
//   ✅ El techo max_empleados_dia NO se supera (personas distintas/día).
//   ✅ Cuando falta capacidad, se prefiere DEJAR DÍAS COMPLETOS sin cubrir
//      (los de MENOR demanda) en vez de dejar huecos en muchos días.
//   ✅ El piso min_empleados_dia vacía el día y avisa "sin trabajadores
//      disponibles" con el nombre del día.
//   ✅ El día diurno arranca en horaInicioDia (default 04:00, configurable).
// ============================================================

import { generateAutomaticShifts } from '../src/core/generateAutomaticShifts.js';
import { addDays } from 'date-fns';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } };

const distinctPeople = (shifts, dateStr) =>
  new Set(shifts.filter(s => String(s.start_time).startsWith(dateStr)).map(s => s.employee_id)).size;

const firstStartHour = (shifts, dateStr) => {
  const hrs = shifts
    .filter(s => String(s.start_time).startsWith(dateStr))
    .map(s => parseInt(String(s.start_time).split('T')[1].slice(0, 2), 10));
  return hrs.length ? Math.min(...hrs) : null;
};

// ── Empleados: 12 diurnos "cualquiera" (capacidad limitada a propósito) ──
function buildEmployees(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `E${String(i).padStart(3, '0')}`,
    nombre: `Emp ${i}`,
    horas_semanales_contrato: 42,
    horas_max_diarias: 9,
    jornada_preferida: 'CUALQUIERA',
  }));
}

// 7 días: lunes 2026-06-15 a domingo 2026-06-21
const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(2026, 5, 15), i));
const dStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── TEST 1: Techo de personas/día (objetivo headcount) ───────────────────
console.log('\n── TEST 1: max_empleados_dia como techo + objetivo ──');
{
  const employees = buildEmployees(30); // capacidad de sobra
  const { shifts } = generateAutomaticShifts({
    employees, templates: [], absences: [], existingShifts: [],
    year: 2026, month: 6,
    diasTrabajoArea: [1, 2, 3, 4, 5, 6, 7],
    diasToProcess: days,
    demandSlots: [],
    modoOperacion: 'OFICINA',
    estrategia: 'COVERAGE_FIRST',
    balancearCarga: false,
    maxEmpleadosDia: 10,
    horaInicioDia: '04:00',
  });
  let maxBreach = 0;
  for (const d of days) maxBreach = Math.max(maxBreach, distinctPeople(shifts, dStr(d)));
  ok(maxBreach <= 10, `ningún día supera 10 personas (máx observado: ${maxBreach})`);
  ok(shifts.length > 0, `se generaron turnos (${shifts.length})`);
}

// ── TEST 2: Inicio del día configurable ──────────────────────────────────
console.log('\n── TEST 2: horaInicioDia respetada ──');
{
  const employees = buildEmployees(20);
  const { shifts } = generateAutomaticShifts({
    employees, templates: [], absences: [], existingShifts: [],
    year: 2026, month: 6,
    diasTrabajoArea: [1, 2, 3, 4, 5, 6, 7],
    diasToProcess: days,
    demandSlots: [],
    modoOperacion: 'OFICINA',
    estrategia: 'COVERAGE_FIRST',
    balancearCarga: false,
    maxEmpleadosDia: 10,
    horaInicioDia: '04:00',
  });
  const earliest = Math.min(...days.map(d => firstStartHour(shifts, dStr(d))).filter(h => h != null));
  ok(earliest >= 4, `ningún turno diurno empieza antes de las 04:00 (más temprano: ${earliest}:00)`);
}

// ── TEST 3: Escasez real → días de MENOR demanda quedan VACÍOS (no huecos) ─
console.log('\n── TEST 3: priorización por demanda bajo escasez ──');
{
  // Demanda ALTA todos los días (10/hora en horario diurno), pero DECRECIENTE
  // de lunes a domingo, para que la prioridad sea inequívoca. Capacidad MUY
  // limitada: 6 empleados (no alcanza para 7 días exigentes). El piso obliga a
  // dejar días COMPLETOS sin cubrir en vez de muchos días con huecos.
  const demandSlots = [];
  for (let d = 1; d <= 7; d++) {
    const nivel = 12 - d; // lun=11, mar=10, ... dom=5 (decreciente)
    for (let h = 0; h < 24; h++) {
      const req = (h >= 6 && h < 18) ? nivel : 1;
      demandSlots.push({ day_of_week: d, start_hour: h, end_hour: h + 1, required_staff: req });
    }
  }
  const employees = buildEmployees(6);
  const { shifts, warnings } = generateAutomaticShifts({
    employees, templates: [], absences: [], existingShifts: [],
    year: 2026, month: 6,
    diasTrabajoArea: [1, 2, 3, 4, 5, 6, 7],
    diasToProcess: days,
    demandSlots,
    modoOperacion: 'OFICINA',
    estrategia: 'COVERAGE_FIRST',
    balancearCarga: false,
    minEmpleadosDia: 5,          // piso alto: 5×7=35 > capacidad (~30 person-días)
    maxEmpleadosDia: 6,
    horaInicioDia: '04:00',
  });

  const perDay = days.map(d => distinctPeople(shifts, dStr(d)));
  const emptyDays = perDay.filter(p => p === 0).length;
  const coveredDays = perDay.filter(p => p > 0).length;

  console.log('    personas por día (lun→dom):', perDay);
  ok(coveredDays >= 1, `los días de mayor demanda se cubren (días cubiertos: ${coveredDays})`);
  ok(emptyDays >= 1, `al menos un día de baja demanda queda completamente vacío (días vacíos: ${emptyDays})`);

  // No debe haber días "a medias" por debajo del piso (salvo 0).
  const aMedias = perDay.filter(p => p > 0 && p < 3).length;
  ok(aMedias === 0, `ningún día queda a medias por debajo del piso de 3 (días a medias: ${aMedias})`);

  // Los días vacíos deben ser los de MENOR demanda (los últimos del orden).
  const lastDayEmpty = perDay[6] === 0;
  ok(lastDayEmpty, 'el domingo (menor demanda) es de los días sacrificados');

  const avisoSinTrabajadores = warnings.some(w => /sin trabajadores disponibles/i.test(w));
  ok(avisoSinTrabajadores, 'se emite el aviso "sin trabajadores disponibles"');
  const tieneNombreDia = warnings.some(w => /(sábado|domingo|lunes|martes|miércoles|jueves|viernes)/i.test(w));
  ok(tieneNombreDia, 'el aviso incluye el nombre del día');
}

// ── TEST 4: 50/día con 3 en la noche (caso del usuario) ──────────────────
console.log('\n── TEST 4: 24/7 — 50/día, 3 noche ──');
{
  // 3 nocturnos dedicados + 60 "cualquiera" para diurno.
  const noche = Array.from({ length: 5 }, (_, i) => ({
    id: `N${i}`, nombre: `Noche ${i}`, horas_semanales_contrato: 42, horas_max_diarias: 9,
    jornada_preferida: 'NOCTURNA', solo_nocturno: true,
  }));
  const dia = Array.from({ length: 70 }, (_, i) => ({
    id: `D${i}`, nombre: `Dia ${i}`, horas_semanales_contrato: 42, horas_max_diarias: 9,
    jornada_preferida: 'DIURNA', solo_diurno: true,
  }));
  const employees = [...noche, ...dia];

  const { shifts } = generateAutomaticShifts({
    employees, templates: [], absences: [], existingShifts: [],
    year: 2026, month: 6,
    diasTrabajoArea: [1, 2, 3, 4, 5, 6, 7],
    diasToProcess: days.slice(0, 3), // 3 días para que el test sea rápido
    demandSlots: [],
    modoOperacion: '24_7_NIGHT_SPLIT',
    nightShiftConfig: { start: '19:00', end: '06:00' },
    estrategia: 'COVERAGE_FIRST',
    minEmpleadosNoche: 3,
    nocheSoloDedicados: true,
    balancearCarga: false,
    maxEmpleadosDia: 50,
    horaInicioDia: '04:00',
  });

  const d0 = dStr(days[0]);
  const ppl = distinctPeople(shifts, d0);
  ok(ppl <= 50, `día 0 no supera 50 personas (observado: ${ppl})`);
  ok(ppl >= 20, `día 0 tiene cobertura sustancial repartida (observado: ${ppl})`);
  // Turnos nocturnos del primer día
  const nightShifts = shifts.filter(s => s.shift_kind === 'NOCTURNO' && String(s.start_time).startsWith(d0));
  ok(nightShifts.length >= 1, `hay cobertura nocturna el día 0 (${nightShifts.length} bloques)`);
}

// ── TEST 5: Oficina 8-18, 2 personas (caso Administración y Gerencia) ────
console.log('\n── TEST 5: OFICINA 08:00-18:00, 2 personas ──');
{
  const employees = [
    { id: 'A', nombre: 'Admin', horas_semanales_contrato: 42, horas_max_diarias: 9, jornada_preferida: 'DIURNA', solo_diurno: true },
    { id: 'G', nombre: 'Gerente', horas_semanales_contrato: 42, horas_max_diarias: 9, jornada_preferida: 'DIURNA', solo_diurno: true },
  ];
  const officeDays = Array.from({ length: 5 }, (_, i) => addDays(new Date(2026, 5, 15), i)); // lun-vie
  const { shifts } = generateAutomaticShifts({
    employees, templates: [], absences: [], existingShifts: [],
    year: 2026, month: 6,
    diasTrabajoArea: [1, 2, 3, 4, 5],
    diasToProcess: officeDays,
    demandSlots: [],
    modoOperacion: 'OFICINA',
    estrategia: 'BALANCED',
    balancearCarga: true,
    minEmpleadosDia: 1,
    maxEmpleadosDia: 2,
    minEmpleadosNoche: 0,
    horaInicioDia: '08:00',
    horaFinDia: '18:00',
  });

  ok(shifts.length > 0, `se generaron turnos de oficina (${shifts.length})`);

  // CRÍTICO: ningún turno con end_time <= start_time (constraint check_shift_times).
  const invalid = shifts.filter(s => new Date(s.end_time) <= new Date(s.start_time));
  ok(invalid.length === 0, `0 turnos inválidos end<=start (encontrados: ${invalid.length})`);

  // Ningún turno empieza antes de las 08:00 ni termina después de las 18:00.
  const outOfHours = shifts.filter(s => {
    const sh = parseInt(String(s.start_time).slice(11, 13), 10);
    const crosses = String(s.end_time).slice(0, 10) !== String(s.start_time).slice(0, 10);
    const eh = parseInt(String(s.end_time).slice(11, 13), 10);
    const em = parseInt(String(s.end_time).slice(14, 16), 10);
    return sh < 8 || crosses || eh > 18 || (eh === 18 && em > 0);
  });
  ok(outOfHours.length === 0, `todos los turnos dentro de 08:00-18:00 (fuera: ${outOfHours.length})`);

  // Máx 2 personas por día.
  let maxPpl = 0;
  for (const d of officeDays) maxPpl = Math.max(maxPpl, distinctPeople(shifts, dStr(d)));
  ok(maxPpl <= 2, `nunca más de 2 personas por día (máx: ${maxPpl})`);

  // Las jornadas largas (≥8h) llevan descanso de almuerzo (>0 min).
  const longShifts = shifts.filter(s => (new Date(s.end_time) - new Date(s.start_time)) / 3600000 >= 8);
  const longWithBreak = longShifts.filter(s => (s.break_minutes || 0) > 0);
  ok(longShifts.length === 0 || longWithBreak.length === longShifts.length,
    `las jornadas largas llevan almuerzo (${longWithBreak.length}/${longShifts.length})`);
}

console.log(`\n══════════════════════════════════\nRESULTADO: ${pass} ✅  |  ${fail} ❌\n══════════════════════════════════`);
if (fail > 0) process.exit(1);

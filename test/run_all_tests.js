// ============================================================
// ChronosWork — Runner de tests completos
// Ejecuta TODOS los tests del proyecto en secuencia
// ============================================================

import { execSync } from 'child_process';

const tests = [
  { name: 'Tests de catálogo (areas, empleados, turnos)', file: 'test_area_creation.js' },
  { name: 'Tests de payloads de área (sectores, defaults)', file: 'test_area_payloads.js' },
  { name: 'Tests de cleanEmployeeData (hook useEmployees)', file: 'test_clean_employee_data.js' },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 CHRONOSWORK — SUITE DE TESTS COMPLETA');
console.log('═══════════════════════════════════════════════════════════\n');

let totalPass = 0;
let totalFail = 0;
let totalBugs = 0;

for (const t of tests) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${t.name}`);
  console.log('─'.repeat(60));
  try {
    const out = execSync(`node test/${t.file}`, { encoding: 'utf8', cwd: process.cwd() });
    console.log(out);

    // Contar resultados
    const passMatch = out.match(/(\d+) pasaron/);
    const failMatch = out.match(/(\d+) fallaron/);
    const pass = passMatch ? parseInt(passMatch[1]) : 0;
    const fail = failMatch ? parseInt(failMatch[1]) : 0;
    totalPass += pass;
    totalFail += fail;
  } catch (e) {
    console.log(`❌ Error ejecutando ${t.file}`);
    console.log(e.stdout || e.message);
    totalFail++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 RESUMEN TOTAL');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Tests pasados: ${totalPass}`);
console.log(`❌ Tests fallados: ${totalFail}`);

if (totalFail === 0) {
  console.log('\n🎉 ¡TODOS LOS TESTS PASARON!');
  process.exit(0);
} else {
  console.log('\n⚠️ Hay tests fallidos. Revisa los errores arriba.');
  process.exit(1);
}

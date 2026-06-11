import { format } from 'date-fns';

/**
 * Algoritmo avanzado de generación automática de turnos.
 * Cumple con las 5 fases:
 * A: Bloqueo de novedades
 * B: Asignación Fija
 * C: Análisis de Déficit
 * D: Descansos Inteligentes (para empleados por horas)
 * E: Relleno Dinámico (sin superar 42h)
 */
export function generateAutomaticShifts({
  employees,
  templates,
  absences,
  existingShifts,
  year,
  month,
  diasTrabajoArea,
  coberturaMinimaDiaria,
  coberturaMaximaDiaria,
  diasToProcess = []
}) {
  const generatedShifts = [];
  const warnings = [];

  if (!employees || employees.length === 0) return { shifts: [], warnings: ['No hay empleados en el área.'] };
  if (!templates || templates.length === 0) return { shifts: [], warnings: ['No hay franjas horarias configuradas.'] };

  // Convertir dias a procesar a formato YYYY-MM-DD
  const days = diasToProcess.map(d => ({
    date: d,
    dateStr: format(d, 'yyyy-MM-dd'),
    dayOfWeek: d.getDay() === 0 ? 7 : d.getDay(),
  })).filter(d => diasTrabajoArea.includes(d.dayOfWeek)); // Solo días de trabajo del área

  const minCoverage = coberturaMinimaDiaria || 1;
  const maxCoverage = coberturaMaximaDiaria || 10;
  
  const empFijos = employees.filter(e => e.tipo_contrato === 'SALARIO_FIJO');
  const empPorHoras = employees.filter(e => e.tipo_contrato !== 'SALARIO_FIJO'); // Default a POR_HORAS

  // Utilidad para chequear si alguien ya tiene un turno ese día
  const hasShift = (empId, dateStr) => {
    return existingShifts.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr)) ||
           generatedShifts.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr));
  };

  // Fase A: Novedades (Absences)
  const isBlocked = (empId, dateStr) => {
    return absences.some(a => {
      return a.employee_id === empId &&
             a.fecha_inicio <= dateStr &&
             a.fecha_fin >= dateStr;
    });
  };

  // Fase B: Asignación Fija
  empFijos.forEach(emp => {
    if (!emp.turno_predeterminado_id) return;
    const template = templates.find(t => t.id === emp.turno_predeterminado_id);
    if (!template) return;

    days.forEach(day => {
      if (isBlocked(emp.id, day.dateStr)) return;
      if (hasShift(emp.id, day.dateStr)) return;
      // TODO: Respetar días de descanso para fijos, por defecto asumo que descansan cuando no es dia de trabajo del area.

      generatedShifts.push({
        employee_id: emp.id,
        template_id: template.id,
        start_time: `${day.dateStr}T${template.hora_inicio}`,
        end_time: template.cruza_medianoche 
          ? `${format(new Date(day.date.getTime() + 86400000), 'yyyy-MM-dd')}T${template.hora_fin}`
          : `${day.dateStr}T${template.hora_fin}`,
        shift_type: 'custom',
        periodo: `${year}-${String(month).padStart(2, '0')}`,
        break_minutes: 0, // O calcular si es necesario
      });
    });
  });

  // Fase C: Análisis de Déficit Diario
  // Calculamos cuántos empleados tenemos fijos + turnos existentes por día
  const getCoverage = (dateStr) => {
    let count = 0;
    count += existingShifts.filter(s => s.start_time.startsWith(dateStr)).length;
    count += generatedShifts.filter(s => s.start_time.startsWith(dateStr)).length;
    return count;
  };

  // Fase D: Descansos Inteligentes para empleados 'POR_HORAS'
  // Dividimos los días en semanas para asignar los descansos
  // Asumiremos lunes-domingo como una semana
  
  // Agrupar días por semana ISO
  const weeks = {};
  days.forEach(day => {
    const d = new Date(day.date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() || 7));
    const yearWeek = d.getFullYear();
    const weekNo = Math.floor((((d - new Date(yearWeek, 0, 1)) / 86400000) + 1) / 7);
    const weekKey = `${yearWeek}-W${weekNo}`;
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(day);
  });

  const rests = {}; // { empId_dateStr: true }

  empPorHoras.forEach(emp => {
    const requiredRests = emp.dias_descanso_semana || 1;
    
    Object.values(weeks).forEach(weekDays => {
      // Ordenar los días de la semana por mayor cobertura actual (superávit) para colocar el descanso
      const sortedDays = [...weekDays].sort((a, b) => getCoverage(b.dateStr) - getCoverage(a.dateStr));
      let assignedRests = 0;

      for (const day of sortedDays) {
        if (assignedRests >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue; // Si está bloqueado ya descansa o está ausente
        
        // Asignar descanso si no rompe la cobertura mínima drásticamente,
        // aunque si todos necesitan descanso, alguien tiene que descansar.
        rests[`${emp.id}_${day.dateStr}`] = true;
        assignedRests++;
      }
    });
  });

  // Utilidad para horas trabajadas en la semana
  const getWeeklyHours = (empId, date) => {
    const d = new Date(date);
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    let totalHrs = 0;
    const allShifts = [...existingShifts, ...generatedShifts].filter(s => s.employee_id === empId);
    
    allShifts.forEach(s => {
      const sDate = new Date(s.start_time);
      if (sDate >= monday && sDate <= sunday) {
        const eDate = new Date(s.end_time);
        let hrs = (eDate - sDate) / 3600000;
        if (s.break_minutes) hrs -= (s.break_minutes / 60);
        totalHrs += hrs;
      }
    });
    return totalHrs;
  };

  // Fase E: Relleno Dinámico
  days.forEach(day => {
    let currentCoverage = getCoverage(day.dateStr);
    
    // Si ya superamos el máximo o cubrimos el mínimo y queremos optimizar, seguimos.
    // Para simplificar, intentaremos llegar al máximo posible o al menos al mínimo.
    const targetCoverage = maxCoverage;

    // Iteramos sobre las plantillas (podríamos tener rotación aquí)
    let templateIdx = 0;

    // Ordenamos empleados por horas: los que tienen menos horas en la semana van primero
    const availableEmps = [...empPorHoras]
      .filter(e => !isBlocked(e.id, day.dateStr) && !rests[`${e.id}_${day.dateStr}`] && !hasShift(e.id, day.dateStr))
      .sort((a, b) => getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date));

    for (const emp of availableEmps) {
      if (currentCoverage >= targetCoverage) break;

      const template = templates[templateIdx % templates.length];
      templateIdx++;

      // Validar 42 horas
      const currentHrs = getWeeklyHours(emp.id, day.date);
      // Calcular duracion del template
      const hIni = new Date(`1970-01-01T${template.hora_inicio}`);
      let hFin = new Date(`1970-01-01T${template.hora_fin}`);
      if (template.cruza_medianoche) hFin.setDate(hFin.getDate() + 1);
      const shiftHrs = (hFin - hIni) / 3600000;

      if (currentHrs + shiftHrs > 42) {
        continue; // Excede límite semanal
      }

      generatedShifts.push({
        employee_id: emp.id,
        template_id: template.id,
        start_time: `${day.dateStr}T${template.hora_inicio}`,
        end_time: template.cruza_medianoche 
          ? `${format(new Date(day.date.getTime() + 86400000), 'yyyy-MM-dd')}T${template.hora_fin}`
          : `${day.dateStr}T${template.hora_fin}`,
        shift_type: 'custom',
        periodo: `${year}-${String(month).padStart(2, '0')}`,
        break_minutes: 0,
      });

      currentCoverage++;
    }

    if (currentCoverage < minCoverage) {
      warnings.push(`El día ${day.dateStr} no alcanzó la cobertura mínima (${currentCoverage}/${minCoverage})`);
    }
  });

  return { shifts: generatedShifts, warnings };
}

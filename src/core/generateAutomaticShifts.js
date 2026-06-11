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
  coberturaPorTurno = {},
  diasToProcess = [],
  demandSlots = []
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
  // Extraemos configuración de alta demanda para que Phase D evite dar descansos en esos días
  const diasAltaDemanda = coberturaPorTurno?.diasAltaDemanda || [];
  const franjasAltaDemanda = coberturaPorTurno?.franjasAltaDemanda || [];

  // Dividimos los días en semanas para asignar los descansos
  // Asumiremos lunes-domingo como una semana
  
  // Agrupar días por semana ISO
  const weeks = {};
  days.forEach(day => {
    const d = new Date(day.date);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    const weekKey = format(monday, 'yyyy-MM-dd');
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(day);
  });

  const rests = {}; // clave: empId_dateStr
  const restsPerDay = {}; // Para balancear los descansos entre el equipo

  empPorHoras.forEach(emp => {
    const requiredRests = emp.dias_descanso_semana || 1;

    Object.values(weeks).forEach(weekDays => {
      // Ordenar días para ver dónde es MEJOR poner el descanso
      const sortedDays = [...weekDays].sort((a, b) => {
        // Prioridad 1: Evitar descansos en días de alta demanda
        const aIsHigh = diasAltaDemanda.includes(a.dayOfWeek) ? 1 : 0;
        const bIsHigh = diasAltaDemanda.includes(b.dayOfWeek) ? 1 : 0;
        if (aIsHigh !== bIsHigh) return aIsHigh - bIsHigh; // Baja demanda (0) viene antes que Alta (1)

        // Prioridad 2: Si el día ya tiene suficiente cobertura (ej. fijos), es buen candidato
        const covDiff = getCoverage(b.dateStr) - getCoverage(a.dateStr);
        if (covDiff !== 0) return covDiff;

        // Prioridad 3: Balancear descansos para no dejar la empresa vacía un mismo día
        const restsA = restsPerDay[a.dateStr] || 0;
        const restsB = restsPerDay[b.dateStr] || 0;
        return restsA - restsB;
      });
      
      let assignedRests = 0;

      for (const day of sortedDays) {
        if (assignedRests >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue; // Si está bloqueado ya descansa o está ausente
        
        // Asignar descanso si no rompe la cobertura mínima drásticamente,
        // aunque si todos necesitan descanso, alguien tiene que descansar.
        rests[`${emp.id}_${day.dateStr}`] = true;
        restsPerDay[day.dateStr] = (restsPerDay[day.dateStr] || 0) + 1;
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
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

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

  // Fase E: Relleno Dinámico y Priorizado
  // (diasAltaDemanda y franjasAltaDemanda ya extraídos arriba)

  // Creamos todos los "Slots" posibles (Día x Franja)
  let slots = [];
  days.forEach(day => {
    templates.forEach(template => {
      slots.push({
        day,
        template,
        dateStr: day.dateStr,
        templateId: template.id
      });
    });
  });

  // --- PRE-CÁLCULO WFM ---
  const demandMatrix = {};
  const coverageMatrix = {};
  const useWfm = demandSlots && demandSlots.length > 0;
  
  if (useWfm) {
    days.forEach(day => {
      demandMatrix[day.dateStr] = new Array(24).fill(0);
      coverageMatrix[day.dateStr] = new Array(24).fill(0);
      
      const dayDemand = demandSlots.filter(hd => hd.day_of_week === day.dayOfWeek);
      dayDemand.forEach(hd => {
        for(let h = hd.start_hour; h < hd.end_hour; h++) {
           if (h < 24) demandMatrix[day.dateStr][h] = hd.required_staff;
        }
      });
    });
  }
  
  const calculateHourlyCoverage = () => {
     if (!useWfm) return;
     days.forEach(day => {
        coverageMatrix[day.dateStr].fill(0);
     });
     const allShifts = [...existingShifts, ...generatedShifts];
     allShifts.forEach(s => {
        const dateStr = s.start_time.split('T')[0];
        if (coverageMatrix[dateStr]) {
           const sHour = new Date(s.start_time).getHours();
           let eHour = new Date(s.end_time).getHours();
           if (new Date(s.end_time).getDate() !== new Date(s.start_time).getDate()) {
              eHour = 24;
           }
           for (let h = sHour; h < eHour; h++) {
              coverageMatrix[dateStr][h]++;
           }
        }
     });
  };

  // Iteramos hasta que no podamos asignar más (por límite de 42h, falta de personal, o límite máximo por día)
  let assignedAny = true;
  while (assignedAny) {
    assignedAny = false;

    if (useWfm) calculateHourlyCoverage();

    // Actualizar el puntaje de cada Slot en esta iteración
    slots.forEach(slot => {
      const dayCov = getCoverage(slot.dateStr);
      const slotCov = existingShifts.filter(s => s.start_time.startsWith(slot.dateStr) && s.template_id === slot.templateId).length +
                      generatedShifts.filter(s => s.start_time.startsWith(slot.dateStr) && s.template_id === slot.templateId).length;
      
      let score = 0;
      
      if (useWfm) {
          const hIniParts = slot.template.hora_inicio.split(':');
          const hFinParts = slot.template.hora_fin.split(':');
          const sHour = parseInt(hIniParts[0]);
          let eHour = parseInt(hFinParts[0]);
          if (slot.template.cruza_medianoche) eHour += 24;
          
          let deficitResolved = 0;
          let overStaffedHours = 0;
          
          for (let h = sHour; h < eHour; h++) {
             const actualH = h % 24;
             // Por simplicidad, evaluamos el cruce de medianoche en el mismo día base
             const demand = demandMatrix[slot.dateStr][actualH];
             const coverage = coverageMatrix[slot.dateStr][actualH];
             
             if (coverage < demand) {
                deficitResolved += 1;
             } else {
                overStaffedHours += 1;
             }
          }
          
          if (deficitResolved === 0) {
             score = -100000; // Descartado virtualmente
          } else {
             score = (deficitResolved * 10000) - (overStaffedHours * 100);
             score -= (slotCov * 10);
          }
      } else {
          // Prioridad 1: Llegar al mínimo del día (Tradicional)
          if (dayCov < minCoverage) {
            score += 10000;
            // Penalar días que ya tienen turnos asignados (incluso si no llegan al mínimo), para repartir equitativamente
            score -= (dayCov * 1000); 
            // Balancear entre las franjas para que no se asignen todos al mismo turno
            score -= (slotCov * 100); 
            // Desempate de alta demanda también en la base
            if (diasAltaDemanda.includes(slot.day.dayOfWeek)) score += 50;
            if (franjasAltaDemanda.includes(slot.templateId)) score += 50;
          } else {
            // Prioridad 2: Días y Franjas de Alta demanda
            if (diasAltaDemanda.includes(slot.day.dayOfWeek)) score += 500;
            if (franjasAltaDemanda.includes(slot.templateId)) score += 500;
            
            // Evitar superar el máximo por día
            if (dayCov >= maxCoverage) {
              score -= 100000; // Descartado virtualmente
            } else {
              score -= (dayCov * 100);
              // Balancear para no saturar la misma franja
              score -= (slotCov * 10);
            }
          }
      }

      // Añadir un pequeño valor aleatorio para desempates exactos (evita que Lunes siempre gane sobre Domingo)
      slot.score = score + Math.random();
      slot.dayCov = dayCov;
    });

    // Ordenar slots por score descendente
    slots.sort((a, b) => b.score - a.score);

    // Intentar llenar el mejor slot
    for (const slot of slots) {
      if (slot.score < -50000) break; // Ya superó el maxCoverage
      
      // Buscar el mejor empleado disponible para este slot
      // "Mejor" = el que menos horas semanales tenga, para balancear la carga equitativamente
      const availableEmps = [...empPorHoras]
        .filter(e => !isBlocked(e.id, slot.dateStr) && !rests[`${e.id}_${slot.dateStr}`] && !hasShift(e.id, slot.dateStr))
        .sort((a, b) => getWeeklyHours(a.id, slot.day.date) - getWeeklyHours(b.id, slot.day.date));

      let empAssigned = false;
      for (const emp of availableEmps) {
        const currentHrs = getWeeklyHours(emp.id, slot.day.date);
        const remainingWeekly = 42 - currentHrs;
        
        const hIniParts = slot.template.hora_inicio.split(':');
        const hFinParts = slot.template.hora_fin.split(':');
        const hIniDate = new Date(slot.day.date);
        hIniDate.setHours(parseInt(hIniParts[0]), parseInt(hIniParts[1]), 0, 0);
        
        let hFinDate = new Date(slot.day.date);
        hFinDate.setHours(parseInt(hFinParts[0]), parseInt(hFinParts[1]), 0, 0);
        if (slot.template.cruza_medianoche) hFinDate.setDate(hFinDate.getDate() + 1);
        
        const templateHrs = (hFinDate - hIniDate) / 3600000;
        let finalShiftHrs = templateHrs;
        
        // Calcular cobertura REAL actual en este momento preciso para ver si es trabajador base o de refuerzo
        const slotCoverageActual = generatedShifts.filter(s => s.start_time.startsWith(slot.dateStr) && s.template_id === slot.templateId).length
                                 + existingShifts.filter(s => s.start_time.startsWith(slot.dateStr) && s.template_id === slot.templateId).length;
        
        const isBaseCoverage = slotCoverageActual === 0;

        if (isBaseCoverage) {
          if (remainingWeekly < templateHrs) continue; // Base DEBE cumplir turno completo
        } else {
          // Refuerzo: optimización de horas con turno parcial
          if (remainingWeekly < 4) continue; // Mínimo legal por turno: 4h
          
          finalShiftHrs = Math.min(templateHrs, remainingWeekly);
          
          // Prevenir que le sobre un remanente inutilizable (< 4) para un potencial siguiente turno
          if (remainingWeekly - finalShiftHrs > 0 && remainingWeekly - finalShiftHrs < 4) {
             finalShiftHrs = remainingWeekly - 4;
          }
          if (finalShiftHrs < 4) continue; // Fail-safe
        }

        const shiftEndActual = new Date(hIniDate.getTime() + finalShiftHrs * 3600000);

        // Asignar
        generatedShifts.push({
          employee_id: emp.id,
          template_id: slot.templateId,
          start_time: format(hIniDate, "yyyy-MM-dd'T'HH:mm"),
          end_time: format(shiftEndActual, "yyyy-MM-dd'T'HH:mm"),
          shift_type: 'custom',
          periodo: `${year}-${String(month).padStart(2, '0')}`,
          break_minutes: 0,
        });

        empAssigned = true;
        assignedAny = true;
        break; // Detener la búsqueda de empleados y recalcular scores
      }

      if (empAssigned) break; // Detener la iteración de slots y recalcular todo
    }
  }

  // Comprobación final de advertencias
  days.forEach(day => {
    if (getCoverage(day.dateStr) < minCoverage) {
      warnings.push(`El día ${day.dateStr} no alcanzó la cobertura mínima (${getCoverage(day.dateStr)}/${minCoverage})`);
    }
  });

  return { shifts: generatedShifts, warnings };
}

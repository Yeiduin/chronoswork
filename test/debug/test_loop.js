const existingShifts = [];
const generatedShifts = [
  { employee_id: '1', start_time: '2026-06-16T14:00', end_time: '2026-06-16T22:00', break_minutes: 0 },
  { employee_id: '1', start_time: '2026-06-17T14:00', end_time: '2026-06-17T22:00', break_minutes: 0 },
  { employee_id: '1', start_time: '2026-06-18T06:00', end_time: '2026-06-18T14:00', break_minutes: 0 },
  { employee_id: '1', start_time: '2026-06-19T06:00', end_time: '2026-06-19T14:00', break_minutes: 0 },
  { employee_id: '1', start_time: '2026-06-20T06:00', end_time: '2026-06-20T14:00', break_minutes: 0 }
]; // 5 shifts * 8 hrs = 40 hrs

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

const testDate = new Date('2026-06-21T00:00:00'); // Sunday!
console.log('Testing for Sunday:', testDate.toString());
console.log('Weekly Hours (Should be 40):', getWeeklyHours('1', testDate));

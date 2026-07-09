const hIni = new Date(`1970-01-01T06:00`);
const hFin = new Date(`1970-01-01T14:00`);
const shiftHrs = (hFin - hIni) / 3600000;
console.log('shiftHrs:', shiftHrs);

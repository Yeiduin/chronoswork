// ============================================================
// ChronosWork — Catálogos Oficiales de Colombia
// Bancos (SFC), EPS, AFP, ARL, Cajas de Compensación,
// Fondos de Cesantías, Departamentos y Ciudades.
// ============================================================

export const BANCOS_COLOMBIA = [
  'Bancolombia',
  'Davivienda',
  'Banco de Bogotá',
  'BBVA Colombia',
  'Banco de Occidente',
  'Banco Popular',
  'Banco AV Villas',
  'Scotiabank Colpatria',
  'Banco Agrario de Colombia',
  'Banco Caja Social',
  'Banco Falabella',
  'Banco Pichincha',
  'Banco Itaú Colombia',
  'Banco Santander Colombia',
  'Banco GNB Sudameris',
  'Banco Coopcentral',
  'Banco Serfinanza',
  'Bancamía',
  'Banco W',
  'Banco Mundo Mujer',
  'Banco Finandina (Iris)',
  'Banco Contactar',
  'Banco Unión',
  'Bancóldex',
  'Lulo Bank',
  'Nu Colombia (Nubank)',
  'Ualá Colombia',
  'Nequi',
  'Daviplata',
  'Dale!',
  'Movii',
  'Global66',
];

export const EPS_COLOMBIA = [
  { nombre: 'Nueva EPS', codigo: 'EPS037' },
  { nombre: 'EPS Sanitas', codigo: 'EPS005' },
  { nombre: 'EPS Sura', codigo: 'EPS010' },
  { nombre: 'Compensar EPS', codigo: 'EPS008' },
  { nombre: 'Salud Total EPS', codigo: 'EPS002' },
  { nombre: 'Famisanar', codigo: 'EPS017' },
  { nombre: 'Coosalud EPS', codigo: 'ESS024' },
  { nombre: 'Mutual Ser EPS', codigo: 'ESS207' },
  { nombre: 'Capital Salud EPS', codigo: 'EPSS34' },
  { nombre: 'Savia Salud EPS', codigo: 'EPSS40' },
  { nombre: 'Asmet Salud EPS', codigo: 'ESS062' },
  { nombre: 'Emssanar EPS', codigo: 'ESS118' },
  { nombre: 'Cajacopi EPS', codigo: 'CCF055' },
  { nombre: 'Comfenalco Valle EPS', codigo: 'EPS012' },
  { nombre: 'Aliansalud EPS', codigo: 'EPS001' },
  { nombre: 'Mallamas EPSI', codigo: 'EPSI05' },
  { nombre: 'Pijaos Salud EPSI', codigo: 'EPSI04' },
  { nombre: 'AIC EPSI (Asociación Indígena del Cauca)', codigo: 'EPSI03' },
  { nombre: 'Anas Wayuu EPSI', codigo: 'EPSI01' },
  { nombre: 'Dusakawi EPSI', codigo: 'EPSI02' },
  { nombre: 'Ferrocarriles Nacionales', codigo: 'EPSC20' },
  { nombre: 'Sanidad Militar / Policía Nacional', codigo: 'ESP001' },
  { nombre: 'FOMAG (Magisterio)', codigo: 'ESP002' },
];

export const AFP_COLOMBIA = [
  { nombre: 'Porvenir', codigo: '230201' },
  { nombre: 'Protección', codigo: '230301' },
  { nombre: 'Colfondos', codigo: '230901' },
  { nombre: 'Skandia', codigo: '231001' },
  { nombre: 'Colpensiones (Público - Régimen de Prima Media)', codigo: '25-14' },
];

export const FONDOS_CESANTIAS_COLOMBIA = [
  'Porvenir',
  'Protección',
  'Colfondos',
  'Skandia',
  'Fondo Nacional del Ahorro (FNA)',
];

export const ARL_COLOMBIA = [
  { nombre: 'ARL Sura (Suramericana)', codigo: '14-23' },
  { nombre: 'Positiva Compañía de Seguros', codigo: '14-28' },
  { nombre: 'Seguros Bolívar ARL', codigo: '14-25' },
  { nombre: 'Colmena Seguros ARL', codigo: '14-4' },
  { nombre: 'AXA Colpatria ARL', codigo: '14-17' },
  { nombre: 'La Equidad Seguros ARL', codigo: '14-29' },
  { nombre: 'Liberty Seguros ARL', codigo: '14-18' },
  { nombre: 'Mapfre Colombia ARL', codigo: '14-30' },
  { nombre: 'Seguros del Estado ARL', codigo: '14-27' },
  { nombre: 'Chubb Seguros ARL', codigo: '14-7' },
];

export const CAJAS_COMPENSACION_COLOMBIA = [
  'Compensar',
  'Colsubsidio',
  'Cafam',
  'Comfama',
  'Comfenalco Antioquia',
  'Comfandi',
  'Comfenalco Valle',
  'Cajacopi',
  'Comfamiliar Atlántico',
  'Combarranquilla',
  'Comfacundi',
  'Cajasan',
  'Comfenalco Santander',
  'Comfenalco Tolima',
  'Comfatolima',
  'Comfamiliar Risaralda',
  'Comfenalco Quindío',
  'Confa (Caldas)',
  'Comfamiliar Huila',
  'Comfacauca',
  'Comfamiliar Nariño',
  'Comfenalco Cartagena',
  'Comfamiliar Bolívar',
  'Comfacor (Córdoba)',
  'Comfasucre',
  'Comfacesar',
  'Comfaguajira',
  'Comfaoriente',
  'Comfanorte',
  'Comfaboy (Boyacá)',
  'Cofrem (Meta)',
  'Comfacasanare',
  'Comfiar (Arauca)',
  'Comfaca (Caquetá)',
  'Comfaputumayo',
  'Comfachocó',
  'Cajasai (San Andrés y Providencia)',
];

export const PARENTESCOS_EMERGENCIA = [
  'Cónyuge / Esposo(a)',
  'Compañero(a) permanente / Pareja',
  'Madre',
  'Padre',
  'Hijo(a)',
  'Hermano(a)',
  'Abuelo(a)',
  'Tío(a)',
  'Sobrino(a)',
  'Primo(a)',
  'Suegro(a)',
  'Amigo(a)',
  'Compañero(a) de trabajo',
];

export const DEPARTAMENTOS_Y_CIUDADES = [
  {
    departamento: 'Bogotá D.C.',
    ciudades: ['Bogotá D.C.'],
  },
  {
    departamento: 'Antioquia',
    ciudades: ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Apartadó', 'Sabaneta', 'Caucasia', 'Chigorodó', 'Copacabana', 'La Estrella', 'Marinilla', 'Turbo'],
  },
  {
    departamento: 'Valle del Cauca',
    ciudades: ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga', 'Jamundí', 'Yumbo', 'Candelaria', 'Florida', 'Pradera', 'Zarzal'],
  },
  {
    departamento: 'Cundinamarca',
    ciudades: ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Fusagasugá', 'Madrid', 'Mosquera', 'Funza', 'Girardot', 'Cajicá', 'Cota', 'Sopó', 'Tocancipá'],
  },
  {
    departamento: 'Atlántico',
    ciudades: ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Puerto Colombia', 'Baranoa', 'Galapa'],
  },
  {
    departamento: 'Santander',
    ciudades: ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro', 'Lebrija'],
  },
  {
    departamento: 'Bolívar',
    ciudades: ['Cartagena', 'Magangué', 'Carmen de Bolívar', 'Turbaco', 'Arjona', 'Mompox'],
  },
  {
    departamento: 'Tolima',
    ciudades: ['Ibagué', 'Espinal', 'Melgar', 'Chaparral', 'Honda', 'Mariquita', 'Líbano'],
  },
  {
    departamento: 'Risaralda',
    ciudades: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia'],
  },
  {
    departamento: 'Caldas',
    ciudades: ['Manizales', 'Villamaría', 'Chinchiná', 'La Dorada', 'Riosucio', 'Anserma'],
  },
  {
    departamento: 'Quindío',
    ciudades: ['Armenia', 'Calarcá', 'La Tebaida', 'Circasia', 'Montenegro', 'Quimbaya'],
  },
  {
    departamento: 'Huila',
    ciudades: ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre'],
  },
  {
    departamento: 'Nariño',
    ciudades: ['Pasto', 'Tumaco', 'Ipiales', 'Túquerres', 'La Unión', 'Samaniego'],
  },
  {
    departamento: 'Boyacá',
    ciudades: ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Puerto Boyacá', 'Villa de Leyva'],
  },
  {
    departamento: 'Meta',
    ciudades: ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'San Martín'],
  },
  {
    departamento: 'Córdoba',
    ciudades: ['Montería', 'Cereté', 'Sahagún', 'Lorica', 'Montelíbano', 'Planeta Rica'],
  },
  {
    departamento: 'Cesar',
    ciudades: ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia', 'Curumaní'],
  },
  {
    departamento: 'Norte de Santander',
    ciudades: ['Cúcuta', 'Ocaña', 'Villa del Rosario', 'Los Patios', 'Pamplona', 'Tibú'],
  },
  {
    departamento: 'Magdalena',
    ciudades: ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato', 'Aracataca'],
  },
  {
    departamento: 'Cauca',
    ciudades: ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía', 'Piendamó'],
  },
  {
    departamento: 'Sucre',
    ciudades: ['Sincelejo', 'Corozal', 'San Marcos', 'Tolú', 'Sampués'],
  },
  {
    departamento: 'La Guajira',
    ciudades: ['Riohacha', 'Maicao', 'Uribia', 'Fonseca', 'San Juan del Cesar'],
  },
  {
    departamento: 'Casanare',
    ciudades: ['Yopal', 'Aguazul', 'Villanueva', 'Tauramena', 'Paz de Ariporo'],
  },
  {
    departamento: 'Chocó',
    ciudades: ['Quibdó', 'Istmina', 'Condoto', 'Tadó', 'Acandí', 'Bahía Solano'],
  },
  {
    departamento: 'Caquetá',
    ciudades: ['Florencia', 'San Vicente del Caguán', 'Cartagena del Chairá', 'Puerto Rico'],
  },
  {
    departamento: 'Putumayo',
    ciudades: ['Mocoa', 'Puerto Asís', 'Orito', 'Valle del Guamuez', 'Sibundoy'],
  },
  {
    departamento: 'Arauca',
    ciudades: ['Arauca', 'Tame', 'Saravena', 'Arauquita', 'Fortul'],
  },
  {
    departamento: 'San Andrés y Providencia',
    ciudades: ['San Andrés', 'Providencia'],
  },
  {
    departamento: 'Amazonas',
    ciudades: ['Leticia', 'Puerto Nariño'],
  },
  {
    departamento: 'Guaviare',
    ciudades: ['San José del Guaviare', 'El Retorno', 'Calamar'],
  },
  {
    departamento: 'Guainía',
    ciudades: ['Inírida'],
  },
  {
    departamento: 'Vaupés',
    ciudades: ['Mitú'],
  },
  {
    departamento: 'Vichada',
    ciudades: ['Puerto Carreño', 'Santa Rosalía', 'Cumaribo'],
  },
];

// Helper functions for strict field cleaning
export function onlyDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
}

export function onlyLettersAndSpaces(value) {
  if (value === null || value === undefined) return '';
  // Permite letras (incluye acentos españoles, diéresis, ñ), espacios, puntos y guiones
  return String(value).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-']/g, '');
}

export function onlyTextPunctuation(value) {
  if (value === null || value === undefined) return '';
  // Permite letras, acentos, espacios, comas, puntos, guiones y barras
  return String(value).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\,\-\/\(\)]/g, '');
}

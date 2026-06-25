export const individualNiches = [
  {
    key: 'nutrition_wellness',
    label: 'Nutrición y bienestar',
  },
  {
    key: 'beauty',
    label: 'Belleza y estética',
  },
  {
    key: 'courses_academies',
    label: 'Cursos y academias',
  },
  {
    key: 'coaching_consulting',
    label: 'Coaching y consultoría',
  },
  {
    key: 'real_estate',
    label: 'Inmobiliaria',
  },
  {
    key: 'local_business',
    label: 'Negocio local',
  },
  {
    key: 'other',
    label: 'Otro',
  },
] as const;

export type IndividualNicheKey = (typeof individualNiches)[number]['key'];

export type IndividualNicheOption = {
  key: IndividualNicheKey;
  label: string;
};

export type IndividualCommercialPreset = {
  niche: IndividualNicheKey;
  defaultFunnelName: string;
  defaultFunnelGoal: string;
  suggestedCta: string;
  suggestedPipelineStages: string[];
  suggestedAiTone: string;
};

export type IndividualCommercialProfile = {
  niche: IndividualNicheKey;
  presetVersion: typeof INDIVIDUAL_COMMERCIAL_PRESET_VERSION;
};

export const INDIVIDUAL_COMMERCIAL_PRESET_VERSION = 'v1';

export const individualCommercialPresets = {
  nutrition_wellness: {
    niche: 'nutrition_wellness',
    defaultFunnelName: 'Evaluación gratuita de bienestar',
    defaultFunnelGoal: 'Capturar leads interesados en una evaluación inicial de bienestar.',
    suggestedCta: 'Quiero mi evaluación',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Interesado',
      'Evaluación',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'cercano, motivador, saludable',
  },
  beauty: {
    niche: 'beauty',
    defaultFunnelName: 'Reserva tu diagnóstico de belleza',
    defaultFunnelGoal: 'Convertir prospectos en reservas para una consulta o diagnóstico.',
    suggestedCta: 'Quiero reservar',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Consulta',
      'Reserva',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'cálido, aspiracional, visual',
  },
  courses_academies: {
    niche: 'courses_academies',
    defaultFunnelName: 'Solicita información del programa',
    defaultFunnelGoal: 'Capturar interesados y guiarlos hacia inscripción.',
    suggestedCta: 'Quiero información',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Información enviada',
      'Seguimiento',
      'Inscripción',
      'Alumno',
    ],
    suggestedAiTone: 'claro, educativo, orientado a decisión',
  },
  coaching_consulting: {
    niche: 'coaching_consulting',
    defaultFunnelName: 'Agenda una llamada inicial',
    defaultFunnelGoal: 'Llevar prospectos calificados a una llamada de diagnóstico.',
    suggestedCta: 'Quiero una llamada',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Diagnóstico',
      'Propuesta',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'profesional, consultivo, directo',
  },
  real_estate: {
    niche: 'real_estate',
    defaultFunnelName: 'Encuentra la propiedad ideal',
    defaultFunnelGoal: 'Calificar intención y coordinar asesoría o visita.',
    suggestedCta: 'Quiero asesoría',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Calificado',
      'Visita',
      'Propuesta',
      'Cierre',
    ],
    suggestedAiTone: 'confiable, asesor, oportuno',
  },
  local_business: {
    niche: 'local_business',
    defaultFunnelName: 'Solicita atención por WhatsApp',
    defaultFunnelGoal: 'Canalizar consultas locales hacia atención rápida.',
    suggestedCta: 'Quiero atención',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Consulta',
      'Cotización',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'práctico, rápido, amable',
  },
  other: {
    niche: 'other',
    defaultFunnelName: 'Solicita más información',
    defaultFunnelGoal: 'Capturar interesados y abrir una conversación comercial.',
    suggestedCta: 'Quiero más información',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Contactado',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'claro, amable, útil',
  },
} as const satisfies Record<IndividualNicheKey, IndividualCommercialPreset>;

const individualNicheKeys = new Set<IndividualNicheKey>(
  individualNiches.map((niche) => niche.key),
);

const normalizeLookupValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

const nicheAliases = new Map<string, IndividualNicheKey>([
  ['nutricion', 'nutrition_wellness'],
  ['nutricion_bienestar', 'nutrition_wellness'],
  ['nutricion_y_bienestar', 'nutrition_wellness'],
  ['wellness', 'nutrition_wellness'],
  ['belleza', 'beauty'],
  ['belleza_y_estetica', 'beauty'],
  ['cursos_academias', 'courses_academies'],
  ['cursos_y_academias', 'courses_academies'],
  ['coaching_consultoria', 'coaching_consulting'],
  ['coaching_y_consultoria', 'coaching_consulting'],
  ['inmobiliaria', 'real_estate'],
  ['negocio_local', 'local_business'],
  ['otro', 'other'],
]);

export const isIndividualNicheKey = (
  value: string | null | undefined,
): value is IndividualNicheKey =>
  typeof value === 'string' &&
  individualNicheKeys.has(value as IndividualNicheKey);

export const normalizeIndividualNicheKey = (
  value: string | null | undefined,
): IndividualNicheKey => {
  if (!value) {
    return 'other';
  }

  if (isIndividualNicheKey(value)) {
    return value;
  }

  return nicheAliases.get(normalizeLookupValue(value)) ?? 'other';
};

export const getIndividualCommercialPreset = (
  niche: string | null | undefined,
): IndividualCommercialPreset =>
  individualCommercialPresets[normalizeIndividualNicheKey(niche)];

export const buildIndividualCommercialProfile = (
  niche: string | null | undefined,
): IndividualCommercialProfile => ({
  niche: normalizeIndividualNicheKey(niche),
  presetVersion: INDIVIDUAL_COMMERCIAL_PRESET_VERSION,
});

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

type CommercialOption<Key extends string = string> = {
  key: Key;
  label: string;
};

export const commercialVerticals = [
  {
    key: 'mlm',
    label: 'Multinivel / Redes',
    usage:
      'Herbalife, DXN, Omnilife, network marketing, distribuidores independientes.',
  },
  {
    key: 'consulting_services',
    label: 'Consultoría y servicios profesionales',
    usage: 'Coaches, consultores, agencias, servicios B2B, mentores.',
  },
  {
    key: 'education',
    label: 'Educación y cursos',
    usage: 'Cursos online, academias, idiomas, formación.',
  },
  {
    key: 'real_estate',
    label: 'Inmobiliaria',
    usage: 'Agentes, brokers, propiedades, desarrollos.',
  },
  {
    key: 'health_wellness',
    label: 'Salud y bienestar',
    usage: 'Nutrición no MLM, fitness, terapias, bienestar independiente.',
  },
  {
    key: 'beauty_aesthetics',
    label: 'Belleza y estética',
    usage: 'Salones, estética, skincare, tratamientos.',
  },
  {
    key: 'local_business',
    label: 'Negocio local',
    usage: 'Restaurantes, talleres, servicios locales, tiendas físicas.',
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    usage: 'Tiendas online, productos físicos, DTC.',
  },
  {
    key: 'insurance_finance',
    label: 'Seguros y finanzas',
    usage: 'Seguros, créditos, inversiones, asesoría financiera.',
  },
  {
    key: 'recruiting_hr',
    label: 'Reclutamiento / RRHH',
    usage: 'Reclutadores, empleos, talento.',
  },
  {
    key: 'other',
    label: 'Otro',
    usage: 'Negocios que no encajan todavía en una vertical oficial.',
  },
] as const;

export type CommercialVerticalKey =
  (typeof commercialVerticals)[number]['key'];

export type CommercialVerticalOption = CommercialOption<CommercialVerticalKey> & {
  usage: string;
};

export const industriesByVertical = {
  mlm: [
    { key: 'nutrition_mlm', label: 'Nutrición MLM' },
    { key: 'beauty_mlm', label: 'Belleza MLM' },
    { key: 'wellness_mlm', label: 'Bienestar MLM' },
    { key: 'finance_mlm', label: 'Finanzas MLM' },
    { key: 'other_mlm', label: 'Otro MLM' },
  ],
  consulting_services: [
    { key: 'coaching', label: 'Coaching' },
    { key: 'business_consulting', label: 'Consultoría de negocio' },
    { key: 'marketing_agency', label: 'Agencia de marketing' },
    { key: 'legal_services', label: 'Servicios legales' },
    { key: 'accounting', label: 'Contabilidad' },
    { key: 'personal_brand', label: 'Marca personal' },
    { key: 'other_consulting', label: 'Otra consultoría' },
  ],
  education: [
    { key: 'online_courses', label: 'Cursos online' },
    { key: 'academy', label: 'Academia' },
    { key: 'languages', label: 'Idiomas' },
    { key: 'professional_training', label: 'Formación profesional' },
    { key: 'tutoring', label: 'Tutorías' },
    { key: 'other_education', label: 'Otra educación' },
  ],
  real_estate: [
    { key: 'residential', label: 'Residencial' },
    { key: 'commercial', label: 'Comercial' },
    { key: 'rentals', label: 'Alquileres' },
    { key: 'developments', label: 'Desarrollos' },
    { key: 'land', label: 'Terrenos' },
    { key: 'other_real_estate', label: 'Otra inmobiliaria' },
  ],
  health_wellness: [
    { key: 'nutrition', label: 'Nutrición' },
    { key: 'fitness', label: 'Fitness' },
    { key: 'therapy', label: 'Terapia' },
    { key: 'alternative_health', label: 'Salud alternativa' },
    { key: 'wellness_center', label: 'Centro de bienestar' },
    { key: 'other_health', label: 'Otra salud y bienestar' },
  ],
  beauty_aesthetics: [
    { key: 'salon', label: 'Salón' },
    { key: 'skincare', label: 'Skincare' },
    { key: 'aesthetic_clinic', label: 'Clínica estética' },
    { key: 'spa', label: 'Spa' },
    { key: 'makeup', label: 'Maquillaje' },
    { key: 'other_beauty', label: 'Otra belleza' },
  ],
  local_business: [
    { key: 'restaurant', label: 'Restaurante' },
    { key: 'repair_service', label: 'Servicio de reparación' },
    { key: 'retail_store', label: 'Tienda física' },
    { key: 'automotive', label: 'Automotriz' },
    { key: 'home_services', label: 'Servicios del hogar' },
    { key: 'other_local', label: 'Otro negocio local' },
  ],
  ecommerce: [
    { key: 'physical_products', label: 'Productos físicos' },
    { key: 'digital_products', label: 'Productos digitales' },
    { key: 'dropshipping', label: 'Dropshipping' },
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'other_ecommerce', label: 'Otro e-commerce' },
  ],
  insurance_finance: [
    { key: 'insurance', label: 'Seguros' },
    { key: 'credit', label: 'Créditos' },
    { key: 'investments', label: 'Inversiones' },
    { key: 'financial_advisory', label: 'Asesoría financiera' },
    { key: 'other_finance', label: 'Otra finanza' },
  ],
  recruiting_hr: [
    { key: 'recruiting_agency', label: 'Agencia de reclutamiento' },
    { key: 'job_board', label: 'Bolsa de trabajo' },
    { key: 'internal_hr', label: 'RRHH interno' },
    { key: 'staffing', label: 'Staffing' },
    { key: 'other_hr', label: 'Otro RRHH' },
  ],
  other: [{ key: 'other', label: 'Otro' }],
} as const satisfies Record<CommercialVerticalKey, readonly CommercialOption[]>;

export type CommercialIndustryKey =
  (typeof industriesByVertical)[CommercialVerticalKey][number]['key'];

export type CommercialIndustryOption = CommercialOption<CommercialIndustryKey>;

export const businessModels = [
  { key: 'distributor', label: 'Distribuidor' },
  { key: 'consultant', label: 'Consultor' },
  { key: 'advisor', label: 'Asesor' },
  { key: 'service_provider', label: 'Proveedor de servicio' },
  { key: 'course_seller', label: 'Vendedor de cursos' },
  { key: 'local_service', label: 'Servicio local' },
  { key: 'ecommerce_seller', label: 'Vendedor e-commerce' },
  { key: 'recruiter', label: 'Reclutador' },
  { key: 'broker', label: 'Broker' },
  { key: 'other', label: 'Otro' },
] as const;

export type BusinessModelKey = (typeof businessModels)[number]['key'];

export type CommercialBusinessModelKey = BusinessModelKey;

export type BusinessModelOption = CommercialOption<BusinessModelKey>;

export type CommercialTaxonomy = {
  vertical: CommercialVerticalKey;
  industry: CommercialIndustryKey;
  businessModel: BusinessModelKey;
};

export type BusinessBlueprintVersion = 'v1';

export type BusinessBlueprintFunnel = {
  funnelKey: string;
  label: string;
  goal: string;
  suggestedCta: string;
  recommendedPath: string;
};

export type BusinessBlueprintPlaybook = {
  key: string;
  label: string;
  goal: string;
};

export type BusinessBlueprint = {
  blueprintKey: string;
  version: BusinessBlueprintVersion;
  label: string;
  description: string;
  vertical: CommercialVerticalKey;
  industries?: readonly CommercialIndustryKey[];
  businessModels?: readonly CommercialBusinessModelKey[];
  positioning: {
    primaryPromise: string;
    audience: string;
    offerType: string;
    salesMotion: string;
  };
  crm: {
    defaultPipelineName: string;
    stages: readonly string[];
  };
  funnelLibrary: {
    recommendedFirstFunnelKey: string;
    funnels: readonly BusinessBlueprintFunnel[];
  };
  ai: {
    promptKey: string;
    tone: string;
    assistantRole: string;
    qualificationQuestions: readonly string[];
  };
  automation: {
    n8nWorkflowKey: string;
    recommendedEvents: readonly string[];
  };
  metrics: {
    primaryKpi: string;
    secondaryKpis: readonly string[];
  };
  playbooks: readonly BusinessBlueprintPlaybook[];
};

export type BusinessBlueprintResolvableProfile = {
  vertical?: CommercialVerticalKey | string | null;
  industry?: CommercialIndustryKey | string | null;
  businessModel?: CommercialBusinessModelKey | string | null;
};

export type CommercialVerticalPreset = {
  vertical: CommercialVerticalKey;
  label: string;
  defaultFunnelName: string;
  defaultFunnelGoal: string;
  suggestedCta: string;
  suggestedPipelineStages: readonly string[];
  suggestedAiTone: string;
  futureN8nWorkflowKey: string;
  futureAiPromptKey: string;
};

export type IndividualCommercialPreset = CommercialVerticalPreset;

export type IndividualCommercialProfile = CommercialTaxonomy & {
  legacyNiche: IndividualNicheKey;
  presetVersion: typeof INDIVIDUAL_COMMERCIAL_PRESET_VERSION;
  blueprintKey: string;
  blueprintVersion: BusinessBlueprintVersion;
};

export const INDIVIDUAL_COMMERCIAL_PRESET_VERSION = 'v2';

export const commercialVerticalPresets = {
  mlm: {
    vertical: 'mlm',
    label: 'Multinivel / Redes',
    defaultFunnelName: 'Evalúa una oportunidad',
    defaultFunnelGoal:
      'Capturar prospectos interesados en una oportunidad o producto multinivel.',
    suggestedCta: 'Quiero conocer la oportunidad',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Contactado',
      'Presentación',
      'Seguimiento',
      'Registro',
    ],
    suggestedAiTone: 'cercano, aspiracional, orientado a oportunidad',
    futureN8nWorkflowKey: 'vertical_mlm_v1',
    futureAiPromptKey: 'mlm_advisor_v1',
  },
  consulting_services: {
    vertical: 'consulting_services',
    label: 'Consultoría y servicios profesionales',
    defaultFunnelName: 'Agenda un diagnóstico',
    defaultFunnelGoal:
      'Capturar prospectos que necesitan diagnóstico, propuesta o asesoría profesional.',
    suggestedCta: 'Quiero agendar un diagnóstico',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Diagnóstico',
      'Propuesta',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'profesional, consultivo, directo',
    futureN8nWorkflowKey: 'vertical_consulting_v1',
    futureAiPromptKey: 'consulting_advisor_v1',
  },
  education: {
    vertical: 'education',
    label: 'Educación y cursos',
    defaultFunnelName: 'Solicita información del programa',
    defaultFunnelGoal:
      'Capturar interesados y guiarlos hacia inscripción en un programa educativo.',
    suggestedCta: 'Quiero información',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Información enviada',
      'Seguimiento',
      'Inscripción',
      'Alumno',
    ],
    suggestedAiTone: 'claro, educativo, orientado a decisión',
    futureN8nWorkflowKey: 'vertical_education_v1',
    futureAiPromptKey: 'education_advisor_v1',
  },
  real_estate: {
    vertical: 'real_estate',
    label: 'Inmobiliaria',
    defaultFunnelName: 'Encuentra la propiedad ideal',
    defaultFunnelGoal:
      'Calificar intención y coordinar asesoría o visita para propiedades.',
    suggestedCta: 'Quiero asesoría',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Calificado',
      'Visita',
      'Propuesta',
      'Cierre',
    ],
    suggestedAiTone: 'confiable, asesor, oportuno',
    futureN8nWorkflowKey: 'vertical_real_estate_v1',
    futureAiPromptKey: 'real_estate_advisor_v1',
  },
  health_wellness: {
    vertical: 'health_wellness',
    label: 'Salud y bienestar',
    defaultFunnelName: 'Agenda tu evaluación de bienestar',
    defaultFunnelGoal:
      'Capturar prospectos interesados en una evaluación o asesoría de bienestar.',
    suggestedCta: 'Quiero mi evaluación',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Interesado',
      'Evaluación',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'cercano, motivador, saludable',
    futureN8nWorkflowKey: 'vertical_health_wellness_v1',
    futureAiPromptKey: 'health_wellness_advisor_v1',
  },
  beauty_aesthetics: {
    vertical: 'beauty_aesthetics',
    label: 'Belleza y estética',
    defaultFunnelName: 'Reserva tu diagnóstico de belleza',
    defaultFunnelGoal:
      'Convertir prospectos en reservas para una consulta o diagnóstico de belleza.',
    suggestedCta: 'Quiero reservar',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Consulta',
      'Reserva',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'cálido, aspiracional, visual',
    futureN8nWorkflowKey: 'vertical_beauty_v1',
    futureAiPromptKey: 'beauty_advisor_v1',
  },
  local_business: {
    vertical: 'local_business',
    label: 'Negocio local',
    defaultFunnelName: 'Solicita atención por WhatsApp',
    defaultFunnelGoal:
      'Canalizar consultas locales hacia atención rápida y seguimiento comercial.',
    suggestedCta: 'Quiero atención',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Consulta',
      'Cotización',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'práctico, rápido, amable',
    futureN8nWorkflowKey: 'vertical_local_business_v1',
    futureAiPromptKey: 'local_business_advisor_v1',
  },
  ecommerce: {
    vertical: 'ecommerce',
    label: 'E-commerce',
    defaultFunnelName: 'Descubre nuestra oferta',
    defaultFunnelGoal:
      'Capturar interés en productos y llevar prospectos hacia una compra.',
    suggestedCta: 'Quiero ver la oferta',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Producto visto',
      'Carrito/Interés',
      'Seguimiento',
      'Compra',
    ],
    suggestedAiTone: 'claro, persuasivo, orientado a compra',
    futureN8nWorkflowKey: 'vertical_ecommerce_v1',
    futureAiPromptKey: 'ecommerce_advisor_v1',
  },
  insurance_finance: {
    vertical: 'insurance_finance',
    label: 'Seguros y finanzas',
    defaultFunnelName: 'Solicita una asesoría',
    defaultFunnelGoal:
      'Calificar necesidades financieras y abrir una asesoría o cotización.',
    suggestedCta: 'Quiero una asesoría',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Calificado',
      'Cotización',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'confiable, claro, prudente',
    futureN8nWorkflowKey: 'vertical_insurance_finance_v1',
    futureAiPromptKey: 'insurance_finance_advisor_v1',
  },
  recruiting_hr: {
    vertical: 'recruiting_hr',
    label: 'Reclutamiento / RRHH',
    defaultFunnelName: 'Postula o agenda entrevista',
    defaultFunnelGoal:
      'Capturar candidatos o empresas interesadas y avanzar hacia entrevista o contratación.',
    suggestedCta: 'Quiero postular',
    suggestedPipelineStages: [
      'Nuevo candidato',
      'Calificado',
      'Entrevista',
      'Oferta',
      'Contratado',
    ],
    suggestedAiTone: 'claro, humano, orientado a calificación',
    futureN8nWorkflowKey: 'vertical_recruiting_hr_v1',
    futureAiPromptKey: 'recruiting_hr_advisor_v1',
  },
  other: {
    vertical: 'other',
    label: 'Otro',
    defaultFunnelName: 'Solicita más información',
    defaultFunnelGoal:
      'Capturar interesados y abrir una conversación comercial.',
    suggestedCta: 'Quiero más información',
    suggestedPipelineStages: [
      'Nuevo lead',
      'Contactado',
      'Seguimiento',
      'Cliente',
    ],
    suggestedAiTone: 'claro, amable, útil',
    futureN8nWorkflowKey: 'vertical_other_v1',
    futureAiPromptKey: 'other_advisor_v1',
  },
} as const satisfies Record<CommercialVerticalKey, CommercialVerticalPreset>;

type BusinessBlueprintDefinition = {
  blueprintKey: string;
  description: string;
  vertical: CommercialVerticalKey;
  industries?: readonly CommercialIndustryKey[];
  businessModels?: readonly CommercialBusinessModelKey[];
  positioning: BusinessBlueprint['positioning'];
  defaultPipelineName: string;
  funnels: readonly BusinessBlueprintFunnel[];
  assistantRole: string;
  qualificationQuestions: readonly string[];
  recommendedEvents: readonly string[];
  metrics: BusinessBlueprint['metrics'];
  playbooks: readonly BusinessBlueprintPlaybook[];
};

const createBusinessBlueprint = (
  definition: BusinessBlueprintDefinition,
): BusinessBlueprint => {
  const preset = commercialVerticalPresets[definition.vertical];
  const recommendedFirstFunnelKey = definition.funnels[0]?.funnelKey ?? '';

  return {
    blueprintKey: definition.blueprintKey,
    version: 'v1',
    label: preset.label,
    description: definition.description,
    vertical: definition.vertical,
    industries: definition.industries,
    businessModels: definition.businessModels,
    positioning: definition.positioning,
    crm: {
      defaultPipelineName: definition.defaultPipelineName,
      stages: preset.suggestedPipelineStages,
    },
    funnelLibrary: {
      recommendedFirstFunnelKey,
      funnels: definition.funnels,
    },
    ai: {
      promptKey: preset.futureAiPromptKey,
      tone: preset.suggestedAiTone,
      assistantRole: definition.assistantRole,
      qualificationQuestions: definition.qualificationQuestions,
    },
    automation: {
      n8nWorkflowKey: preset.futureN8nWorkflowKey,
      recommendedEvents: definition.recommendedEvents,
    },
    metrics: definition.metrics,
    playbooks: definition.playbooks,
  };
};

export const businessBlueprints = [
  createBusinessBlueprint({
    blueprintKey: 'blueprint.mlm.v1',
    description:
      'Base conceptual para multinivel, redes de distribucion y oportunidades con seguimiento personal.',
    vertical: 'mlm',
    positioning: {
      primaryPromise: 'Ayudar al prospecto a evaluar una oportunidad con claridad.',
      audience: 'Prospectos interesados en producto, negocio o comunidad.',
      offerType: 'Oportunidad guiada o evaluacion inicial.',
      salesMotion: 'Conversacion consultiva con seguimiento recurrente.',
    },
    defaultPipelineName: 'Pipeline MLM',
    funnels: [
      {
        funnelKey: 'funnel.mlm.opportunity_evaluation.v1',
        label: 'Evalua una oportunidad',
        goal: 'Capturar interes y abrir una conversacion sobre producto u oportunidad.',
        suggestedCta: 'Quiero conocer la oportunidad',
        recommendedPath: 'mlm/opportunity-evaluation',
      },
    ],
    assistantRole:
      'Asesor que califica interes, contexto y momento del prospecto sin presionar.',
    qualificationQuestions: [
      'Que te interesa mas: producto, negocio o ambas cosas?',
      'Has participado antes en una red o multinivel?',
      'Cual seria tu meta principal en los proximos 90 dias?',
    ],
    recommendedEvents: [
      'lead_captured',
      'opportunity_requested',
      'presentation_scheduled',
      'follow_up_due',
    ],
    metrics: {
      primaryKpi: 'Prospectos calificados',
      secondaryKpis: ['Presentaciones agendadas', 'Seguimientos completados', 'Registros'],
    },
    playbooks: [
      {
        key: 'mlm_first_contact',
        label: 'Primer contacto MLM',
        goal: 'Abrir conversacion y detectar motivacion principal.',
      },
      {
        key: 'mlm_follow_up_72h',
        label: 'Seguimiento 72 horas',
        goal: 'Retomar interes despues de la presentacion.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.consulting_services.v1',
    description:
      'Base conceptual para consultores, agencias, coaches y servicios profesionales.',
    vertical: 'consulting_services',
    positioning: {
      primaryPromise: 'Convertir problemas visibles en diagnosticos accionables.',
      audience: 'Personas o empresas que necesitan criterio experto.',
      offerType: 'Diagnostico, auditoria o sesion de estrategia.',
      salesMotion: 'Venta consultiva basada en problema, propuesta y cierre.',
    },
    defaultPipelineName: 'Pipeline Consultoria',
    funnels: [
      {
        funnelKey: 'funnel.consulting.diagnostic_call.v1',
        label: 'Agenda un diagnostico',
        goal: 'Calificar necesidad y llevar al prospecto a una llamada.',
        suggestedCta: 'Quiero agendar un diagnostico',
        recommendedPath: 'consulting/diagnostic-call',
      },
    ],
    assistantRole:
      'Consultor inicial que entiende el problema, presupuesto y urgencia antes de proponer.',
    qualificationQuestions: [
      'Que problema quieres resolver primero?',
      'Que has intentado hasta ahora?',
      'Cuando te gustaria ver un resultado concreto?',
    ],
    recommendedEvents: [
      'lead_captured',
      'diagnostic_requested',
      'proposal_requested',
      'deal_won',
    ],
    metrics: {
      primaryKpi: 'Diagnosticos agendados',
      secondaryKpis: ['Propuestas enviadas', 'Tasa de cierre', 'Ticket promedio'],
    },
    playbooks: [
      {
        key: 'consulting_discovery',
        label: 'Descubrimiento consultivo',
        goal: 'Entender contexto, dolor y criterio de decision.',
      },
      {
        key: 'consulting_proposal_follow_up',
        label: 'Seguimiento de propuesta',
        goal: 'Resolver objeciones y avanzar a decision.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.education.v1',
    description:
      'Base conceptual para cursos, academias, formacion profesional y programas educativos.',
    vertical: 'education',
    positioning: {
      primaryPromise: 'Guiar al estudiante hacia el programa correcto.',
      audience: 'Interesados en aprender una habilidad o iniciar una formacion.',
      offerType: 'Programa educativo, curso o inscripcion.',
      salesMotion: 'Informacion, orientacion y cierre de inscripcion.',
    },
    defaultPipelineName: 'Pipeline Educacion',
    funnels: [
      {
        funnelKey: 'funnel.education.program_info.v1',
        label: 'Solicita informacion del programa',
        goal: 'Capturar interesados y resolver dudas antes de inscripcion.',
        suggestedCta: 'Quiero informacion',
        recommendedPath: 'education/program-info',
      },
    ],
    assistantRole:
      'Orientador academico que califica objetivo, nivel y disponibilidad del estudiante.',
    qualificationQuestions: [
      'Que objetivo quieres lograr con este programa?',
      'Cual es tu nivel actual?',
      'Cuando te gustaria empezar?',
    ],
    recommendedEvents: [
      'lead_captured',
      'program_info_requested',
      'enrollment_started',
      'enrollment_completed',
    ],
    metrics: {
      primaryKpi: 'Inscripciones iniciadas',
      secondaryKpis: ['Solicitudes de informacion', 'Asistencias a clase demo', 'Inscripciones'],
    },
    playbooks: [
      {
        key: 'education_program_fit',
        label: 'Ajuste de programa',
        goal: 'Recomendar siguiente paso segun objetivo y nivel.',
      },
      {
        key: 'education_enrollment_follow_up',
        label: 'Seguimiento de inscripcion',
        goal: 'Ayudar a completar requisitos y pago.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.real_estate.v1',
    description:
      'Base conceptual para agentes, brokers, alquileres, desarrollos y propiedades.',
    vertical: 'real_estate',
    positioning: {
      primaryPromise: 'Conectar compradores o arrendatarios con opciones viables.',
      audience: 'Personas que buscan comprar, alquilar, vender o invertir.',
      offerType: 'Asesoria inmobiliaria, visita o seleccion de propiedades.',
      salesMotion: 'Calificacion de necesidad, visita y negociacion.',
    },
    defaultPipelineName: 'Pipeline Inmobiliaria',
    funnels: [
      {
        funnelKey: 'funnel.real_estate.property_match.v1',
        label: 'Encuentra la propiedad ideal',
        goal: 'Calificar intencion, presupuesto y zona para coordinar asesoria.',
        suggestedCta: 'Quiero asesoria',
        recommendedPath: 'real-estate/property-match',
      },
    ],
    assistantRole:
      'Asesor inmobiliario que filtra ubicacion, presupuesto, plazo e intencion.',
    qualificationQuestions: [
      'Buscas comprar, alquilar, vender o invertir?',
      'En que zona estas buscando?',
      'Cual es tu presupuesto aproximado?',
    ],
    recommendedEvents: [
      'lead_captured',
      'property_interest_submitted',
      'visit_scheduled',
      'offer_submitted',
    ],
    metrics: {
      primaryKpi: 'Visitas agendadas',
      secondaryKpis: ['Leads calificados', 'Propuestas enviadas', 'Cierres'],
    },
    playbooks: [
      {
        key: 'real_estate_buyer_qualification',
        label: 'Calificacion de comprador',
        goal: 'Validar necesidad, presupuesto y plazo.',
      },
      {
        key: 'real_estate_visit_follow_up',
        label: 'Seguimiento post visita',
        goal: 'Recoger feedback y proponer siguiente propiedad o cierre.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.health_wellness.v1',
    description:
      'Base conceptual para nutricion, fitness, terapias y bienestar independiente.',
    vertical: 'health_wellness',
    positioning: {
      primaryPromise: 'Acompanar al cliente hacia una evaluacion de bienestar personalizada.',
      audience: 'Personas que buscan mejorar salud, energia, habitos o bienestar.',
      offerType: 'Evaluacion, plan inicial o consulta de bienestar.',
      salesMotion: 'Confianza, diagnostico liviano y seguimiento de habitos.',
    },
    defaultPipelineName: 'Pipeline Salud y Bienestar',
    funnels: [
      {
        funnelKey: 'funnel.health_wellness.wellness_assessment.v1',
        label: 'Agenda tu evaluacion de bienestar',
        goal: 'Capturar interesados y llevarlos a una evaluacion inicial.',
        suggestedCta: 'Quiero mi evaluacion',
        recommendedPath: 'health-wellness/wellness-assessment',
      },
    ],
    assistantRole:
      'Asesor de bienestar que entiende metas, restricciones y disponibilidad.',
    qualificationQuestions: [
      'Que meta de bienestar quieres priorizar?',
      'Tienes alguna restriccion o condicion relevante?',
      'Que tan pronto quieres empezar?',
    ],
    recommendedEvents: [
      'lead_captured',
      'assessment_requested',
      'appointment_scheduled',
      'plan_started',
    ],
    metrics: {
      primaryKpi: 'Evaluaciones agendadas',
      secondaryKpis: ['Planes iniciados', 'Seguimientos completados', 'Clientes activos'],
    },
    playbooks: [
      {
        key: 'health_goal_discovery',
        label: 'Descubrimiento de metas',
        goal: 'Entender motivacion, urgencia y barreras.',
      },
      {
        key: 'health_plan_activation',
        label: 'Activacion de plan',
        goal: 'Convertir evaluacion en primer paso concreto.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.beauty_aesthetics.v1',
    description:
      'Base conceptual para salones, skincare, spas, clinicas esteticas y tratamientos.',
    vertical: 'beauty_aesthetics',
    positioning: {
      primaryPromise: 'Ayudar al cliente a elegir el tratamiento o servicio adecuado.',
      audience: 'Personas interesadas en imagen, cuidado personal o estetica.',
      offerType: 'Diagnostico, reserva o tratamiento.',
      salesMotion: 'Consulta visual, reserva y reactivacion.',
    },
    defaultPipelineName: 'Pipeline Belleza y Estetica',
    funnels: [
      {
        funnelKey: 'funnel.beauty_aesthetics.beauty_diagnostic.v1',
        label: 'Reserva tu diagnostico de belleza',
        goal: 'Convertir interes en reserva o consulta inicial.',
        suggestedCta: 'Quiero reservar',
        recommendedPath: 'beauty-aesthetics/beauty-diagnostic',
      },
    ],
    assistantRole:
      'Asesor de belleza que identifica necesidad, preferencia y disponibilidad para reserva.',
    qualificationQuestions: [
      'Que servicio o resultado estas buscando?',
      'Has realizado este tratamiento antes?',
      'Que dia te queda mejor para una reserva?',
    ],
    recommendedEvents: [
      'lead_captured',
      'diagnostic_requested',
      'booking_scheduled',
      'booking_completed',
    ],
    metrics: {
      primaryKpi: 'Reservas agendadas',
      secondaryKpis: ['Consultas recibidas', 'Asistencias', 'Clientes recurrentes'],
    },
    playbooks: [
      {
        key: 'beauty_booking_confirmation',
        label: 'Confirmacion de reserva',
        goal: 'Reducir ausencias y preparar al cliente.',
      },
      {
        key: 'beauty_reactivation',
        label: 'Reactivacion de cliente',
        goal: 'Impulsar nueva visita o tratamiento complementario.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.local_business.v1',
    description:
      'Base conceptual para restaurantes, talleres, tiendas fisicas y servicios locales.',
    vertical: 'local_business',
    positioning: {
      primaryPromise: 'Convertir consultas locales en atencion rapida y ventas.',
      audience: 'Clientes cercanos que necesitan informacion, precio o disponibilidad.',
      offerType: 'Atencion, cotizacion, reserva o pedido.',
      salesMotion: 'Respuesta rapida, confirmacion y visita o compra.',
    },
    defaultPipelineName: 'Pipeline Negocio Local',
    funnels: [
      {
        funnelKey: 'funnel.local_business.whatsapp_attention.v1',
        label: 'Solicita atencion por WhatsApp',
        goal: 'Canalizar consultas locales hacia una respuesta comercial rapida.',
        suggestedCta: 'Quiero atencion',
        recommendedPath: 'local-business/whatsapp-attention',
      },
    ],
    assistantRole:
      'Asistente local que confirma necesidad, ubicacion, horario y siguiente accion.',
    qualificationQuestions: [
      'Que necesitas hoy?',
      'En que zona te encuentras?',
      'Prefieres cotizacion, reserva o visita?',
    ],
    recommendedEvents: [
      'lead_captured',
      'local_inquiry_received',
      'quote_requested',
      'visit_or_order_confirmed',
    ],
    metrics: {
      primaryKpi: 'Consultas atendidas',
      secondaryKpis: ['Cotizaciones enviadas', 'Reservas confirmadas', 'Ventas locales'],
    },
    playbooks: [
      {
        key: 'local_fast_response',
        label: 'Respuesta rapida local',
        goal: 'Responder con datos minimos para avanzar a compra o visita.',
      },
      {
        key: 'local_quote_follow_up',
        label: 'Seguimiento de cotizacion',
        goal: 'Cerrar consultas que pidieron precio.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.ecommerce.v1',
    description:
      'Base conceptual para tiendas online, productos fisicos, digitales y DTC.',
    vertical: 'ecommerce',
    positioning: {
      primaryPromise: 'Convertir interes por producto en compra o recompra.',
      audience: 'Compradores que comparan opciones, precio, envio o disponibilidad.',
      offerType: 'Producto, oferta, carrito o recomendacion.',
      salesMotion: 'Descubrimiento de producto, objeciones y cierre transaccional.',
    },
    defaultPipelineName: 'Pipeline E-commerce',
    funnels: [
      {
        funnelKey: 'funnel.ecommerce.product_offer.v1',
        label: 'Descubre nuestra oferta',
        goal: 'Capturar interes en productos y guiar hacia compra.',
        suggestedCta: 'Quiero ver la oferta',
        recommendedPath: 'ecommerce/product-offer',
      },
    ],
    assistantRole:
      'Asistente comercial que recomienda productos y resuelve dudas de compra.',
    qualificationQuestions: [
      'Que tipo de producto estas buscando?',
      'Tienes una preferencia de precio o caracteristica?',
      'Cuando te gustaria recibirlo?',
    ],
    recommendedEvents: [
      'lead_captured',
      'product_interest_submitted',
      'cart_started',
      'purchase_completed',
    ],
    metrics: {
      primaryKpi: 'Compras completadas',
      secondaryKpis: ['Interes por producto', 'Carritos iniciados', 'Valor promedio de orden'],
    },
    playbooks: [
      {
        key: 'ecommerce_product_recommendation',
        label: 'Recomendacion de producto',
        goal: 'Guiar al comprador hacia la opcion mas relevante.',
      },
      {
        key: 'ecommerce_cart_recovery',
        label: 'Recuperacion de carrito',
        goal: 'Resolver dudas y recuperar intencion de compra.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.insurance_finance.v1',
    description:
      'Base conceptual para seguros, creditos, inversiones y asesoria financiera.',
    vertical: 'insurance_finance',
    positioning: {
      primaryPromise: 'Traducir necesidades financieras en una asesoria clara.',
      audience: 'Personas o empresas que necesitan proteccion, credito o plan financiero.',
      offerType: 'Asesoria, cotizacion o evaluacion financiera.',
      salesMotion: 'Calificacion responsable, cotizacion y decision informada.',
    },
    defaultPipelineName: 'Pipeline Seguros y Finanzas',
    funnels: [
      {
        funnelKey: 'funnel.insurance_finance.advisory_request.v1',
        label: 'Solicita una asesoria',
        goal: 'Calificar necesidades y abrir asesoria o cotizacion.',
        suggestedCta: 'Quiero una asesoria',
        recommendedPath: 'insurance-finance/advisory-request',
      },
    ],
    assistantRole:
      'Asesor inicial que recopila necesidad, perfil y urgencia con lenguaje claro.',
    qualificationQuestions: [
      'Que necesitas resolver: seguro, credito, inversion u otra asesoria?',
      'Es para ti, tu familia o tu negocio?',
      'Cuando necesitas tomar una decision?',
    ],
    recommendedEvents: [
      'lead_captured',
      'advisory_requested',
      'quote_requested',
      'application_started',
    ],
    metrics: {
      primaryKpi: 'Asesorias calificadas',
      secondaryKpis: ['Cotizaciones enviadas', 'Solicitudes iniciadas', 'Cierres'],
    },
    playbooks: [
      {
        key: 'finance_needs_assessment',
        label: 'Evaluacion de necesidad',
        goal: 'Identificar producto, riesgo y contexto.',
      },
      {
        key: 'finance_quote_follow_up',
        label: 'Seguimiento de cotizacion',
        goal: 'Aclarar dudas y avanzar a solicitud.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.recruiting_hr.v1',
    description:
      'Base conceptual para reclutamiento, staffing, bolsas de trabajo y RRHH.',
    vertical: 'recruiting_hr',
    positioning: {
      primaryPromise: 'Conectar candidatos o empresas con el siguiente paso correcto.',
      audience: 'Candidatos, reclutadores o empresas que buscan talento.',
      offerType: 'Postulacion, entrevista, vacante o perfil de talento.',
      salesMotion: 'Calificacion, entrevista y avance de proceso.',
    },
    defaultPipelineName: 'Pipeline Reclutamiento',
    funnels: [
      {
        funnelKey: 'funnel.recruiting_hr.application_interview.v1',
        label: 'Postula o agenda entrevista',
        goal: 'Capturar candidatos o empresas y avanzar hacia entrevista.',
        suggestedCta: 'Quiero postular',
        recommendedPath: 'recruiting-hr/application-interview',
      },
    ],
    assistantRole:
      'Coordinador de seleccion que confirma perfil, experiencia y disponibilidad.',
    qualificationQuestions: [
      'Que puesto o tipo de talento estas buscando?',
      'Cual es tu experiencia o requisito principal?',
      'Cuando tienes disponibilidad para entrevista?',
    ],
    recommendedEvents: [
      'lead_captured',
      'application_submitted',
      'candidate_qualified',
      'interview_scheduled',
    ],
    metrics: {
      primaryKpi: 'Entrevistas agendadas',
      secondaryKpis: ['Candidatos calificados', 'Ofertas enviadas', 'Contrataciones'],
    },
    playbooks: [
      {
        key: 'hr_candidate_screening',
        label: 'Filtro de candidato',
        goal: 'Confirmar experiencia, expectativa y disponibilidad.',
      },
      {
        key: 'hr_interview_coordination',
        label: 'Coordinacion de entrevista',
        goal: 'Asegurar asistencia y siguiente paso del proceso.',
      },
    ],
  }),
  createBusinessBlueprint({
    blueprintKey: 'blueprint.other.v1',
    description:
      'Fallback conceptual para negocios que aun no encajan en una vertical oficial.',
    vertical: 'other',
    positioning: {
      primaryPromise: 'Abrir una conversacion comercial clara y ordenada.',
      audience: 'Prospectos con interes general o categoria aun no clasificada.',
      offerType: 'Informacion, diagnostico o siguiente paso comercial.',
      salesMotion: 'Captura, calificacion basica y seguimiento.',
    },
    defaultPipelineName: 'Pipeline General',
    funnels: [
      {
        funnelKey: 'funnel.other.general_inquiry.v1',
        label: 'Solicita mas informacion',
        goal: 'Capturar interesados y abrir una conversacion comercial.',
        suggestedCta: 'Quiero mas informacion',
        recommendedPath: 'other/general-inquiry',
      },
    ],
    assistantRole:
      'Asistente comercial general que entiende necesidad y deriva a un siguiente paso.',
    qualificationQuestions: [
      'Que te gustaria lograr?',
      'Que tipo de solucion estas buscando?',
      'Cuando te gustaria recibir seguimiento?',
    ],
    recommendedEvents: [
      'lead_captured',
      'general_inquiry_received',
      'follow_up_due',
      'customer_created',
    ],
    metrics: {
      primaryKpi: 'Conversaciones calificadas',
      secondaryKpis: ['Seguimientos pendientes', 'Contactos convertidos', 'Clientes'],
    },
    playbooks: [
      {
        key: 'general_first_contact',
        label: 'Primer contacto general',
        goal: 'Entender necesidad y proponer siguiente accion.',
      },
      {
        key: 'general_follow_up',
        label: 'Seguimiento general',
        goal: 'Retomar conversacion y avanzar a decision.',
      },
    ],
  }),
] as const satisfies readonly BusinessBlueprint[];

export const businessBlueprintsByVertical =
  businessBlueprints.reduce((blueprintsByVertical, blueprint) => {
    blueprintsByVertical[blueprint.vertical] = blueprint;
    return blueprintsByVertical;
  }, {} as Record<CommercialVerticalKey, BusinessBlueprint>);

const businessBlueprintsByKey = new Map<string, BusinessBlueprint>(
  businessBlueprints.map((blueprint) => [blueprint.blueprintKey, blueprint]),
);

const individualNicheKeys = new Set<IndividualNicheKey>(
  individualNiches.map((niche) => niche.key),
);

const commercialVerticalKeys = new Set<CommercialVerticalKey>(
  commercialVerticals.map((vertical) => vertical.key),
);

const commercialIndustryKeys = new Set<CommercialIndustryKey>(
  Object.values(industriesByVertical)
    .flat()
    .map((industry) => industry.key),
);

const businessModelKeys = new Set<BusinessModelKey>(
  businessModels.map((businessModel) => businessModel.key),
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

const verticalAliases = new Map<string, CommercialVerticalKey>([
  ['multinivel', 'mlm'],
  ['redes', 'mlm'],
  ['network_marketing', 'mlm'],
  ['consultoria', 'consulting_services'],
  ['servicios_profesionales', 'consulting_services'],
  ['cursos', 'education'],
  ['academias', 'education'],
  ['educacion', 'education'],
  ['inmobiliaria', 'real_estate'],
  ['salud', 'health_wellness'],
  ['bienestar', 'health_wellness'],
  ['belleza', 'beauty_aesthetics'],
  ['estetica', 'beauty_aesthetics'],
  ['negocio_local', 'local_business'],
  ['tienda_online', 'ecommerce'],
  ['seguros', 'insurance_finance'],
  ['finanzas', 'insurance_finance'],
  ['reclutamiento', 'recruiting_hr'],
  ['rrhh', 'recruiting_hr'],
  ['otro', 'other'],
]);

const businessModelAliases = new Map<string, BusinessModelKey>([
  ['distribuidor', 'distributor'],
  ['consultor', 'consultant'],
  ['asesor', 'advisor'],
  ['proveedor_servicio', 'service_provider'],
  ['proveedor_de_servicio', 'service_provider'],
  ['vendedor_cursos', 'course_seller'],
  ['vendedor_de_cursos', 'course_seller'],
  ['servicio_local', 'local_service'],
  ['vendedor_ecommerce', 'ecommerce_seller'],
  ['reclutador', 'recruiter'],
  ['corredor', 'broker'],
  ['otro', 'other'],
]);

const legacyNicheTaxonomyDefaults = {
  nutrition_wellness: {
    vertical: 'health_wellness',
    industry: 'nutrition',
    businessModel: 'advisor',
  },
  beauty: {
    vertical: 'beauty_aesthetics',
    industry: 'salon',
    businessModel: 'service_provider',
  },
  courses_academies: {
    vertical: 'education',
    industry: 'online_courses',
    businessModel: 'course_seller',
  },
  coaching_consulting: {
    vertical: 'consulting_services',
    industry: 'coaching',
    businessModel: 'consultant',
  },
  real_estate: {
    vertical: 'real_estate',
    industry: 'residential',
    businessModel: 'broker',
  },
  local_business: {
    vertical: 'local_business',
    industry: 'other_local',
    businessModel: 'local_service',
  },
  other: {
    vertical: 'other',
    industry: 'other',
    businessModel: 'other',
  },
} as const satisfies Record<IndividualNicheKey, CommercialTaxonomy>;

const legacyNicheMlmTaxonomyOverrides: Partial<
  Record<IndividualNicheKey, CommercialTaxonomy>
> = {
  nutrition_wellness: {
    vertical: 'mlm',
    industry: 'nutrition_mlm',
    businessModel: 'distributor',
  },
  beauty: {
    vertical: 'mlm',
    industry: 'beauty_mlm',
    businessModel: 'distributor',
  },
};

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

export const isCommercialVerticalKey = (
  value: string | null | undefined,
): value is CommercialVerticalKey =>
  typeof value === 'string' &&
  commercialVerticalKeys.has(value as CommercialVerticalKey);

export const normalizeCommercialVerticalKey = (
  value: string | null | undefined,
): CommercialVerticalKey => {
  if (!value) {
    return 'other';
  }

  if (isCommercialVerticalKey(value)) {
    return value;
  }

  return verticalAliases.get(normalizeLookupValue(value)) ?? 'other';
};

export const isBusinessModelKey = (
  value: string | null | undefined,
): value is BusinessModelKey =>
  typeof value === 'string' &&
  businessModelKeys.has(value as BusinessModelKey);

export const isCommercialIndustryKey = (
  value: string | null | undefined,
): value is CommercialIndustryKey =>
  typeof value === 'string' &&
  commercialIndustryKeys.has(value as CommercialIndustryKey);

export const normalizeBusinessModelKey = (
  value: string | null | undefined,
): BusinessModelKey => {
  if (!value) {
    return 'other';
  }

  if (isBusinessModelKey(value)) {
    return value;
  }

  return businessModelAliases.get(normalizeLookupValue(value)) ?? 'other';
};

export const getIndustriesForVertical = (
  vertical: string | null | undefined,
): readonly CommercialIndustryOption[] =>
  industriesByVertical[
    normalizeCommercialVerticalKey(vertical)
  ] as readonly CommercialIndustryOption[];

export const getCommercialVerticalPreset = (
  vertical: string | null | undefined,
): CommercialVerticalPreset =>
  commercialVerticalPresets[normalizeCommercialVerticalKey(vertical)];

export const getBusinessBlueprintByKey = (
  blueprintKey: string | null | undefined,
): BusinessBlueprint | undefined => {
  if (!blueprintKey) {
    return undefined;
  }

  return businessBlueprintsByKey.get(blueprintKey);
};

const blueprintMatchesVertical = (
  blueprint: BusinessBlueprint,
  vertical: CommercialVerticalKey,
) => blueprint.vertical === vertical;

const blueprintMatchesIndustry = (
  blueprint: BusinessBlueprint,
  industry: CommercialIndustryKey,
) => blueprint.industries?.includes(industry) ?? false;

const blueprintMatchesBusinessModel = (
  blueprint: BusinessBlueprint,
  businessModel: CommercialBusinessModelKey,
) => blueprint.businessModels?.includes(businessModel) ?? false;

export const resolveBusinessBlueprintForProfile = (
  profile: BusinessBlueprintResolvableProfile | null | undefined,
): BusinessBlueprint => {
  const vertical = isCommercialVerticalKey(profile?.vertical)
    ? profile.vertical
    : undefined;
  const industry = isCommercialIndustryKey(profile?.industry)
    ? profile.industry
    : undefined;
  const businessModel = isBusinessModelKey(profile?.businessModel)
    ? profile.businessModel
    : undefined;

  if (vertical && industry && businessModel) {
    const industryAndBusinessModelBlueprint = businessBlueprints.find(
      (blueprint) =>
        blueprintMatchesVertical(blueprint, vertical) &&
        blueprintMatchesIndustry(blueprint, industry) &&
        blueprintMatchesBusinessModel(blueprint, businessModel),
    );

    if (industryAndBusinessModelBlueprint) {
      return industryAndBusinessModelBlueprint;
    }
  }

  if (vertical && industry) {
    const industryBlueprint = businessBlueprints.find(
      (blueprint) =>
        blueprintMatchesVertical(blueprint, vertical) &&
        blueprintMatchesIndustry(blueprint, industry),
    );

    if (industryBlueprint) {
      return industryBlueprint;
    }
  }

  if (vertical) {
    return businessBlueprintsByVertical[vertical];
  }

  return businessBlueprintsByVertical.other;
};

export const legacyNicheToCommercialTaxonomy = (
  niche: string | null | undefined,
  options?: {
    preferMlm?: boolean;
  },
): CommercialTaxonomy => {
  const legacyNiche = normalizeIndividualNicheKey(niche);

  if (options?.preferMlm && legacyNicheMlmTaxonomyOverrides[legacyNiche]) {
    return legacyNicheMlmTaxonomyOverrides[legacyNiche];
  }

  return legacyNicheTaxonomyDefaults[legacyNiche];
};

export const getIndividualCommercialPreset = (
  niche: string | null | undefined,
): IndividualCommercialPreset => {
  const taxonomy = legacyNicheToCommercialTaxonomy(niche);

  return commercialVerticalPresets[taxonomy.vertical];
};

export const buildIndividualCommercialProfile = (
  niche: string | null | undefined,
): IndividualCommercialProfile => {
  const legacyNiche = normalizeIndividualNicheKey(niche);
  const taxonomy = legacyNicheToCommercialTaxonomy(legacyNiche);
  const blueprint = resolveBusinessBlueprintForProfile(taxonomy);

  return {
    ...taxonomy,
    legacyNiche,
    presetVersion: INDIVIDUAL_COMMERCIAL_PRESET_VERSION,
    blueprintKey: blueprint.blueprintKey,
    blueprintVersion: blueprint.version,
  };
};

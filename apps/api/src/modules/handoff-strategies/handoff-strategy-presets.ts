import type {
  HandoffStrategyType,
  JsonValue,
} from '../shared/domain.types';

export const RETO_TRANSFORMACION_STANDARD = 'RETO_TRANSFORMACION_STANDARD';

export type HandoffStrategyPreset = {
  key: typeof RETO_TRANSFORMACION_STANDARD;
  name: string;
  type: HandoffStrategyType;
  settingsJson: JsonValue;
};

export const handoffStrategyPresets: HandoffStrategyPreset[] = [
  {
    key: RETO_TRANSFORMACION_STANDARD,
    name: 'Reto Transformacion Standard',
    type: 'deferred_queue',
    settingsJson: {
      presetKey: RETO_TRANSFORMACION_STANDARD,
      mode: 'thank_you_then_whatsapp',
      channel: 'whatsapp',
      buttonLabel: 'Continuar por WhatsApp',
      autoRedirect: false,
      captureFields: [
        {
          name: 'fullName',
          label: 'Nombre completo',
          type: 'text',
          required: true,
          autocomplete: 'name',
        },
        {
          name: 'phone',
          label: 'WhatsApp',
          type: 'tel',
          required: true,
          autocomplete: 'tel',
        },
        {
          name: 'email',
          label: 'Correo',
          type: 'email',
          required: true,
          autocomplete: 'email',
        },
      ],
      messageTemplate:
        'Hola {{sponsorName}}, soy {{leadName}}. Complete el reto de transformacion y quiero continuar. Mi WhatsApp es {{leadPhone}} y mi correo es {{leadEmail}}.',
    },
  },
];

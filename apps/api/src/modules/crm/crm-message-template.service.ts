import { Injectable } from '@nestjs/common';

export type CrmMessageTemplateTone = 'warm_professional';

export interface CrmInitialContactTemplatePayload {
  template_key: string;
  variables: Record<string, string | null>;
  tone: CrmMessageTemplateTone;
  locale: string;
}

export interface CrmRenderedInitialContactTemplate {
  template_key: string;
  variables: Record<string, string>;
  rendered_preview: string;
  variant_index: number;
}

const INITIAL_CONTACT_TEMPLATE_KEY = 'crm.initial_contact.safe_mlm.v1';

const initialContactVariants = [
  'Hola {{first_name}}, vi tu registro y queria confirmar si todavia te interesa recibir informacion. Soy {{advisor_name}}.',
  '{{first_name}}, gracias por dejar tus datos en el formulario. Te escribe {{advisor_name}} para ayudarte con el siguiente paso.',
  'Buenas, {{first_name}}. Soy {{advisor_name}}. Recibi tu registro y queria saber si puedo orientarte con la informacion que pediste.',
  '{{first_name}}, vi que completaste el formulario hace poco. Soy {{advisor_name}} y puedo darte contexto si aun te sirve.',
  'Hola {{first_name}}, soy {{advisor_name}}. Paso por aqui porque nos llego tu registro y queria validar que recibiste bien la informacion.',
  '{{first_name}}, que gusto saludarte. Soy {{advisor_name}}; vi tu formulario y queria confirmar si este sigue siendo un buen momento para conversar.',
  'Hola, {{first_name}}. Te escribe {{advisor_name}}. Tengo tu registro a mano y puedo ayudarte a revisar lo que solicitaste.',
  '{{first_name}}, soy {{advisor_name}}. Gracias por registrarte; queria presentarme y ver si puedo aclararte alguna duda inicial.',
  'Buenas {{first_name}}, aqui {{advisor_name}}. Me aparecio tu registro y queria asegurarme de darte seguimiento de forma directa.',
  'Hola {{first_name}}. Soy {{advisor_name}} y vi tu solicitud. Si aun estas revisando la informacion, puedo acompanar el proceso.',
  '{{first_name}}, te saluda {{advisor_name}}. Recibimos tu formulario y queria confirmar contigo algunos datos antes de avanzar.',
  'Hola, {{first_name}}. Soy {{advisor_name}}. Te contacto por el registro que dejaste para ver si todavia quieres que te comparta el contexto.',
];

@Injectable()
export class CrmMessageTemplateService {
  buildInitialContactTemplate(input: {
    leadId: string;
    sponsorId: string;
    locale?: string | null;
  }): CrmInitialContactTemplatePayload {
    return {
      template_key: INITIAL_CONTACT_TEMPLATE_KEY,
      variables: {
        lead_id: input.leadId,
        sponsor_id: input.sponsorId,
      },
      tone: 'warm_professional',
      locale: input.locale ?? 'es-BO',
    };
  }

  renderInitialContactTemplate(input: {
    firstName?: string | null;
    advisorName?: string | null;
    locale?: string | null;
    random?: () => number;
  }): CrmRenderedInitialContactTemplate {
    const random = input.random ?? Math.random;
    const variantIndex = Math.min(
      initialContactVariants.length - 1,
      Math.floor(random() * initialContactVariants.length),
    );
    const variables = {
      first_name: sanitizeTemplateVariable(input.firstName) ?? 'gracias',
      advisor_name: sanitizeTemplateVariable(input.advisorName) ?? 'tu asesor',
    };
    const renderedPreview = interpolateTemplate(
      initialContactVariants[variantIndex],
      variables,
    ).trim();

    return {
      template_key: INITIAL_CONTACT_TEMPLATE_KEY,
      variables,
      rendered_preview: renderedPreview,
      variant_index: variantIndex,
    };
  }
}

const sanitizeTemplateVariable = (value: string | null | undefined) => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

const interpolateTemplate = (
  template: string,
  variables: Record<string, string>,
) =>
  template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    return variables[key] ?? '';
  });

import { CrmMessageTemplateService } from './crm-message-template.service';

describe('CrmMessageTemplateService', () => {
  const service = new CrmMessageTemplateService();

  it('selects different initial contact variants from random input', () => {
    const first = service.renderInitialContactTemplate({
      firstName: 'Ana',
      advisorName: 'Javier',
      random: () => 0,
    });
    const second = service.renderInitialContactTemplate({
      firstName: 'Ana',
      advisorName: 'Javier',
      random: () => 0.99,
    });

    expect(first.rendered_preview).not.toBe(second.rendered_preview);
    expect(first.variant_index).not.toBe(second.variant_index);
  });

  it('interpolates lead and advisor names', () => {
    const result = service.renderInitialContactTemplate({
      firstName: 'Maria',
      advisorName: 'Luis',
      random: () => 0,
    });

    expect(result.variables).toEqual({
      first_name: 'Maria',
      advisor_name: 'Luis',
    });
    expect(result.rendered_preview).toContain('Maria');
    expect(result.rendered_preview).toContain('Luis');
    expect(result.rendered_preview).not.toContain('{{');
  });

  it('never returns an empty preview', () => {
    const result = service.renderInitialContactTemplate({
      firstName: '',
      advisorName: '',
      random: () => 0.5,
    });

    expect(result.rendered_preview.trim()).not.toHaveLength(0);
  });
});

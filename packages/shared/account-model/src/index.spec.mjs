import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDIVIDUAL_COMMERCIAL_PRESET_VERSION,
  buildIndividualCommercialProfile,
  businessBlueprints,
  businessBlueprintsByVertical,
  businessModels,
  commercialVerticalPresets,
  commercialVerticals,
  funnelArsenalTemplates,
  getBusinessBlueprintByKey,
  getFunnelArsenalTemplateByKey,
  getFunnelArsenalTemplatesForBlueprint,
  industriesByVertical,
  legacyNicheToCommercialTaxonomy,
  resolveBusinessBlueprintForProfile,
} from '../dist/index.js';

const officialVerticals = [
  'mlm',
  'consulting_services',
  'education',
  'real_estate',
  'health_wellness',
  'beauty_aesthetics',
  'local_business',
  'ecommerce',
  'insurance_finance',
  'recruiting_hr',
  'other',
];

test('official commercial verticals exist', () => {
  assert.deepEqual(
    commercialVerticals.map((vertical) => vertical.key),
    officialVerticals,
  );
});

test('industries exist for every vertical', () => {
  for (const vertical of officialVerticals) {
    assert.ok(industriesByVertical[vertical]);
    assert.ok(industriesByVertical[vertical].length > 0);
  }

  assert.deepEqual(
    industriesByVertical.mlm.map((industry) => industry.key),
    [
      'nutrition_mlm',
      'beauty_mlm',
      'wellness_mlm',
      'finance_mlm',
      'other_mlm',
    ],
  );
});

test('business models exist', () => {
  assert.deepEqual(
    businessModels.map((businessModel) => businessModel.key),
    [
      'distributor',
      'consultant',
      'advisor',
      'service_provider',
      'course_seller',
      'local_service',
      'ecommerce_seller',
      'recruiter',
      'broker',
      'other',
    ],
  );
});

test('a structural preset exists for every vertical', () => {
  for (const vertical of officialVerticals) {
    assert.equal(commercialVerticalPresets[vertical].vertical, vertical);
    assert.ok(commercialVerticalPresets[vertical].defaultFunnelName);
    assert.ok(commercialVerticalPresets[vertical].futureN8nWorkflowKey);
    assert.ok(commercialVerticalPresets[vertical].futureAiPromptKey);
  }
});

test('business blueprints exist for every vertical', () => {
  assert.deepEqual(
    businessBlueprints.map((blueprint) => blueprint.vertical),
    officialVerticals,
  );

  for (const vertical of officialVerticals) {
    assert.equal(businessBlueprintsByVertical[vertical].vertical, vertical);
  }
});

test('each business blueprint has required v1 concept fields', () => {
  for (const blueprint of businessBlueprints) {
    assert.ok(blueprint.blueprintKey.startsWith('blueprint.'));
    assert.equal(blueprint.version, 'v1');
    assert.ok(blueprint.crm.defaultPipelineName);
    assert.ok(blueprint.crm.stages.length >= 2);
    assert.ok(blueprint.funnelLibrary.recommendedFirstFunnelKey);
    assert.ok(blueprint.funnelLibrary.funnels.length >= 1);
    assert.equal(
      blueprint.funnelLibrary.recommendedFirstFunnelKey,
      blueprint.funnelLibrary.funnels[0].funnelKey,
    );
    assert.ok(blueprint.ai.promptKey);
    assert.ok(blueprint.automation.n8nWorkflowKey);
    assert.ok(blueprint.playbooks.length >= 1);
    assert.ok(blueprint.metrics.primaryKpi);
  }
});

test('business blueprints can be found by key', () => {
  assert.equal(
    getBusinessBlueprintByKey('blueprint.mlm.v1')?.vertical,
    'mlm',
  );
  assert.equal(getBusinessBlueprintByKey('unknown'), undefined);
});

test('funnel arsenal has one basic template per official blueprint', () => {
  assert.equal(funnelArsenalTemplates.length, officialVerticals.length);

  for (const vertical of officialVerticals) {
    const blueprintKey = `blueprint.${vertical}.v1`;
    const templates = getFunnelArsenalTemplatesForBlueprint(blueprintKey);

    assert.equal(templates.length, 1);
    assert.equal(templates[0].blueprintKey, blueprintKey);
    assert.equal(templates[0].difficulty, 'basic');
    assert.ok(templates[0].templateKey);
    assert.ok(templates[0].label);
    assert.ok(templates[0].description);
    assert.ok(templates[0].goal);
    assert.ok(templates[0].recommendedFor);
    assert.ok(templates[0].cta);
    assert.ok(templates[0].pathSuggestion.startsWith('/'));
  }
});

test('funnel arsenal lookup resolves known templates and falls back to other', () => {
  assert.equal(
    getFunnelArsenalTemplateByKey('mlm-opportunity-presentation')?.label,
    'Presentación de oportunidad',
  );
  assert.equal(getFunnelArsenalTemplateByKey('missing'), undefined);
  assert.equal(
    getFunnelArsenalTemplatesForBlueprint('unknown')[0].blueprintKey,
    'blueprint.other.v1',
  );
});

test('business blueprint resolver uses vertical and fallback', () => {
  assert.equal(
    resolveBusinessBlueprintForProfile({
      vertical: 'mlm',
      industry: 'nutrition_mlm',
      businessModel: 'distributor',
    }).blueprintKey,
    'blueprint.mlm.v1',
  );
  assert.equal(
    resolveBusinessBlueprintForProfile({
      industry: 'nutrition_mlm',
      businessModel: 'distributor',
    }).blueprintKey,
    'blueprint.other.v1',
  );
  assert.equal(
    resolveBusinessBlueprintForProfile(null).blueprintKey,
    'blueprint.other.v1',
  );
});

test('legacy niche adapter maps safe defaults', () => {
  assert.deepEqual(legacyNicheToCommercialTaxonomy('nutrition_wellness'), {
    vertical: 'health_wellness',
    industry: 'nutrition',
    businessModel: 'advisor',
  });
  assert.deepEqual(legacyNicheToCommercialTaxonomy('beauty'), {
    vertical: 'beauty_aesthetics',
    industry: 'salon',
    businessModel: 'service_provider',
  });
  assert.deepEqual(legacyNicheToCommercialTaxonomy('nutrition_wellness', {
    preferMlm: true,
  }), {
    vertical: 'mlm',
    industry: 'nutrition_mlm',
    businessModel: 'distributor',
  });
});

test('legacy niche adapter falls back to other', () => {
  assert.deepEqual(legacyNicheToCommercialTaxonomy('unknown value'), {
    vertical: 'other',
    industry: 'other',
    businessModel: 'other',
  });
});

test('commercialProfile v2 is built from legacy niche', () => {
  assert.equal(INDIVIDUAL_COMMERCIAL_PRESET_VERSION, 'v2');
  assert.deepEqual(buildIndividualCommercialProfile('real_estate'), {
    vertical: 'real_estate',
    industry: 'residential',
    businessModel: 'broker',
    legacyNiche: 'real_estate',
    presetVersion: 'v2',
    blueprintKey: 'blueprint.real_estate.v1',
    blueprintVersion: 'v1',
  });
});

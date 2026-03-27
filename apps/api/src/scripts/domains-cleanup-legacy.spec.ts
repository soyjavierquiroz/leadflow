import { parseCliOptions } from './domains-cleanup-legacy';

describe('domains-cleanup-legacy CLI parser', () => {
  it('defaults to dry run when only teamId is provided', () => {
    expect(parseCliOptions(['team-1'])).toEqual({
      execute: false,
      teamId: 'team-1',
    });
  });

  it('enables execute mode when the flag is present', () => {
    expect(parseCliOptions(['team-1', '--execute'])).toEqual({
      execute: true,
      teamId: 'team-1',
    });
  });

  it('rejects unknown options', () => {
    expect(() => parseCliOptions(['team-1', '--wat'])).toThrow(
      'Unknown option: --wat',
    );
  });

  it('rejects extra positional arguments', () => {
    expect(() => parseCliOptions(['team-1', 'team-2'])).toThrow(
      'Unexpected extra argument: team-2.',
    );
  });
});

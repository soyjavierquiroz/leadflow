import { CrmOwnershipPolicyService } from './crm-ownership-policy.service';

describe('CrmOwnershipPolicyService', () => {
  it('resolves MLM ownership precedence from conversation to attribution', () => {
    const service = new CrmOwnershipPolicyService();

    expect(
      service.resolveOwner({
        conversationOwnerSponsorId: 'sponsor-conversation',
        acceptedBySponsorId: 'sponsor-accepted',
        assignedSponsorId: 'sponsor-assigned',
        attributedSponsorId: 'sponsor-attributed',
      }),
    ).toEqual({
      sponsorId: 'sponsor-conversation',
      source: 'conversation_owner',
    });

    expect(
      service.resolveOwner({
        acceptedBySponsorId: 'sponsor-accepted',
        assignedSponsorId: 'sponsor-assigned',
        attributedSponsorId: 'sponsor-attributed',
      }),
    ).toEqual({
      sponsorId: 'sponsor-accepted',
      source: 'accepted_assignment',
    });

    expect(
      service.resolveOwner({
        assignedSponsorId: 'sponsor-assigned',
        attributedSponsorId: 'sponsor-attributed',
      }),
    ).toEqual({
      sponsorId: 'sponsor-assigned',
      source: 'assigned_sponsor',
    });

    expect(
      service.resolveOwner({
        attributedSponsorId: 'sponsor-attributed',
      }),
    ).toEqual({
      sponsorId: 'sponsor-attributed',
      source: 'attribution',
    });
  });
});

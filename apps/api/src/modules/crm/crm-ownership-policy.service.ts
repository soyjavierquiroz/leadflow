import { Injectable } from '@nestjs/common';

export type CrmOwnershipCandidate = {
  conversationOwnerSponsorId?: string | null;
  acceptedBySponsorId?: string | null;
  assignedSponsorId?: string | null;
  attributedSponsorId?: string | null;
};

export type CrmResolvedOwnerSource =
  | 'conversation_owner'
  | 'accepted_assignment'
  | 'assigned_sponsor'
  | 'attribution'
  | 'unowned';

export type CrmResolvedOwner = {
  sponsorId: string | null;
  source: CrmResolvedOwnerSource;
};

@Injectable()
export class CrmOwnershipPolicyService {
  resolveOwner(input: CrmOwnershipCandidate): CrmResolvedOwner {
    if (input.conversationOwnerSponsorId) {
      return {
        sponsorId: input.conversationOwnerSponsorId,
        source: 'conversation_owner',
      };
    }

    if (input.acceptedBySponsorId) {
      return {
        sponsorId: input.acceptedBySponsorId,
        source: 'accepted_assignment',
      };
    }

    if (input.assignedSponsorId) {
      return {
        sponsorId: input.assignedSponsorId,
        source: 'assigned_sponsor',
      };
    }

    if (input.attributedSponsorId) {
      return {
        sponsorId: input.attributedSponsorId,
        source: 'attribution',
      };
    }

    return {
      sponsorId: null,
      source: 'unowned',
    };
  }
}

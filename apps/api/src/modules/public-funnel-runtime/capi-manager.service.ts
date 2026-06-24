import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { redactSecrets } from '../shared/redact-sensitive-data';
import type { AttributionDecision } from './public-funnel-runtime.types';

type CapiPublicationContext = {
  id: string;
  teamId: string;
  metaPixelId: string | null;
  metaCapiToken: string | null;
  tiktokPixelId: string | null;
  tiktokAccessToken: string | null;
  domainHost: string;
  pathPrefix: string;
};

type CapiLeadContext = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
};

type DispatchLeadConversionInput = {
  publication: CapiPublicationContext;
  lead: CapiLeadContext;
  attributionDecision: AttributionDecision;
  eventId: string;
  occurredAt?: Date;
};

type MetaUserData = {
  em?: string[];
  ph?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
};

type TikTokUserContext = {
  email?: string;
  phone_number?: string;
  external_id?: string;
};

const leadCaptureConversionEventName = 'CompleteRegistration';

@Injectable()
export class CapiManagerService {
  private readonly logger = new Logger(CapiManagerService.name);
  private readonly metaApiVersion = 'v22.0';
  private readonly tiktokEventsApiUrl =
    'https://business-api.tiktok.com/open_api/v1.3/event/track/';

  async dispatchLeadConversion(input: DispatchLeadConversionInput) {
    if (
      input.attributionDecision.trafficLayer !== 'PAID_WHEEL' &&
      input.attributionDecision.trafficLayer !== 'PAID_ADS'
    ) {
      this.logger.log(
        '[CAPI_SKIP] Lead identificado como orgánico. Omisión de reporte para evitar polución de píxel.',
      );
      return;
    }

    if (!input.attributionDecision.pathMatchesCampaign) {
      this.logger.log(
        `[CAPI_SKIP] Lead pago sin path de campaña válido. publicationId=${input.publication.id} leadId=${input.lead.id}`,
      );
      return;
    }

    const occurredAt = input.occurredAt ?? new Date();
    const settledResults = await Promise.allSettled([
      this.dispatchMetaLeadConversion(input, occurredAt),
      this.dispatchTikTokLeadConversion(input, occurredAt),
    ]);

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        return;
      }

      const provider = index === 0 ? 'Meta' : 'TikTok';
      const message =
        result.reason instanceof Error
          ? redactSecrets(result.reason.message)
          : 'unknown error';
      this.logger.error(
        `[CAPI_ERROR] ${provider} dispatch failed. publicationId=${input.publication.id} leadId=${input.lead.id} message=${message}`,
      );
    });
  }

  private async dispatchMetaLeadConversion(
    input: DispatchLeadConversionInput,
    occurredAt: Date,
  ) {
    const pixelId = this.normalizeText(input.publication.metaPixelId);
    const accessToken = this.normalizeText(input.publication.metaCapiToken);
    const fbclid = this.normalizeText(input.attributionDecision.fbclid);

    if (!pixelId || !accessToken) {
      return;
    }

    if (!fbclid) {
      this.logger.log(
        `[CAPI_SKIP] Meta omitido por falta de fbclid. publicationId=${input.publication.id} leadId=${input.lead.id}`,
      );
      return;
    }

    const userData = this.buildMetaUserData(input);
    if (!this.hasMetaUserData(userData)) {
      this.logger.log(
        `[CAPI_SKIP] Meta omitido por falta de user_data enriquecido. publicationId=${input.publication.id} leadId=${input.lead.id}`,
      );
      return;
    }

    const response = await fetch(
      `https://graph.facebook.com/${this.metaApiVersion}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [
            {
              event_name: leadCaptureConversionEventName,
              event_time: Math.floor(occurredAt.getTime() / 1000),
              action_source: 'website',
              event_source_url: this.resolveEventSourceUrl(input),
              event_id: input.eventId,
              user_data: userData,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Meta CAPI responded with ${response.status}.`,
      );
    }

    this.logger.log(
      `[CAPI_SENT] Meta lead conversion enviada. publicationId=${input.publication.id} leadId=${input.lead.id}`,
    );
  }

  private async dispatchTikTokLeadConversion(
    input: DispatchLeadConversionInput,
    occurredAt: Date,
  ) {
    const pixelId = this.normalizeText(input.publication.tiktokPixelId);
    const accessToken = this.normalizeText(input.publication.tiktokAccessToken);
    const ttclid = this.normalizeText(input.attributionDecision.ttclid);

    if (!pixelId || !accessToken) {
      return;
    }

    if (!ttclid) {
      this.logger.log(
        `[CAPI_SKIP] TikTok omitido por falta de ttclid. publicationId=${input.publication.id} leadId=${input.lead.id}`,
      );
      return;
    }

    const user = this.buildTikTokUserContext(input);
    const clientIpAddress = this.normalizeText(
      input.attributionDecision.clientIpAddress,
    );
    const clientUserAgent = this.normalizeText(
      input.attributionDecision.clientUserAgent,
    );

    if (!user || !clientIpAddress || !clientUserAgent) {
      this.logger.log(
        `[CAPI_SKIP] TikTok omitido por falta de identidad o contexto de navegador. publicationId=${input.publication.id} leadId=${input.lead.id}`,
      );
      return;
    }

    const response = await fetch(this.tiktokEventsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: pixelId,
        data: [
          {
            event: leadCaptureConversionEventName,
            event_id: input.eventId,
            timestamp: Math.floor(occurredAt.getTime() / 1000),
            context: {
              ip: clientIpAddress,
              user_agent: clientUserAgent,
              page: {
                url: this.resolveEventSourceUrl(input),
              },
              ad: {
                callback: ttclid,
              },
              user,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `TikTok Events API responded with ${response.status}.`,
      );
    }

    this.logger.log(
      `[CAPI_SENT] TikTok lead conversion enviada. publicationId=${input.publication.id} leadId=${input.lead.id}`,
    );
  }

  private buildMetaUserData(input: DispatchLeadConversionInput): MetaUserData {
    const hashedEmail = this.hashEmail(input.lead.email);
    const hashedPhone = this.hashPhone(input.lead.phone);
    const clientIpAddress = this.normalizeText(
      input.attributionDecision.clientIpAddress,
    );
    const clientUserAgent = this.normalizeText(
      input.attributionDecision.clientUserAgent,
    );

    return {
      ...(hashedEmail ? { em: [hashedEmail] } : {}),
      ...(hashedPhone ? { ph: [hashedPhone] } : {}),
      ...(clientIpAddress ? { client_ip_address: clientIpAddress } : {}),
      ...(clientUserAgent ? { client_user_agent: clientUserAgent } : {}),
      fbc: `fb.1.${Date.now()}.${this.normalizeText(input.attributionDecision.fbclid)}`,
    };
  }

  private buildTikTokUserContext(
    input: DispatchLeadConversionInput,
  ): TikTokUserContext | null {
    const hashedEmail = this.hashEmail(input.lead.email);
    const hashedPhone = this.hashPhone(input.lead.phone);
    const externalId = this.hashValue(input.lead.id);

    if (!hashedEmail && !hashedPhone && !externalId) {
      return null;
    }

    return {
      ...(hashedEmail ? { email: hashedEmail } : {}),
      ...(hashedPhone ? { phone_number: hashedPhone } : {}),
      ...(externalId ? { external_id: externalId } : {}),
    };
  }

  private hasMetaUserData(userData: MetaUserData) {
    return Boolean(
      (userData.em && userData.em.length > 0) ||
        (userData.ph && userData.ph.length > 0) ||
        userData.client_ip_address ||
        userData.client_user_agent,
    );
  }

  private resolveEventSourceUrl(input: DispatchLeadConversionInput) {
    const sourceUrl = this.normalizeText(input.attributionDecision.sourceUrl);
    if (sourceUrl?.startsWith('http://') || sourceUrl?.startsWith('https://')) {
      return sourceUrl;
    }

    return `https://${input.publication.domainHost}${input.attributionDecision.requestedPath}`;
  }

  private hashEmail(value: string | null | undefined) {
    const normalized = this.normalizeText(value)?.toLowerCase();
    return normalized ? this.hashValue(normalized) : null;
  }

  private hashPhone(value: string | null | undefined) {
    const normalized = this.normalizeText(value)?.replace(/\D+/g, '');
    return normalized ? this.hashValue(normalized) : null;
  }

  private hashValue(value: string | null | undefined) {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }

    return createHash('sha256').update(normalized).digest('hex');
  }

  private normalizeText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}

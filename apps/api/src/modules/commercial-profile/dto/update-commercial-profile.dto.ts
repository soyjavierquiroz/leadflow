export type CommercialProfileSalesMotion =
  | 'whatsapp'
  | 'whatsapp_calls'
  | 'in_person'
  | 'mixed';

export class UpdateCommercialProfileDto {
  readonly businessName?: string;
  readonly mainProduct?: string | null;
  readonly averagePrice?: string | null;
  readonly salesMotion?: CommercialProfileSalesMotion | string | null;
  readonly country?: string | null;
  readonly phone?: string | null;
  readonly niche?: string | null;
  readonly vertical?: string | null;
  readonly industry?: string | null;
  readonly businessModel?: string | null;
}

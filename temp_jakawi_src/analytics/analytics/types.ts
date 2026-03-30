export type MetaStandardEventName =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "AddToWishlist"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Lead"
  | "CompleteRegistration"
  | "Contact"
  | "CustomizeProduct"
  | "Donate"
  | "FindLocation"
  | "Schedule"
  | "StartTrial"
  | "SubmitApplication"
  | "Subscribe";

export type MetaEventName = MetaStandardEventName | (string & {});

export type MetaActionSource =
  | "website"
  | "app"
  | "chat"
  | "email"
  | "phone_call"
  | "physical_store"
  | "system_generated"
  | "other";

export type CurrencyCode = Uppercase<string>;
export type MetaContentType = "product" | "product_group";
export type MetaDeliveryCategory = "home_delivery" | "in_store";

export type MetaParameterPrimitive = string | number | boolean;
export type MetaParameterValue =
  | MetaParameterPrimitive
  | readonly MetaParameterPrimitive[];

export type MetaCustomEventParams = Record<string, MetaParameterValue>;

export interface MetaContent {
  id: string;
  quantity?: number;
  item_price?: number;
  delivery_category?: MetaDeliveryCategory;
  brand?: string;
  category?: string;
}

export interface MetaCommerceParams {
  value?: number;
  currency?: CurrencyCode;
  content_type?: MetaContentType;
  content_ids?: readonly string[];
  contents?: readonly MetaContent[];
  content_name?: string;
  content_category?: string;
  num_items?: number;
}

export interface PageViewParams {
  page_title?: string;
  page_path?: string;
  page_location?: string;
  referrer?: string;
}

export interface ViewContentParams extends MetaCommerceParams {
  content_name?: string;
  content_category?: string;
}

export interface SearchParams extends MetaCommerceParams {
  search_string: string;
}

export type AddToCartParams = MetaCommerceParams;

export type AddToWishlistParams = MetaCommerceParams;

export type InitiateCheckoutParams = MetaCommerceParams;

export interface AddPaymentInfoParams extends MetaCommerceParams {
  payment_type?: string;
}

export interface PurchaseParams extends MetaCommerceParams {
  value: number;
  currency: CurrencyCode;
}

export interface LeadParams {
  value?: number;
  currency?: CurrencyCode;
  lead_type?: string;
}

export interface CompleteRegistrationParams {
  value?: number;
  currency?: CurrencyCode;
  status?: string;
}

export interface ContactParams {
  contact_method?: string;
}

export type CustomizeProductParams = MetaCommerceParams;

export interface DonateParams {
  value: number;
  currency: CurrencyCode;
}

export interface FindLocationParams {
  location_id?: string;
  search_string?: string;
}

export interface ScheduleParams {
  value?: number;
  currency?: CurrencyCode;
}

export interface StartTrialParams {
  value?: number;
  currency?: CurrencyCode;
  predicted_ltv?: number;
}

export type SubmitApplicationParams = Record<string, never>;

export interface SubscribeParams {
  value?: number;
  currency?: CurrencyCode;
  predicted_ltv?: number;
}

export interface MetaStandardEventParamsMap {
  PageView: PageViewParams;
  ViewContent: ViewContentParams;
  Search: SearchParams;
  AddToCart: AddToCartParams;
  AddToWishlist: AddToWishlistParams;
  InitiateCheckout: InitiateCheckoutParams;
  AddPaymentInfo: AddPaymentInfoParams;
  Purchase: PurchaseParams;
  Lead: LeadParams;
  CompleteRegistration: CompleteRegistrationParams;
  Contact: ContactParams;
  CustomizeProduct: CustomizeProductParams;
  Donate: DonateParams;
  FindLocation: FindLocationParams;
  Schedule: ScheduleParams;
  StartTrial: StartTrialParams;
  SubmitApplication: SubmitApplicationParams;
  Subscribe: SubscribeParams;
}

export type MetaEventParams<TEventName extends string> =
  TEventName extends MetaStandardEventName
    ? MetaStandardEventParamsMap[TEventName]
    : MetaCustomEventParams;

export type MetaCookieName = "_fbp" | "_fbc";

export interface MetaCookieValues {
  _fbp: string | null;
  _fbc: string | null;
}

export interface MetaURLAttributionParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_id: string | null;
  fbclid: string | null;
}

export interface AttributionData extends MetaURLAttributionParams {
  landing_page: string | null;
  referrer: string | null;
  captured_at: string | null;
}

export type ConsentStatus = "unknown" | "granted" | "denied";

export interface AnalyticsConsentState {
  status: ConsentStatus;
  gdpr_applies: boolean;
  ccpa_opt_out: boolean;
  updated_at: string | null;
}

export type MetaHashedUserField = string | readonly string[];

export interface MetaUserData {
  em?: MetaHashedUserField;
  ph?: MetaHashedUserField;
  fn?: MetaHashedUserField;
  ln?: MetaHashedUserField;
  ge?: MetaHashedUserField;
  db?: MetaHashedUserField;
  ct?: MetaHashedUserField;
  st?: MetaHashedUserField;
  zp?: MetaHashedUserField;
  country?: MetaHashedUserField;
  external_id?: MetaHashedUserField;
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
  fb_login_id?: string;
}

export type MetaBrowserMethod = "track" | "trackCustom";

export interface MetaBrowserPayload<TEventName extends string = MetaEventName> {
  provider: "meta";
  channel: "browser";
  method: TEventName extends MetaStandardEventName ? "track" : "trackCustom";
  event_name: TEventName;
  event_id: string;
  event_time: number;
  event_source_url: string;
  action_source: MetaActionSource;
  params: MetaEventParams<TEventName>;
}

export interface MetaServerPayload<TEventName extends string = MetaEventName> {
  provider: "meta";
  channel: "server";
  event_name: TEventName;
  event_id: string;
  event_time: number;
  event_source_url: string;
  action_source: MetaActionSource;
  user_data: MetaUserData;
  custom_data: MetaEventParams<TEventName>;
  test_event_code?: string;
}

export interface MetaRelayPayload<TEventName extends string = MetaEventName> {
  provider: "meta";
  event_name: TEventName;
  event_id: string;
  event_time: number;
  browser: MetaBrowserPayload<TEventName>;
  server: MetaServerPayload<TEventName>;
  attribution: AttributionData;
  consent: AnalyticsConsentState;
  anonymous_id: string;
  cookies: MetaCookieValues;
}

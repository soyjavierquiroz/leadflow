export type LeadStatus = 'new' | 'assigned' | 'qualified' | 'closed';

export interface Lead {
  id: string;
  source: string;
  status: LeadStatus;
  createdAt: string;
}

export interface LeadflowPublicUrls {
  site: string;
  members: string;
  admin: string;
  api: string;
}

export interface LeadflowWebPublicEnv {
  appName: string;
  urls: LeadflowPublicUrls;
}

export interface LeadflowApiRuntimeEnv {
  appName: string;
  appVersion: string;
  environment: string;
  host: string;
  port: number;
  globalPrefix: string;
  baseUrl: string;
  corsAllowedOrigins: string[];
}

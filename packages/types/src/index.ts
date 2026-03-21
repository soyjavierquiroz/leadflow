export interface Lead {
  id: string;
  source: string;
  status: 'new' | 'assigned' | 'qualified' | 'closed';
  createdAt: string;
}

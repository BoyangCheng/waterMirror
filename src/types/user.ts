export interface User {
  id: string;
  created_at: Date;
  email: string | null;
  name: string | null;
  phone: string | null;
  organization_id: string | null;
}

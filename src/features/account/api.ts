// src/features/account/api.ts
//
// Profile, addresses, currencies and notifications of the Buyer Frontend API.

import { api, type Page } from "@/shared/api/client";

export interface Address {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  is_default: boolean;
}
export type AddressInput = Omit<Address, "id" | "is_default">;

export interface CurrencyOption {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}

export interface AppNotification {
  id: string;
  channel: string;
  event_type: string;
  priority: string;
  message: string;
  metadata: { order_id?: string } | null;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export interface NotificationPrefs {
  telegram_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  muted_event_types: string[];
  notify_order_updates: boolean;
  notify_payment_updates: boolean;
  notify_job_updates: boolean;
  notify_balance_updates: boolean;
  notify_payout_updates: boolean;
  allow_admin_broadcast: boolean;
  updated_at: string;
}

export const accountApi = {
  addresses: async (): Promise<Address[]> =>
    (await api.get<Page<Address>>("/accounts/addresses/", { params: { page_size: 50 } })).results,
  createAddress: (body: AddressInput) => api.post<Address>("/accounts/addresses/", { body }),
  updateAddress: (id: string, body: Partial<AddressInput>) => api.patch<Address>(`/accounts/addresses/${id}/`, { body }),
  deleteAddress: (id: string) => api.delete<null>(`/accounts/addresses/${id}/`),
  setDefaultAddress: (id: string) => api.post<Address>(`/accounts/addresses/${id}/set_default/`, { body: {} }),

  currencies: () => api.get<CurrencyOption[]>("/currencies/", { auth: false }),

  notifications: (params: { page?: number; page_size?: number; status?: string; channel?: string }) =>
    api.get<Page<AppNotification>>("/notifications/", { params }),
  prefs: () => api.get<NotificationPrefs>("/notifications/preferences/"),
  updatePrefs: (patch: Partial<NotificationPrefs>) => api.patch<NotificationPrefs>("/notifications/preferences/", { body: patch }),
};

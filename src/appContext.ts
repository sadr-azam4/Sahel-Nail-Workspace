import { createContext, useContext } from 'react';

export type Route =
  | 'dashboard'
  | 'clients'
  | 'calendar'
  | 'designer'
  | 'gallery'
  | 'settings'
  | 'services'
  | 'calculator';

export interface NavParams {
  dateKey?: string;
  clientId?: number;
  openNew?: boolean;
}

export interface NavApi {
  route: Route;
  params: NavParams;
  navigate(route: Route, params?: NavParams): void;
  back(): void;
}

export const NavContext = createContext<NavApi>({
  route: 'dashboard',
  params: {},
  navigate: () => undefined,
  back: () => undefined,
});

export function useNav(): NavApi {
  return useContext(NavContext);
}

export const ROUTE_TITLES: Record<Route, string> = {
  dashboard: 'خانه',
  clients: 'مشتری‌ها',
  calendar: 'تقویم نوبت‌ها',
  designer: 'طراحی ناخن',
  gallery: 'گالری طرح‌ها',
  settings: 'تنظیمات',
  services: 'فهرست خدمات',
  calculator: 'ماشین‌حساب قیمت',
};

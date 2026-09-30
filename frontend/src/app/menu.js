import { LayoutGrid, LayoutDashboard, UserCircle2, Building2, Store, FileSignature, Receipt, Wallet, Scale, LifeBuoy, Ticket, MapPin, BarChart3, CalendarClock, CalendarX2, Coins, PiggyBank, UserCog, Route, History, MoreHorizontal, BellRing, Users, Settings, ScrollText, Server, DatabaseBackup } from 'lucide-react';

/**
 * Single source for navigation: sidebar groups, breadcrumbs and the command palette.
 * `roles` = who may open the screen (the owner always may). `money` = hidden from SUPPORT.
 */
export const MENU = [
  { key: 'workspace', icon: LayoutGrid, label: 'Workspace', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/profile', label: 'My profile', icon: UserCircle2 },
  ] },
  { key: 'customers', icon: Building2, label: 'Customers', items: [
    { to: '/customers', label: 'Customers', icon: Store, keywords: 'shop jeweller licence hdd server heartbeat' },
    { to: '/servers', label: 'Servers', icon: Server, keywords: 'link key heartbeat offline erp customer server' },
  ] },
  { key: 'contracts', icon: FileSignature, label: 'Contracts', items: [
    { to: '/contracts', label: 'Contracts', icon: FileSignature, keywords: 'amc renew annual maintenance' },
    { to: '/invoices', label: 'Invoices', icon: Receipt, roles: ['ACCOUNTS'], keywords: 'tax invoice trn vat' },
    { to: '/payments', label: 'Payments', icon: Wallet, roles: ['ACCOUNTS'], keywords: 'receipt cash bank cheque card' },
    { to: '/outstanding', label: 'Outstanding', icon: Scale, roles: ['ACCOUNTS'], keywords: 'balance due statement' },
  ] },
  { key: 'support', icon: LifeBuoy, label: 'Support', items: [
    { to: '/tickets', label: 'Tickets', icon: Ticket, keywords: 'call whatsapp email issue sla kanban' },
    { to: '/visits', label: 'Visits', icon: MapPin, keywords: 'site visit engineer calendar' },
  ] },
  { key: 'reports', icon: BarChart3, label: 'Reports', items: [
    { to: '/reports/expiring-licences', label: 'Expiring licences', icon: CalendarClock },
    { to: '/reports/expiring-amcs', label: 'Expiring AMCs', icon: CalendarX2 },
    { to: '/reports/outstanding', label: 'Outstanding', icon: Coins, roles: ['ACCOUNTS'] },
    { to: '/reports/collections', label: 'Collections', icon: PiggyBank, roles: ['ACCOUNTS'] },
    { to: '/reports/tickets', label: 'Tickets by engineer', icon: UserCog },
    { to: '/reports/visits', label: 'Visits by engineer', icon: Route },
    { to: '/reports/customer-history', label: 'Customer history', icon: History },
  ] },
  { key: 'other', icon: MoreHorizontal, label: 'Other', items: [
    { to: '/reminders', label: 'Reminders', icon: BellRing, roles: [], keywords: 'whatsapp email expiry overdue rules log' },
    { to: '/users', label: 'Users & roles', icon: Users, roles: [] },
    { to: '/settings', label: 'Settings', icon: Settings, roles: [], keywords: 'company trn numbering vat smtp whatsapp servers link keys backup field update' },
    { to: '/audit', label: 'Audit log', icon: ScrollText, roles: [] },
    { to: '/backup', label: 'Data backup', icon: DatabaseBackup, roles: [], keywords: 'backup google drive bak' },
  ] },
];
/** May this role open the screen? No `roles` = everyone; [] = owner only. */
export const allowed = (item, role) => role === 'OWNER' || !item.roles || item.roles.includes(role);
export function findMenu(pathname) {
  for (const g of MENU) for (const it of g.items) if (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + '/')) return { group: g, item: it };
  return null;
}

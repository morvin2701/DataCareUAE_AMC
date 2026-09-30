import { LayoutGrid, LayoutDashboard, Bell, UserCircle2, Building2, Store, Server, FileSignature, Receipt, Wallet, Scale, PiggyBank, LifeBuoy, Ticket, MapPin, BarChart3, CalendarClock, CalendarX2, Coins, UserCog, Route, History, MoreHorizontal, BellRing, Users, Settings, ScrollText, DatabaseBackup, Target } from 'lucide-react';

/**
 * Single source for navigation: sidebar groups, breadcrumbs and the command palette.
 * `roles` = who may open the screen (the owner always may); none = everyone; [] = owner only.
 */
export const MENU = [
  { key: 'home', icon: LayoutGrid, label: 'Home', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/notifications', label: 'Notifications', icon: Bell, keywords: 'alerts follow up demo reminder staff' },
    { to: '/profile', label: 'My profile', icon: UserCircle2 },
  ] },
  { key: 'party', icon: Building2, label: 'Party', items: [
    { to: '/customers', label: 'Party master', icon: Store, keywords: 'customer shop jeweller add new install hdd code licence' },
    { to: '/leads', label: 'Leads & follow-up', icon: Target, keywords: 'crm lead prospect demo follow up call proposal won lost' },
    { to: '/servers', label: 'ERP servers', icon: Server, roles: [], keywords: 'link key heartbeat offline erp customer server' },
  ] },
  { key: 'amc', icon: FileSignature, label: 'AMC', items: [
    { to: '/contracts', label: 'AMC issue', icon: FileSignature, keywords: 'contract renew annual maintenance issue' },
    { to: '/payments', label: 'AMC received', icon: Wallet, roles: ['ACCOUNTS'], keywords: 'receipt cash bank cheque card received payment' },
    { to: '/invoices', label: 'Invoices', icon: Receipt, roles: ['ACCOUNTS'], keywords: 'tax invoice trn vat bill' },
    { to: '/outstanding', label: 'Outstanding', icon: Scale, roles: ['ACCOUNTS'], keywords: 'balance due statement' },
    { to: '/reports/collections', label: 'Collection', icon: PiggyBank, roles: ['ACCOUNTS'], keywords: 'payment collection period mode' },
  ] },
  { key: 'support', icon: LifeBuoy, label: 'Support', items: [
    { to: '/tickets', label: 'Tickets', icon: Ticket, keywords: 'call whatsapp email issue sla kanban' },
    { to: '/visits', label: 'Visits', icon: MapPin, keywords: 'site visit engineer calendar' },
  ] },
  { key: 'reports', icon: BarChart3, label: 'Reports', items: [
    { to: '/reports/expiring-licences', label: 'Expiring licences', icon: CalendarClock },
    { to: '/reports/expiring-amcs', label: 'Expiring AMCs', icon: CalendarX2 },
    { to: '/reports/outstanding', label: 'Outstanding report', icon: Coins, roles: ['ACCOUNTS'] },
    { to: '/reports/tickets', label: 'Tickets by engineer', icon: UserCog },
    { to: '/reports/visits', label: 'Visits by engineer', icon: Route },
    { to: '/reports/customer-history', label: 'Customer history', icon: History },
  ] },
  { key: 'other', icon: MoreHorizontal, label: 'Other', items: [
    { to: '/reminders', label: 'Reminders', icon: BellRing, roles: [], keywords: 'whatsapp email expiry overdue rules log' },
    { to: '/users', label: 'Users & roles', icon: Users, roles: [] },
    { to: '/settings', label: 'Settings', icon: Settings, roles: [], keywords: 'company trn numbering vat prices smtp whatsapp servers link keys backup field update' },
    { to: '/audit', label: 'Audit log', icon: ScrollText, roles: [] },
    { to: '/backup', label: 'Data backup', icon: DatabaseBackup, roles: [], keywords: 'backup google drive bak' },
  ] },
];
export const allowed = (item, role) => role === 'OWNER' || !item.roles || item.roles.includes(role);
export function findMenu(pathname) {
  for (const g of MENU) for (const it of g.items) if (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + '/')) return { group: g, item: it };
  return null;
}

// -------------------------------------------------------
// Admin sidebar tab configuration — flat list.
// Tabs with `children` render as accordion dropdowns.
//
// REMOVED from this list (per product decision):
//   - Reports          (/admin/reports)
//   - Analytics        (/admin/analytics)
//   - Roles & Perms    (/admin/roles)
//   - Documents        (/admin/documents)
//   - Certificates     (/admin/certificates) — standalone removed,
//                       Certifications under Master Management stays
//
// Dashboard is NOT in this list — it is always rendered by
// the sidebar regardless of permissions (common to all admins).
// -------------------------------------------------------

import DashboardIcon         from '@mui/icons-material/Dashboard';
import VideoCallIcon          from '@mui/icons-material/VideoCall';
import AppRegistrationIcon    from '@mui/icons-material/AppRegistration';
import PaymentIcon            from '@mui/icons-material/Payment';
import PeopleIcon             from '@mui/icons-material/People';
import VideoLibraryIcon       from '@mui/icons-material/VideoLibrary';
import ManageAccountsIcon     from '@mui/icons-material/ManageAccounts';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CardMembershipIcon     from '@mui/icons-material/CardMembership';
import CategoryIcon           from '@mui/icons-material/Category';
import TypeSpecimenIcon       from '@mui/icons-material/TypeSpecimen';
import AlarmIcon              from '@mui/icons-material/Alarm';
import NotificationsIcon      from '@mui/icons-material/Notifications';
import EmailIcon              from '@mui/icons-material/Email';
import SmsIcon                from '@mui/icons-material/Sms';
import WhatsAppIcon           from '@mui/icons-material/WhatsApp';
import LibraryBooksIcon       from '@mui/icons-material/LibraryBooks';
import CampaignIcon           from '@mui/icons-material/Campaign';
import ManageSearchIcon       from '@mui/icons-material/ManageSearch';

const adminTabs = [
  // ── Always visible — not permission-checked ───────────────────
  { label: 'Dashboard', route: '/admin/dashboard', icon: DashboardIcon, alwaysShow: true },

  // ── Permission-controlled tabs ────────────────────────────────
  { label: 'Webinars',      route: '/admin/webinars',      icon: VideoCallIcon },
  { label: 'Registrations', route: '/admin/registrations', icon: AppRegistrationIcon },
  { label: 'Payments',      route: '/admin/payments',      icon: PaymentIcon },
  { label: 'Participants',  route: '/admin/participants',  icon: PeopleIcon },
  { label: 'Recordings',    route: '/admin/recordings',    icon: VideoLibraryIcon },
  { label: 'Admin Accounts',route: '/admin/accounts',      icon: ManageAccountsIcon },

  // Access Control: Super Admin only
  {
    label: 'Access Control',
    route: '/admin/access',
    icon: AdminPanelSettingsIcon,
    superAdminOnly: true,
  },

  // Activity Logs: Super Admin only
  {
    label: 'Activity Logs',
    route: '/admin/activity-logs',
    icon: ManageSearchIcon,
    superAdminOnly: true,
  },

  // Master Management (parent with children)
  {
    label: 'Master Management',
    route: '/admin/master',       // virtual — no page, toggles dropdown
    icon: LibraryBooksIcon,
    children: [
      { label: 'Certifications',         route: '/admin/certifications', icon: CardMembershipIcon },
      { label: 'Categories',             route: '/admin/categories',     icon: CategoryIcon },
      { label: 'Webinar Types',          route: '/admin/webinar-types',  icon: TypeSpecimenIcon },
      { label: 'Reminder Configuration', route: '/admin/reminders',      icon: AlarmIcon },
    ],
  },

  // Communication (parent with children)
  {
    label: 'Communication',
    route: '/admin/communication', // virtual — no page
    icon: CampaignIcon,
    children: [
      { label: 'Notifications',      route: '/admin/notifications',      icon: NotificationsIcon },
      { label: 'Email Templates',    route: '/admin/email-templates',    icon: EmailIcon },
      { label: 'SMS Templates',      route: '/admin/sms-templates',      icon: SmsIcon },
      { label: 'WhatsApp Templates', route: '/admin/whatsapp-templates', icon: WhatsAppIcon },
    ],
  },
];

export default adminTabs;

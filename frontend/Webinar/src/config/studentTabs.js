// -------------------------------------------------------
// Student sidebar tab configuration
// Each entry maps to a route and an MUI icon name.
// Students (RoleId=3) always see all tabs — no restriction.
// -------------------------------------------------------

import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PaymentIcon from '@mui/icons-material/Payment';
import NotificationsIcon from '@mui/icons-material/Notifications';

const studentTabs = [
  { label: 'Dashboard',           route: '/dashboard',                icon: DashboardIcon },
  { label: 'My Profile',          route: '/dashboard/profile',         icon: PersonIcon },
  { label: 'Upcoming Webinars',   route: '/dashboard/upcoming',        icon: EventIcon },
  { label: 'Registered Webinars', route: '/dashboard/registered',      icon: BookmarkIcon },
  { label: 'Completed Webinars',  route: '/dashboard/completed',       icon: CheckCircleIcon },
  { label: 'My Certificates',     route: '/dashboard/certificates',    icon: WorkspacePremiumIcon },
  { label: 'Webinar Recordings',  route: '/dashboard/recordings',      icon: VideoLibraryIcon },
  { label: 'Payments',            route: '/dashboard/payments',        icon: PaymentIcon },
  { label: 'Notifications',       route: '/dashboard/notifications',   icon: NotificationsIcon },
];

export default studentTabs;

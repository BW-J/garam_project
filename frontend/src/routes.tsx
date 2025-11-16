import React from 'react';

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'));
const OrgManagement = React.lazy(() => import('./views/system/org/OrgManagement.tsx'));
const ResourceManagement = React.lazy(
  () => import('./views/system/resource/ResourceManagement.tsx'),
);
const RoleManagement = React.lazy(() => import('./views/system/role/RoleManagement.tsx'));
const UserManagement = React.lazy(() => import('./views/system/user/UserManagement.tsx'));
const RoleAssignment = React.lazy(() => import('./views/system/assignment/RoleAssignment.tsx'));
const ProfilePage = React.lazy(() => import('./views/profile/ProfilePage.tsx'));
const LogViewer = React.lazy(() => import('./views/system/log/LogViewer.tsx'));
const CommissionManagement = React.lazy(
  () => import('./views/system/commission/CommissionManagement.tsx'),
);
const MyPerformancePage = React.lazy(() => import('./views/performance/MyPerformancePage.tsx'));
const MyCommissionPage = React.lazy(() => import('./views/performance/MyCommissionPage.tsx'));
const MyPromotionBonusPage = React.lazy(
  () => import('./views/performance/MyPromotionBonusPage.tsx'),
);
const BoardPage = React.lazy(() => import('./views/board/BoardPage'));
const PromotionManagement = React.lazy(
  () => import('./views/system/promotion/PromotionManagement.tsx'),
);

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/profile', name: '개인정보 수정', element: ProfilePage },
  // --- [신규] 사용자용 메뉴 ---
  { path: '/my-performance', name: '실적 조회', element: MyPerformancePage },
  { path: '/my-commission', name: '증원 수수료 조회', element: MyCommissionPage },
  { path: '/my-promotion-bonus', name: '승진 축하금 조회', element: MyPromotionBonusPage },
  // --- 시스템 관리용 ----
  { path: '/system/OrgManagement', name: '부서/직급관리', element: OrgManagement },
  { path: '/system/ResourceManagement', name: '메뉴/행동 관리', element: ResourceManagement },
  { path: '/system/RoleManagement', name: '권한 관리', element: RoleManagement },
  { path: '/system/UserManagement', name: '사용자 관리', element: UserManagement },
  { path: '/system/RoleAssignment', name: '역할 할당', element: RoleAssignment },
  { path: '/system/log-viewer', name: '로그 관리', element: LogViewer },
  { path: '/system/commission', name: '실적/수당 관리', element: CommissionManagement },
  { path: '/board/:type', name: '게시판', element: BoardPage },
  { path: '/system/promotion', name: '승진 관리', element: PromotionManagement },
];

export default routes;

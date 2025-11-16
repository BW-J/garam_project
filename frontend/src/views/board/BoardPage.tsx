import { useMemo } from 'react';
import { useLocation, Navigate } from 'react-router-dom'; // useParams 대신 useLocation 활용
import GenericBoardList from './GenericBoardList';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenu } from 'src/utils/permissionUtils';

const BoardPage = () => {
  const location = useLocation();
  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const user = useAuthStore((state) => state.user);

  const currentMenu = useMemo(() => {
    return getCurrentMenu(authorizedMenu);
  }, [authorizedMenu, location.pathname]); // URL이 바뀔 때마다 재계산

  // 메뉴 정보를 못 찾았으면 404 (DB에 등록되지 않은 경로로 접근 시)
  if (!currentMenu) {
    return <Navigate to="/404" replace />;
  }

  // 👇 메뉴 정보에서 필요한 값 추출
  const {
    menuCd, // 예: 'NOTICE' (이것을 boardType으로 사용)
    name, // 예: '공지사항' (보드 제목으로 사용)
    permissions = [], // 예: ['VIEW', 'CREATE']
  } = currentMenu;

  // 슈퍼 어드민이거나 'CREATE' 권한이 있으면 글쓰기 가능
  const canWrite = user?.isSuperAdmin || permissions.includes('create');
  const canDelete = user?.isSuperAdmin || permissions.includes('delete');
  const canEdit = user?.isSuperAdmin || permissions.includes('update');

  return (
    <GenericBoardList
      boardType={menuCd} // DB의 메뉴 코드를 게시판 타입으로 사용
      boardTitle={name} // DB의 메뉴명을 게시판 제목으로 사용
      canWrite={canWrite}
      canDelete={canDelete}
      canEdit={canEdit}
    />
  );
};

export default BoardPage;

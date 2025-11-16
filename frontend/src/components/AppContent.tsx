import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProgressSpinner } from 'primereact/progressspinner';
// routes config
import routes from '../routes';
import NotFoundExceptionPage from 'src/views/pages/error/Page404';

const AppContent = () => {
  return (
    <>
      <Suspense fallback={<ProgressSpinner style={{ width: '50px', height: '50px' }} />}>
        <Routes>
          {routes.map((route, idx) => {
            return (
              route.element && <Route key={idx} path={route.path} element={<route.element />} />
            );
          })}
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<NotFoundExceptionPage />} />
        </Routes>
      </Suspense>
    </>
  );
};

export default React.memo(AppContent);

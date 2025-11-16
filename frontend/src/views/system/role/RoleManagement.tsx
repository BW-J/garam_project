import { useState } from 'react';
import type { Role } from 'src/config/types/Role';
import RoleTable from 'src/views/system/role/RoleTable';
import RolePermissionTree from './RolePermissionTree';

const RoleManagement = () => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  return (
    <div className="page-flex-container">
      <div className="grid flex-grow-1 m-0">
        <div className="col-12 lg:col-5 flex flex-column flex-grow-1 p-2">
          <RoleTable selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
        </div>

        <div className="col-12 lg:col-7 flex flex-column flex-grow-1 p-2">
          <RolePermissionTree selectedRole={selectedRole} />
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;

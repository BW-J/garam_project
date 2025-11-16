import { useState, useEffect, useRef } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { PickList, type PickListChangeEvent } from 'primereact/picklist';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import api from 'src/api/axios';
import type { Role } from 'src/config/types/Role';
interface SubjectBase {
  isActive: boolean;
  deletedAt?: string | null;
  [key: string]: any;
}

interface AssignmentPanelProps<TSubject extends SubjectBase> {
  // UI 텍스트
  subjectTitle: string;
  subjectListTitle: string;

  // API 엔드포인트
  subjectApiUrl: string;
  roleMapApiUrlPrefix: string;

  subjectIdField: keyof TSubject;
  subjectLabelField: keyof TSubject;
}

export default function AssignmentPanel<TSubject extends SubjectBase>({
  subjectTitle,
  subjectListTitle,
  subjectApiUrl,
  roleMapApiUrlPrefix,
  subjectIdField,
  subjectLabelField,
}: AssignmentPanelProps<TSubject>) {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [subjectList, setSubjectList] = useState<TSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [sourceRoles, setSourceRoles] = useState<Role[]>([]);
  const [targetRoles, setTargetRoles] = useState<Role[]>([]);

  // 1. 컴포넌트 마운트 시: Dropdown 목록과 전체 역할 목록 로드
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(subjectApiUrl), // User 또는 Position 목록
      api.get('/system/role'), //
    ])
      .then(([subjectRes, roleRes]) => {
        setSubjectList(subjectRes.data.filter((s: TSubject) => s.isActive && !s.deletedAt));
        setAllRoles(roleRes.data.filter((r: Role) => r.isActive));
      })
      .catch((err) => {
        console.error('데이터 로드 실패', err);
        toast.current?.show({ severity: 'error', summary: '로드 실패' });
      })
      .finally(() => setLoading(false));
  }, [subjectApiUrl]);

  // 2. Dropdown에서 대상을 선택했을 때 (기존과 동일)
  useEffect(() => {
    if (selectedSubjectId === null) {
      setSourceRoles(allRoles);
      setTargetRoles([]);
      return;
    }

    setLoading(true);
    // 예: GET /user-role/:userId
    api
      .get(`${roleMapApiUrlPrefix}/${selectedSubjectId}`)
      .then((res) => {
        const apiData = res.data || [];
        const assignedRoles: Role[] = apiData.map((map: any) => map.role).filter(Boolean);
        const assignedRoleIds = new Set(assignedRoles.map((r) => r.roleId));

        setTargetRoles(assignedRoles);
        setSourceRoles(allRoles.filter((r) => !assignedRoleIds.has(r.roleId)));
      })
      .catch((err) => {
        console.error('할당된 역할 로드 실패', err);
        toast.current?.show({ severity: 'error', summary: '역할 로드 실패' });
      })
      .finally(() => setLoading(false));
  }, [selectedSubjectId, allRoles, roleMapApiUrlPrefix]);

  // 3. PickList 변경 시 (UI) (기존과 동일)
  const onPickListChange = (event: PickListChangeEvent) => {
    setSourceRoles(event.source);
    setTargetRoles(event.target);
  };

  // 4. 저장 버튼 클릭 시 (기존과 동일)
  const handleSave = async () => {
    if (selectedSubjectId === null) return;

    setLoading(true);
    const roleIds = targetRoles.map((r) => r.roleId);

    // DTO 형식에 맞게 payload 생성
    const payload = {
      [subjectIdField as string]: selectedSubjectId, // 'as string' 캐스팅 필요
      roleIds: roleIds,
    };

    try {
      // 예: POST /user-role/:userId
      await api.post(`${roleMapApiUrlPrefix}/${selectedSubjectId}`, payload);
      toast.current?.show({ severity: 'success', summary: '저장 완료' });
    } catch (err: any) {
      console.error('저장 실패', err);
      toast.current?.show({
        severity: 'error',
        summary: '저장 실패',
        detail: err.response?.data?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toast ref={toast} />
      <Card className="card-flex-full">
        {loading && <ProgressSpinner style={{ width: '50px', height: '50px' }} />}

        {!loading && (
          <div className="grid formgrid p-3">
            <div className="field col-12">
              <label htmlFor="subject-selector">{subjectListTitle}</label>
              <Dropdown
                id="subject-selector"
                value={selectedSubjectId}
                options={subjectList}
                onChange={(e) => setSelectedSubjectId(e.value ?? null)}
                optionLabel={subjectLabelField as string} // 'as string' 캐스팅
                optionValue={subjectIdField as string} // 'as string' 캐스팅
                placeholder={`${subjectTitle} 선택...`}
                filter
                showClear
                className="w-full"
              />
            </div>

            {selectedSubjectId !== null && (
              <>
                <div className="col-12">
                  <PickList
                    source={sourceRoles}
                    target={targetRoles}
                    onChange={onPickListChange}
                    itemTemplate={(item: Role) => item.roleNm}
                    dataKey="roleId"
                    sourceHeader="할당 가능한 역할"
                    targetHeader="할당된 역할"
                    sourceStyle={{ height: '300px' }}
                    targetStyle={{ height: '300px' }}
                    filter
                    filterBy="roleNm"
                    sourceFilterPlaceholder="역할 검색"
                    targetFilterPlaceholder="역할 검색"
                    breakpoint="1280px"
                  />
                </div>
                <div className="col-12 flex justify-content-end">
                  <Button label="저장" icon="pi pi-check" onClick={handleSave} disabled={loading} />
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

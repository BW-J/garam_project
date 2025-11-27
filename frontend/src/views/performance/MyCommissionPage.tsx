import CommissionSummaryView from '../system/commission/CommissionSummaryView';

export default function MyCommissionPage() {
  return (
    <div className="page-flex-container">
      <CommissionSummaryView mode="MY" commissionType="RECRUITMENT" title="내 증원 수수료 조회" />
    </div>
  );
}

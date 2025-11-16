import CommissionSummaryView from '../system/commission/CommissionSummaryView';

export default function MyPromotionBonusPage() {
  return (
    <div className="page-flex-container">
      <CommissionSummaryView mode="MY" commissionType="PROMOTION_BONUS" title="승진 축하금 조회" />
    </div>
  );
}

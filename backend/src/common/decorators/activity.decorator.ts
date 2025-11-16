import { SetMetadata } from '@nestjs/common';

export const ACTIVITY_ACTION_KEY = 'activity_action';

/**
 * @Activity('부서 생성')
 * 명시적으로 사용자 액션명을 지정할 수 있음.
 * 지정 안 하면 URL Path 기준으로 자동 기록.
 */
export const Activity = (actionName: string) =>
  SetMetadata(ACTIVITY_ACTION_KEY, actionName);

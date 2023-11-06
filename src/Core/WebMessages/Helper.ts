/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReEligibleCondition } from '../Interfaces/Campaign';
import { reEligibleConditionUnitToSec } from './Utils';
import { UserStateManager } from '../User/State';

export default class Helper {
    public static getCampaignHiddenUntilData(campaignId: string, reEligibleCondition: ReEligibleCondition) {
        if (!UserStateManager.userData.campaign_hidden_until) {
            UserStateManager.userData.campaign_hidden_until = {};
        }
        const previousLogs = UserStateManager.getMessageLogs(campaignId);
        const now = Math.floor(Date.now() / 1000);
        const newLogs = [...(previousLogs ?? []), now];
        const campaignHiddenUntilData: Record<string, any> = {};
        if (newLogs.length >= (reEligibleCondition.max_count ?? 1)) {
            const hiddenDuration = reEligibleConditionUnitToSec[reEligibleCondition.unit] * reEligibleCondition.value;
            campaignHiddenUntilData[`${campaignId}`] = now + hiddenDuration;
        }
        campaignHiddenUntilData[`${campaignId}_message_logs`] = [...(previousLogs ?? []), now];
        return campaignHiddenUntilData;
    }
}

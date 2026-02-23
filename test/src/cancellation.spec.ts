import { InWebMessageTemplateProps } from 'notifly-web-message-renderer';
import type { Campaign } from '../../src/Core/Interfaces/Campaign';

import { UserStateManager } from '../../src/Core/User/State';
import { WebMessageManager } from '../../src/Core/WebMessages/Manager';
import { WebMessageScheduler } from '../../src/Core/WebMessages/Scheduler';

jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        ensureInitialized: jest.fn(),
        getItems: jest.fn(),
        getItem: jest.fn(),
        setItems: jest.fn(),
        setItem: jest.fn(),
        removeItems: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.useFakeTimers().setSystemTime(new Date('2023-05-31'));

const makeTemplateCampaign = (overrides: Partial<Campaign> & { id: string }): Campaign => ({
    status: 1,
    triggering_conditions: [[{ type: 'event_name', operator: '=', operand: 'trigger_event' }]],
    channel: 'in-web-message',
    delay: 60,
    updated_at: '2023-05-30T00:00:00.000Z',
    starts: [1685400000],
    end: null,
    message: { html_url: '', modal_properties: { template_name: '' } as InWebMessageTemplateProps },
    segment_type: 'condition',
    ...overrides,
});

describe('cancellation conditions', () => {
    let descheduleSpy: jest.SpyInstance;

    beforeEach(() => {
        UserStateManager.eventIntermediateCounts = [];
        UserStateManager.inWebMessageCampaigns = [];
        descheduleSpy = jest.spyOn(WebMessageScheduler, 'descheduleInWebMessage');
    });

    afterEach(() => {
        descheduleSpy.mockRestore();
        WebMessageScheduler.descheduleInWebMessage(); // clear all (calls real method after restore)
    });

    describe('basic cancellation', () => {
        test('should cancel a scheduled campaign when cancellation event matches', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-with-cancel',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-with-cancel');

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_event', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-with-cancel');
            expect(WebMessageScheduler.getScheduledCampaignIds()).not.toContain('campaign-with-cancel');
        });

        test('should NOT cancel when event does not match cancellation conditions', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-no-match',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('unrelated_event', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-no-match');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-no-match');
        });

        test('should NOT cancel campaigns without cancellation_conditions', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-no-cancellation',
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_event', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-no-cancellation');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-no-cancellation');
        });

        test('should cancel only matching campaigns among multiple scheduled campaigns', () => {
            const campaignA = makeTemplateCampaign({
                id: 'campaign-A',
                delay: 30,
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
            });
            const campaignB = makeTemplateCampaign({
                id: 'campaign-B',
                delay: 60,
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'other_cancel' }]],
            });
            const campaignC = makeTemplateCampaign({
                id: 'campaign-C',
                delay: 90,
            });

            UserStateManager.inWebMessageCampaigns = [campaignA, campaignB, campaignC];
            WebMessageScheduler.scheduleInWebMessage(campaignA);
            WebMessageScheduler.scheduleInWebMessage(campaignB);
            WebMessageScheduler.scheduleInWebMessage(campaignC);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_event', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-A');
            expect(WebMessageScheduler.getScheduledCampaignIds()).not.toContain('campaign-A');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-B');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-C');
        });

        test('should do nothing when there are no scheduled campaigns', () => {
            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_event', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalled();
        });
    });

    describe('cancellation with event filters', () => {
        test('should cancel when both event name and event filters match', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-with-filters',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
                cancellation_event_filters: [
                    [{ key: 'item_id', operator: '=', value: 'abc', value_type: 'TEXT' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                'cancel_event',
                { item_id: 'abc' },
                null
            );

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-with-filters');
            expect(WebMessageScheduler.getScheduledCampaignIds()).not.toContain('campaign-with-filters');
        });

        test('should NOT cancel when event name matches but event filters do not', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-filter-mismatch',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
                cancellation_event_filters: [
                    [{ key: 'item_id', operator: '=', value: 'abc', value_type: 'TEXT' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                'cancel_event',
                { item_id: 'xyz' },
                null
            );

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-filter-mismatch');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-filter-mismatch');
        });

        test('should cancel when event filters use OR groups and one group matches', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-or-filter',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
                cancellation_event_filters: [
                    [{ key: 'status', operator: '=', value: 'paid', value_type: 'TEXT' }],
                    [{ key: 'status', operator: '=', value: 'refunded', value_type: 'TEXT' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                'cancel_event',
                { status: 'refunded' },
                null
            );

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-or-filter');
        });

        test('should NOT cancel when cancellation_event_filters is empty array', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-empty-filters',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
                cancellation_event_filters: [],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_event', {}, null);

            // Empty filters array is truthy but _matchTriggeringEventFilters returns false for empty
            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-empty-filters');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-empty-filters');
        });

        test('should cancel when event filter uses IS_NULL and param is absent', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-is-null',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
                cancellation_event_filters: [
                    [{ key: 'coupon', operator: 'IS_NULL' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                'cancel_event',
                {},
                null
            );

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-is-null');
        });

        test('should cancel when event filter uses IS_NOT_NULL and param is present', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-is-not-null',
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
                cancellation_event_filters: [
                    [{ key: 'coupon', operator: 'IS_NOT_NULL' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                'cancel_event',
                { coupon: 'SAVE10' },
                null
            );

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-is-not-null');
        });
    });

    describe('cancellation condition operators', () => {
        test('should cancel with starts_with operator', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-starts-with',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: 'starts_with', operand: 'purchase' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('purchase_completed', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-starts-with');
        });

        test('should cancel with ends_with operator', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-ends-with',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: 'ends_with', operand: '_completed' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('purchase_completed', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-ends-with');
        });

        test('should cancel with contains operator', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-contains',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: 'contains', operand: 'checkout' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('user_checkout_done', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-contains');
        });

        test('should NOT cancel with does_not_contain when event contains operand', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-does-not-contain',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: 'does_not_contain', operand: 'checkout' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('user_checkout_done', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-does-not-contain');
        });

        test('should cancel with != operator for non-matching event name', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-not-equal',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: '!=', operand: 'keep_alive' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('any_other_event', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-not-equal');
        });

        test('should NOT cancel with != operator when event name matches operand', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-not-equal-match',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: '!=', operand: 'keep_alive' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('keep_alive', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-not-equal-match');
        });

        test('should cancel with matches_regex operator', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-regex',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: 'matches_regex', operand: '^purchase_.*_completed$' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('purchase_item_completed', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-regex');
        });
    });

    describe('cancellation condition groups (OR/AND logic)', () => {
        test('should cancel when any OR group matches (multiple groups)', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-or-groups',
                cancellation_conditions: [
                    [{ type: 'event_name', operator: '=', operand: 'cancel_A' }],
                    [{ type: 'event_name', operator: '=', operand: 'cancel_B' }],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            // Fire the second group's event
            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_B', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-or-groups');
        });

        test('should cancel when AND conditions within a group all match', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-and-conditions',
                cancellation_conditions: [
                    [
                        { type: 'event_name', operator: 'starts_with', operand: 'purchase' },
                        { type: 'event_name', operator: 'ends_with', operand: '_completed' },
                    ],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('purchase_item_completed', {}, null);

            expect(descheduleSpy).toHaveBeenCalledWith('campaign-and-conditions');
        });

        test('should NOT cancel when only partial AND conditions match within a group', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-and-partial',
                cancellation_conditions: [
                    [
                        { type: 'event_name', operator: 'starts_with', operand: 'purchase' },
                        { type: 'event_name', operator: 'ends_with', operand: '_completed' },
                    ],
                ],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            // Matches starts_with but NOT ends_with
            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('purchase_started', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-and-partial');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-and-partial');
        });

        test('should NOT cancel when cancellation_conditions is empty array', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-empty-conditions',
                cancellation_conditions: [],
            });

            UserStateManager.inWebMessageCampaigns = [campaign];
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('any_event', {}, null);

            expect(descheduleSpy).not.toHaveBeenCalledWith('campaign-empty-conditions');
            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('campaign-empty-conditions');
        });
    });

    describe('delay=0 campaigns (immediate display)', () => {
        test('should NOT be in scheduled list since they are shown immediately', () => {
            const campaign = makeTemplateCampaign({
                id: 'campaign-no-delay',
                delay: 0,
                cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_event' }]],
            });

            WebMessageScheduler.scheduleInWebMessage(campaign);

            // delay=0 campaigns are shown immediately, never added to _scheduledWebMessages
            expect(WebMessageScheduler.getScheduledCampaignIds()).not.toContain('campaign-no-delay');
        });
    });

    describe('getScheduledCampaignIds', () => {
        test('should return empty array when no campaigns are scheduled', () => {
            expect(WebMessageScheduler.getScheduledCampaignIds()).toEqual([]);
        });

        test('should return campaign IDs for scheduled campaigns', () => {
            const campaignA = makeTemplateCampaign({ id: 'a', delay: 10 });
            const campaignB = makeTemplateCampaign({ id: 'b', delay: 20 });

            WebMessageScheduler.scheduleInWebMessage(campaignA);
            WebMessageScheduler.scheduleInWebMessage(campaignB);

            const ids = WebMessageScheduler.getScheduledCampaignIds();
            expect(ids).toContain('a');
            expect(ids).toContain('b');
        });

        test('should not include descheduled campaign IDs', () => {
            const campaign = makeTemplateCampaign({ id: 'to-remove', delay: 10 });
            WebMessageScheduler.scheduleInWebMessage(campaign);

            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('to-remove');

            WebMessageScheduler.descheduleInWebMessage('to-remove');

            expect(WebMessageScheduler.getScheduledCampaignIds()).not.toContain('to-remove');
        });

        test('deschedule of non-existent campaign should be a no-op', () => {
            const campaign = makeTemplateCampaign({ id: 'existing', delay: 10 });
            WebMessageScheduler.scheduleInWebMessage(campaign);

            WebMessageScheduler.descheduleInWebMessage('non-existent');

            expect(WebMessageScheduler.getScheduledCampaignIds()).toContain('existing');
        });
    });
});

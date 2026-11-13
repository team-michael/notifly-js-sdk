import { InWebMessageTemplateProps } from 'notifly-web-message-renderer';
import type { Campaign } from '../../src/Core/Interfaces/Campaign';

import { NotiflyAPI } from '../../src/Core/API';
import { EventLogger } from '../../src/Core/Event';
import { NotiflyStorage } from '../../src/Core/Storage';
import { UserStateManager } from '../../src/Core/User/State';
import { WebMessageScheduler } from '../../src/Core/WebMessages/Scheduler';

jest.mock('../../src/Core/API', () => ({
    NotiflyAPI: { call: jest.fn() },
}));

jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        getItems: jest.fn(),
        setItem: jest.fn(),
    },
}));

jest.useFakeTimers().setSystemTime(new Date('2023-05-31'));

const eventCountCampaign: Campaign = {
    id: 'local-event-count-one',
    status: 1,
    channel: 'in-web-message',
    updated_at: '2023-05-30T00:00:00.000Z',
    starts: [1685400000],
    end: null,
    message: {
        html_url: '',
        modal_properties: { template_name: 'test-template' } as InWebMessageTemplateProps,
    },
    triggering_conditions: [[{ type: 'event_name', operator: '=', operand: 'test_event' }]],
    segment_type: 'condition',
    segment_info: {
        groups: [
            {
                conditions: [
                    {
                        unit: 'event',
                        event: 'test_event',
                        event_condition_type: 'count X',
                        operator: '=',
                        value: 1,
                    },
                ],
                condition_operator: null,
            },
        ],
        group_operator: null,
    },
    delay: 0,
};

describe('EventLogger web-message evaluation order', () => {
    let scheduleSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
        scheduleSpy = jest.spyOn(WebMessageScheduler, 'scheduleInWebMessage').mockImplementation(() => undefined);
        jest.mocked(NotiflyStorage.getItems).mockResolvedValue([
            'test-project-id',
            'test-device-id',
            'test-external-user-id',
        ]);
        jest.mocked(NotiflyAPI.call).mockResolvedValue({});
        UserStateManager.eventIntermediateCounts = [];
        UserStateManager.inWebMessageCampaigns = [eventCountCampaign];
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        UserStateManager.eventIntermediateCounts = [];
        UserStateManager.inWebMessageCampaigns = [];
    });

    test('includes a successfully uploaded local event in immediate segment evaluation', async () => {
        await EventLogger.logEvent('test_event', {}, null, false);

        expect(scheduleSpy).toHaveBeenCalledTimes(1);
        expect(scheduleSpy.mock.calls[0][0]).toBe(eventCountCampaign);
        expect(UserStateManager.eventIntermediateCounts).toEqual([
            expect.objectContaining({ name: 'test_event', count: 1 }),
        ]);
    });

    test('does not count or evaluate a local event when upload fails', async () => {
        jest.mocked(NotiflyAPI.call).mockRejectedValueOnce(new Error('upload failed'));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await EventLogger.logEvent('test_event', {}, null, false);

        expect(scheduleSpy).not.toHaveBeenCalled();
        expect(UserStateManager.eventIntermediateCounts).toEqual([]);
    });
});

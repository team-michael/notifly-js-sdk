import { InWebMessageTemplateProps } from 'notifly-web-message-renderer';
import type { Campaign, Condition } from '../../src/Core/Interfaces/Campaign';
import { UserStateManager } from '../../src/Core/User/State';
import { WebMessageManager } from '../../src/Core/WebMessages/Manager';
import { ValueComparator } from '../../src/Core/WebMessages/Utils';

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

jest.useFakeTimers().setSystemTime(new Date('2025-05-21'));

function makeCampaign(conditions: Condition[]): Campaign {
    return {
        id: 'test-campaign',
        status: 1,
        channel: 'in-web-message',
        updated_at: '2025-05-20T00:00:00.000Z',
        message: {
            html_url: '',
            modal_properties: { template_name: 'test_template' } as InWebMessageTemplateProps,
        },
        triggering_conditions: [[{ type: 'event_name', operator: '=', operand: 'test_event' }]],
        segment_type: 'condition',
        segment_info: {
            groups: [{ conditions, condition_operator: 'AND' }],
            group_operator: null,
        },
    };
}

describe('NOTIFLY-396: 웹 팝업 유저 조건 평가 버그 수정', () => {
    describe('boolean falsy 값 처리', () => {
        beforeEach(() => {
            UserStateManager.userData = {
                user_properties: {
                    isCompany: false,
                    subscription_status: 'CANCELED',
                    service_region: 'KR',
                    roles: [],
                },
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };
        });

        test('boolean false 속성에 <> true 조건은 true', () => {
            const campaign = makeCampaign([
                { attribute: 'isCompany', operator: '<>', unit: 'user', value: true, valueType: 'BOOL' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(true);
        });

        test('boolean false 속성에 = false 조건은 true', () => {
            const campaign = makeCampaign([
                { attribute: 'isCompany', operator: '=', unit: 'user', value: false, valueType: 'BOOL' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(true);
        });
    });

    describe('null 유저 속성 + 부정 연산자', () => {
        beforeEach(() => {
            UserStateManager.userData = {
                user_properties: {
                    service_region: 'KR',
                },
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };
        });

        test('null 속성에 <> 조건은 true', () => {
            const campaign = makeCampaign([
                { attribute: 'subscription_status', operator: '<>', unit: 'user', value: 'ACTIVE', valueType: 'TEXT' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(true);
        });

        test('null 속성에 IS_NULL 조건은 true', () => {
            const campaign = makeCampaign([
                { attribute: 'subscription_status', operator: 'IS_NULL', unit: 'user', value: null },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(true);
        });

        test('null 속성에 = 조건은 false', () => {
            const campaign = makeCampaign([
                { attribute: 'subscription_status', operator: '=', unit: 'user', value: 'ACTIVE', valueType: 'TEXT' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(false);
        });
    });

    describe('NOT_INCLUDE 연산자', () => {
        test('배열에 값이 없으면 true', () => {
            UserStateManager.userData = {
                user_properties: { roles: ['student', 'viewer'] },
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };
            const campaign = makeCampaign([
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(true);
        });

        test('배열에 값이 있으면 false', () => {
            UserStateManager.userData = {
                user_properties: { roles: ['student', 'creator'] },
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };
            const campaign = makeCampaign([
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(false);
        });

        test('빈 배열이면 true', () => {
            UserStateManager.userData = {
                user_properties: { roles: [] },
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };
            const campaign = makeCampaign([
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(true);
        });

        test('null 속성이면 false (서버 동작 일치)', () => {
            UserStateManager.userData = {
                user_properties: {},
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };
            const campaign = makeCampaign([
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
            ]);
            expect(WebMessageManager.isEntityOfSegment(campaign, {}, null)).toBe(false);
        });
    });

    describe('복합 조건 통합 테스트', () => {
        test('모든 조건을 만족하는 유저 → 팝업 노출', () => {
            UserStateManager.userData = {
                user_properties: {
                    service_region: 'KR',
                    subscription_status: null,
                    isCompany: false,
                    roles: [],
                    deleted_at: undefined,
                },
                external_user_id: 'test-user-1',
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };

            const campaign = makeCampaign([
                { attribute: 'service_region', operator: '=', unit: 'user', value: 'KR', valueType: 'TEXT' },
                { attribute: 'subscription_status', operator: '<>', unit: 'user', value: 'ACTIVE', valueType: 'TEXT' },
                { attribute: 'isCompany', operator: '<>', unit: 'user', value: true, valueType: 'BOOL' },
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
                { attribute: 'deleted_at', operator: 'IS_NULL', unit: 'user', value: null },
            ]);

            expect(WebMessageManager.isEntityOfSegment(campaign, {}, 'test-user-1')).toBe(true);
        });

        test('배열 조건 불일치 유저 → 팝업 미노출', () => {
            UserStateManager.userData = {
                user_properties: {
                    service_region: 'KR',
                    subscription_status: null,
                    isCompany: false,
                    roles: ['creator'],
                },
                external_user_id: 'test-user-2',
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };

            const campaign = makeCampaign([
                { attribute: 'service_region', operator: '=', unit: 'user', value: 'KR', valueType: 'TEXT' },
                { attribute: 'subscription_status', operator: '<>', unit: 'user', value: 'ACTIVE', valueType: 'TEXT' },
                { attribute: 'isCompany', operator: '<>', unit: 'user', value: true, valueType: 'BOOL' },
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
            ]);

            expect(WebMessageManager.isEntityOfSegment(campaign, {}, 'test-user-2')).toBe(false);
        });

        test('텍스트 조건 불일치 유저 → 팝업 미노출', () => {
            UserStateManager.userData = {
                user_properties: {
                    service_region: 'KR',
                    subscription_status: 'ACTIVE',
                    isCompany: false,
                    roles: [],
                },
                external_user_id: 'test-user-3',
                sdk_type: 'js',
                sdk_version: '2.17.6',
                platform: 'web',
            };

            const campaign = makeCampaign([
                { attribute: 'service_region', operator: '=', unit: 'user', value: 'KR', valueType: 'TEXT' },
                { attribute: 'subscription_status', operator: '<>', unit: 'user', value: 'ACTIVE', valueType: 'TEXT' },
                { attribute: 'isCompany', operator: '<>', unit: 'user', value: true, valueType: 'BOOL' },
                { attribute: 'roles', operator: 'NOT_INCLUDE', unit: 'user', value: 'creator', valueType: 'TEXT' },
            ]);

            expect(WebMessageManager.isEntityOfSegment(campaign, {}, 'test-user-3')).toBe(false);
        });
    });

    describe('ValueComparator.DoesNotHaveElement', () => {
        test('배열에 값이 없으면 true', () => {
            expect(ValueComparator.DoesNotHaveElement(['a', 'b'], 'c', 'TEXT')).toBe(true);
        });

        test('배열에 값이 있으면 false', () => {
            expect(ValueComparator.DoesNotHaveElement(['a', 'b', 'c'], 'c', 'TEXT')).toBe(false);
        });

        test('빈 배열이면 true', () => {
            expect(ValueComparator.DoesNotHaveElement([], 'c', 'TEXT')).toBe(true);
        });

        test('INT 타입 - 배열에 값이 없으면 true', () => {
            expect(ValueComparator.DoesNotHaveElement([1, 2, 3], 4, 'INT')).toBe(true);
        });

        test('INT 타입 - 배열에 값이 있으면 false', () => {
            expect(ValueComparator.DoesNotHaveElement([1, 2, 3], 2, 'INT')).toBe(false);
        });
    });
});

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// eslint-disable-next-line @kbn/eslint/no-restricted-paths
import { elasticsearchClientMock } from '../../../../../src/core/server/elasticsearch/client/mocks';
import { getInUseTotalCount, getTotalCount } from './actions_telemetry';

describe('actions telemetry', () => {
  test('getTotalCount should replace first symbol . to __ for action types names', async () => {
    const mockEsClient = elasticsearchClientMock.createClusterClient().asScoped().asInternalUser;
    mockEsClient.search.mockReturnValue(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        aggregations: {
          byActionTypeId: {
            value: {
              types: { '.index': 1, '.server-log': 1, 'some.type': 1, 'another.type.': 1 },
            },
          },
        },
        hits: {
          hits: [
            {
              _id: 'action:541efb3d-f82a-4d2c-a5c3-636d1ce49b53',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: '.index',
                  config: {
                    index: 'kibana_sample_data_ecommerce',
                    refresh: true,
                    executionTimeField: null,
                  },
                  name: 'test',
                  secrets:
                    'UPyn6cit6zBTPMmldfKh/8S2JWypwaLhhEQWBXp+OyTc6TtLHOnW92wehCqTq1FhIY3vA8hwVsggj+tbIoCcfPArpzP5SO7hh8vd6pY13x5TkiM083UgjjaAxbPvKQ==',
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
            {
              _id: 'action:00000000-f82a-4d2c-a5c3-636d1ce49b53',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: '.server-log',
                  config: {},
                  name: 'test server log',
                  secrets: '',
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
            {
              _id: 'action:00000000-1',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: 'some.type',
                  config: {},
                  name: 'test type',
                  secrets: {},
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
            {
              _id: 'action:00000000-2',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: 'another.type.',
                  config: {},
                  name: 'test another type',
                  secrets: {},
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
          ],
        },
      })
    );
    const telemetry = await getTotalCount(mockEsClient, 'test');

    expect(mockEsClient.search).toHaveBeenCalledTimes(1);

    expect(telemetry).toMatchInlineSnapshot(`
Object {
  "countByType": Object {
    "__index": 1,
    "__server-log": 1,
    "another.type__": 1,
    "some.type": 1,
  },
  "countTotal": 4,
}
`);
  });

  test('getInUseTotalCount', async () => {
    const mockEsClient = elasticsearchClientMock.createClusterClient().asScoped().asInternalUser;
    mockEsClient.search.mockReturnValueOnce(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        aggregations: {
          refs: {
            actionRefIds: {
              value: {
                connectorIds: { '1': 'action-0', '123': 'action-0' },
                total: 2,
              },
            },
          },
          hits: {
            hits: [],
          },
        },
      })
    );

    mockEsClient.search.mockReturnValueOnce(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        hits: {
          hits: [
            {
              _source: {
                action: {
                  id: '1',
                  actionTypeId: '.server-log',
                },
              },
            },
            {
              _source: {
                action: {
                  id: '2',
                  actionTypeId: '.slack',
                },
              },
            },
          ],
        },
      })
    );
    const telemetry = await getInUseTotalCount(mockEsClient, 'test');

    expect(mockEsClient.search).toHaveBeenCalledTimes(2);
    expect(telemetry).toMatchInlineSnapshot(`
Object {
  "countByAlertHistoryConnectorType": 0,
  "countByType": Object {
    "__server-log": 1,
    "__slack": 1,
  },
  "countTotal": 2,
}
`);
  });

  test('getInUseTotalCount should count preconfigured alert history connector usage', async () => {
    const mockEsClient = elasticsearchClientMock.createClusterClient().asScoped().asInternalUser;
    mockEsClient.search.mockReturnValueOnce(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        aggregations: {
          refs: {
            actionRefIds: {
              value: {
                connectorIds: {
                  '1': 'action_0',
                  '123': 'action_1',
                  'preconfigured-alert-history-es-index': 'action_2',
                },
                total: 3,
              },
            },
          },
          preconfigured_actions: {
            preconfiguredActionRefIds: {
              value: {
                total: 1,
                actionRefs: {
                  'preconfigured:preconfigured-alert-history-es-index': {
                    actionRef: 'preconfigured:preconfigured-alert-history-es-index',
                    actionTypeId: '.index',
                  },
                },
              },
            },
          },
        },
      })
    );
    mockEsClient.search.mockReturnValueOnce(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        hits: {
          hits: [
            {
              _source: {
                action: {
                  id: '1',
                  actionTypeId: '.server-log',
                },
              },
            },
            {
              _source: {
                action: {
                  id: '2',
                  actionTypeId: '.slack',
                },
              },
            },
          ],
        },
      })
    );
    const telemetry = await getInUseTotalCount(mockEsClient, 'test');

    expect(mockEsClient.search).toHaveBeenCalledTimes(2);
    expect(telemetry).toMatchInlineSnapshot(`
Object {
  "countByAlertHistoryConnectorType": 1,
  "countByType": Object {
    "__index": 1,
    "__server-log": 1,
    "__slack": 1,
  },
  "countTotal": 4,
}
`);
  });

  test('getTotalCount accounts for preconfigured connectors', async () => {
    const mockEsClient = elasticsearchClientMock.createClusterClient().asScoped().asInternalUser;
    mockEsClient.search.mockReturnValue(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        aggregations: {
          byActionTypeId: {
            value: {
              types: { '.index': 1, '.server-log': 1, 'some.type': 1, 'another.type.': 1 },
            },
          },
        },
        hits: {
          hits: [
            {
              _id: 'action:541efb3d-f82a-4d2c-a5c3-636d1ce49b53',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: '.index',
                  config: {
                    index: 'kibana_sample_data_ecommerce',
                    refresh: true,
                    executionTimeField: null,
                  },
                  name: 'test',
                  secrets:
                    'UPyn6cit6zBTPMmldfKh/8S2JWypwaLhhEQWBXp+OyTc6TtLHOnW92wehCqTq1FhIY3vA8hwVsggj+tbIoCcfPArpzP5SO7hh8vd6pY13x5TkiM083UgjjaAxbPvKQ==',
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
            {
              _id: 'action:00000000-f82a-4d2c-a5c3-636d1ce49b53',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: '.server-log',
                  config: {},
                  name: 'test server log',
                  secrets: '',
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
            {
              _id: 'action:00000000-1',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: 'some.type',
                  config: {},
                  name: 'test type',
                  secrets: {},
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
            {
              _id: 'action:00000000-2',
              _index: '.kibana_1',
              _score: 0,
              _source: {
                action: {
                  actionTypeId: 'another.type.',
                  config: {},
                  name: 'test another type',
                  secrets: {},
                },
                references: [],
                type: 'action',
                updated_at: '2020-03-26T18:46:44.449Z',
              },
            },
          ],
        },
      })
    );
    const telemetry = await getTotalCount(mockEsClient, 'test', [
      {
        id: 'test',
        actionTypeId: '.test',
        name: 'test',
        isPreconfigured: true,
        secrets: {},
      },
      {
        id: 'anotherServerLog',
        actionTypeId: '.server-log',
        name: 'test',
        isPreconfigured: true,
        secrets: {},
      },
    ]);

    expect(mockEsClient.search).toHaveBeenCalledTimes(1);

    expect(telemetry).toMatchInlineSnapshot(`
Object {
  "countByType": Object {
    "__index": 1,
    "__server-log": 2,
    "__test": 1,
    "another.type__": 1,
    "some.type": 1,
  },
  "countTotal": 6,
}
`);
  });

  test('getInUseTotalCount() accounts for preconfigured connectors', async () => {
    const mockEsClient = elasticsearchClientMock.createClusterClient().asScoped().asInternalUser;
    mockEsClient.search.mockReturnValueOnce(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        aggregations: {
          refs: {
            actionRefIds: {
              value: {
                connectorIds: {
                  '1': 'action-0',
                  '123': 'action-1',
                  '456': 'action-2',
                },
                total: 3,
              },
            },
          },
          preconfigured_actions: {
            preconfiguredActionRefIds: {
              value: {
                total: 3,
                actionRefs: {
                  'preconfigured:preconfigured-alert-history-es-index': {
                    actionRef: 'preconfigured:preconfigured-alert-history-es-index',
                    actionTypeId: '.index',
                  },
                  'preconfigured:cloud_email': {
                    actionRef: 'preconfigured:cloud_email',
                    actionTypeId: '.email',
                  },
                  'preconfigured:cloud_email2': {
                    actionRef: 'preconfigured:cloud_email2',
                    actionTypeId: '.email',
                  },
                },
              },
            },
          },
        },
      })
    );
    mockEsClient.search.mockReturnValueOnce(
      // @ts-expect-error not full search response
      elasticsearchClientMock.createSuccessTransportRequestPromise({
        hits: {
          hits: [
            {
              _source: {
                action: {
                  id: '1',
                  actionTypeId: '.server-log',
                },
              },
            },
            {
              _source: {
                action: {
                  id: '2',
                  actionTypeId: '.slack',
                },
              },
            },
            {
              _source: {
                action: {
                  id: '3',
                  actionTypeId: '.email',
                },
              },
            },
          ],
        },
      })
    );
    const telemetry = await getInUseTotalCount(mockEsClient, 'test');

    expect(mockEsClient.search).toHaveBeenCalledTimes(2);
    expect(telemetry).toMatchInlineSnapshot(`
Object {
  "countByAlertHistoryConnectorType": 1,
  "countByType": Object {
    "__email": 3,
    "__index": 1,
    "__server-log": 1,
    "__slack": 1,
  },
  "countTotal": 6,
}
`);
  });
});

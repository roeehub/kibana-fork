/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

let toggleSetupMode;
let initSetupModeState;
let getSetupModeState;
let updateSetupModeData;
let setSetupModeMenuItem;

jest.mock('./ajax_error_handler', () => ({
  ajaxErrorHandlersProvider: (err) => {
    throw err;
  },
}));

jest.mock('react-dom', () => ({
  render: jest.fn(),
}));

jest.mock('../legacy_shims', () => {
  return {
    Legacy: {
      shims: {
        getAngularInjector: () => ({ get: () => ({ get: () => 'utc' }) }),
        toastNotifications: {
          addDanger: jest.fn(),
        },
        I18nContext: '<div>',
      },
    },
  };
});

let data = {};

const injectorModulesMock = {
  globalState: {
    save: jest.fn(),
  },
  Private: (module) => module,
  $http: {
    post: jest.fn().mockImplementation(() => {
      return { data };
    }),
  },
  $executor: {
    run: jest.fn(),
  },
};

const angularStateMock = {
  injector: {
    get: (module) => {
      return injectorModulesMock[module] || {};
    },
  },
  scope: {
    $apply: (fn) => fn && fn(),
    $evalAsync: (fn) => fn && fn(),
  },
};

// We are no longer waiting for setup mode data to be fetched when enabling
// so we need to wait for the next tick for the async action to finish

function setModulesAndMocks() {
  jest.clearAllMocks().resetModules();
  injectorModulesMock.globalState.inSetupMode = false;

  const setupMode = require('./setup_mode');
  toggleSetupMode = setupMode.toggleSetupMode;
  initSetupModeState = setupMode.initSetupModeState;
  getSetupModeState = setupMode.getSetupModeState;
  updateSetupModeData = setupMode.updateSetupModeData;
  setSetupModeMenuItem = setupMode.setSetupModeMenuItem;
}

function waitForSetupModeData() {
  return new Promise((resolve) => process.nextTick(resolve));
}

xdescribe('setup_mode', () => {
  beforeEach(async () => {
    setModulesAndMocks();
  });

  describe('setup', () => {
    it('should require angular state', async () => {
      let error;
      try {
        toggleSetupMode(true);
      } catch (err) {
        error = err;
      }
      expect(error.message).toEqual(
        'Unable to interact with setup ' +
          'mode because the angular injector was not previously set. This needs to be ' +
          'set by calling `initSetupModeState`.'
      );
    });

    it('should enable toggle mode', async () => {
      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      toggleSetupMode(true);
      expect(injectorModulesMock.globalState.inSetupMode).toBe(true);
    });

    it('should disable toggle mode', async () => {
      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      toggleSetupMode(false);
      expect(injectorModulesMock.globalState.inSetupMode).toBe(false);
    });

    it('should set top nav config', async () => {
      const render = require('react-dom').render;
      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      setSetupModeMenuItem();
      toggleSetupMode(true);
      expect(render.mock.calls.length).toBe(2);
    });
  });

  describe('in setup mode', () => {
    afterEach(async () => {
      data = {};
    });

    it('should not fetch data if the user does not have sufficient permissions', async () => {
      const addDanger = jest.fn();
      jest.doMock('../legacy_shims', () => ({
        Legacy: {
          shims: {
            toastNotifications: {
              addDanger,
            },
            I18nContext: '<div>',
          },
        },
      }));
      data = {
        _meta: {
          hasPermissions: false,
        },
      };
      setModulesAndMocks();
      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      toggleSetupMode(true);
      await waitForSetupModeData();

      const state = getSetupModeState();
      expect(state.enabled).toBe(false);
      expect(addDanger).toHaveBeenCalledWith({
        title: 'Setup mode is not available',
        text: 'You do not have the necessary permissions to do this.',
      });
    });

    it('should set the newly discovered cluster uuid', async () => {
      const clusterUuid = '1ajy';
      data = {
        _meta: {
          liveClusterUuid: clusterUuid,
          hasPermissions: true,
        },
        elasticsearch: {
          byUuid: {
            123: {
              isPartiallyMigrated: true,
            },
          },
        },
      };
      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      toggleSetupMode(true);
      await waitForSetupModeData();

      expect(injectorModulesMock.globalState.cluster_uuid).toBe(clusterUuid);
    });

    it('should fetch data for a given cluster', async () => {
      const clusterUuid = '1ajy';
      data = {
        _meta: {
          liveClusterUuid: clusterUuid,
          hasPermissions: true,
        },
        elasticsearch: {
          byUuid: {
            123: {
              isPartiallyMigrated: true,
            },
          },
        },
      };

      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      toggleSetupMode(true);
      await waitForSetupModeData();

      expect(injectorModulesMock.$http.post).toHaveBeenCalledWith(
        `../api/monitoring/v1/setup/collection/cluster/${clusterUuid}`,
        {
          ccs: undefined,
        }
      );
    });

    it('should fetch data for a single node', async () => {
      await initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      toggleSetupMode(true);
      await waitForSetupModeData();

      injectorModulesMock.$http.post.mockClear();
      await updateSetupModeData('45asd');
      expect(injectorModulesMock.$http.post).toHaveBeenCalledWith(
        '../api/monitoring/v1/setup/collection/node/45asd',
        {
          ccs: undefined,
        }
      );
    });

    it('should fetch data without a cluster uuid', async () => {
      initSetupModeState(angularStateMock.scope, angularStateMock.injector);
      await toggleSetupMode(true);
      injectorModulesMock.$http.post.mockClear();
      await updateSetupModeData(undefined, true);
      const url = '../api/monitoring/v1/setup/collection/cluster';
      const args = { ccs: undefined };
      expect(injectorModulesMock.$http.post).toHaveBeenCalledWith(url, args);
    });
  });
});

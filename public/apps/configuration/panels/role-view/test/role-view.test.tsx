/*
 *   Copyright OpenSearch Contributors
 *
 *   Licensed under the Apache License, Version 2.0 (the "License").
 *   You may not use this file except in compliance with the License.
 *   A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   or in the "license" file accompanying this file. This file is distributed
 *   on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *   express or implied. See the License for the specific language governing
 *   permissions and limitations under the License.
 */

import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount, render, shallow } from 'enzyme';
import { RoleView } from '../role-view';
import { ClusterPermissionPanel } from '../../role-view/cluster-permission-panel';
import { IndexPermissionPanel } from '../index-permission-panel';
import { TenantsPanel } from '../tenants-panel';
import { EuiTabbedContent } from '@elastic/eui';
import {
  getRoleMappingData,
  transformRoleMappingData,
  updateRoleMapping,
} from '../../../utils/role-mapping-utils';
import { fetchActionGroups } from '../../../utils/action-groups-utils';
import { getRoleDetail } from '../../../utils/role-detail-utils';
import { transformRoleIndexPermissions } from '../../../utils/index-permission-utils';
import { transformRoleTenantPermissions } from '../../../utils/tenant-utils';
import { useDeleteConfirmState } from '../../../utils/delete-confirm-modal-utils';
import { requestDeleteRoles } from '../../../utils/role-list-utils';
import { Action, SubAction, TenantPermissionType } from '../../../types';
import { ResourceType } from '../../../../../../common';
import { buildHashUrl } from '../../../utils/url-builder';
import { createUnknownErrorToast } from '../../../utils/toast-utils';
import { getDashboardsInfoSafe } from '../../../../../utils/dashboards-info-utils';

jest.mock('../../../utils/role-mapping-utils', () => ({
  getRoleMappingData: jest.fn().mockReturnValue({ backend_roles: [], hosts: [], users: [] }),
  transformRoleMappingData: jest.fn().mockReturnValue({
    userName: '',
    userType: '',
  }),
  updateRoleMapping: jest.fn(),
}));
jest.mock('../../../utils/action-groups-utils', () => ({
  fetchActionGroups: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../utils/role-detail-utils', () => ({
  getRoleDetail: jest.fn().mockReturnValue({
    cluster_permissions: [],
    index_permissions: [],
    tenant_permissions: [],
    reserved: false,
  }),
}));
jest.mock('../../../utils/delete-confirm-modal-utils', () => ({
  useDeleteConfirmState: jest.fn().mockReturnValue([jest.fn(), '']),
}));
jest.mock('../../../utils/index-permission-utils');
jest.mock('../../../utils/tenant-utils');
jest.mock('../../../utils/role-list-utils', () => ({
  requestDeleteRoles: jest.fn(),
}));
jest.mock('../../../utils/context-menu', () => ({
  useContextMenuState: jest
    .fn()
    .mockImplementation((buttonText, buttonProps, children) => [children, jest.fn()]),
}));
jest.mock('../../../utils/toast-utils', () => ({
  createErrorToast: jest.fn(),
  createUnknownErrorToast: jest.fn(),
  useToastState: jest.fn().mockReturnValue([[], jest.fn(), jest.fn()]),
}));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn().mockReturnValue({ dataSource: { id: 'test' }, setDataSource: jest.fn() }), // Mock the useContext hook to return dummy datasource and setdatasource function
}));
jest.mock('../../../../../utils/dashboards-info-utils');

const sampleRole = 'role';
const mockCoreStart = {
  http: 1,
  uiSettings: {
    get: jest.fn().mockReturnValue(false),
  },
  chrome: {
    navGroup: { getNavGroupEnabled: jest.fn().mockReturnValue(false) },
    setBreadcrumbs: jest.fn(),
  },
};
const mockDepsStart = { navigation: { ui: { HeaderControl: {} } } };

describe('Role view', () => {
  const setState = jest.fn();
  const buildBreadcrumbs = jest.fn();

  const useEffect = jest.spyOn(React, 'useEffect');
  const useState = jest.spyOn(React, 'useState');

  beforeEach(() => {
    useEffect.mockImplementationOnce((f) => f());
    useState.mockImplementation((initialValue) => [initialValue, setState]);
  });

  it('basic rendering when permission tab is selected', () => {
    const component = shallow(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );

    expect(component.find(EuiTabbedContent).length).toBe(1);

    const tabs = component.find(EuiTabbedContent).dive();
    expect(tabs.find(ClusterPermissionPanel).length).toBe(1);
    expect(tabs.find(IndexPermissionPanel).length).toBe(1);
    expect(tabs.find(TenantsPanel).length).toBe(1);
    expect(component).toMatchSnapshot();
  });

  it('renders when mapped user tab is selected', () => {
    const component = shallow(
      <RoleView
        roleName={sampleRole}
        prevAction={SubAction.mapuser}
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );
    expect(component).toMatchSnapshot();
  });

  it('should render to map user page when click on Map users', () => {
    const wrapper = shallow(
      <RoleView
        roleName={sampleRole}
        prevAction={SubAction.mapuser}
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );
    const tabs = wrapper.find(EuiTabbedContent).dive();
    const roleMappingList = tabs.find('[data-test-subj="role-mapping-list"]').dive();
    const Wrapper = mount(<>{roleMappingList}</>);
    Wrapper.find('[data-test-subj="map-users"]').first().simulate('click');
    expect(window.location.hash).toBe(
      buildHashUrl(ResourceType.roles, Action.edit, sampleRole, SubAction.mapuser)
    );
  });

  it('should render to map user page when click on Manage Mapping', () => {
    const wrapper = shallow(
      <RoleView
        roleName={sampleRole}
        prevAction={SubAction.mapuser}
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );
    const tabs = wrapper.find(EuiTabbedContent).dive();
    tabs.find('[data-test-subj="manage-mapping"]').first().simulate('click');
    expect(window.location.hash).toBe(
      buildHashUrl(ResourceType.roles, Action.edit, sampleRole, SubAction.mapuser)
    );
  });

  it('fetch data', (done) => {
    const component = shallow(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );

    process.nextTick(() => {
      expect(getRoleMappingData).toHaveBeenCalledTimes(1);
      expect(transformRoleMappingData).toHaveBeenCalledTimes(1);
      expect(fetchActionGroups).toHaveBeenCalledTimes(1);
      expect(getRoleDetail).toHaveBeenCalledTimes(1);
      expect(transformRoleIndexPermissions).toHaveBeenCalledTimes(1);
      expect(transformRoleTenantPermissions).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('fetch data error', () => {
    getRoleMappingData.mockImplementationOnce(() => {
      throw new Error();
    });
    // Hide the error message
    jest.spyOn(console, 'log').mockImplementationOnce(() => {});

    shallow(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );

    expect(setState).toHaveBeenCalledWith(true);
  });

  it('delete role mapping', (done) => {
    shallow(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{} as any}
        params={{} as any}
        config={{} as any}
      />
    );
    const deleteFunc = useDeleteConfirmState.mock.calls[0][0];

    deleteFunc();

    process.nextTick(() => {
      expect(updateRoleMapping).toBeCalled();
      done();
    });
  });

  it('should capture error by console.log if error occurred while deleting role mapping', (done) => {
    (updateRoleMapping as jest.Mock).mockImplementationOnce(() => {
      throw new Error();
    });
    const spy = jest.spyOn(console, 'log').mockImplementationOnce(() => {});
    render(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{ navigation: { ui: { HeaderControl: {} } } } as any}
        params={{} as any}
        config={{} as any}
      />
    );
    const deleteFunc = useDeleteConfirmState.mock.calls[0][0];

    deleteFunc();

    process.nextTick(() => {
      expect(spy).toBeCalled();
      done();
    });
  });

  it('delete role', () => {
    const component = mount(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{ navigation: { ui: { HeaderControl: {} } } } as any}
        params={{} as any}
        config={{} as any}
      />
    );
    component.find('[data-test-subj="delete"]').first().simulate('click');

    expect(requestDeleteRoles).toBeCalled();
  });

  it('error occurred while deleting the role', () => {
    (requestDeleteRoles as jest.Mock).mockImplementationOnce(() => {
      throw new Error();
    });
    const component = mount(
      <RoleView
        roleName={sampleRole}
        prevAction=""
        buildBreadcrumbs={buildBreadcrumbs}
        coreStart={mockCoreStart as any}
        depsStart={{ navigation: { ui: { HeaderControl: {} } } } as any}
        params={{} as any}
        config={{} as any}
      />
    );
    component.find('[data-test-subj="delete"]').first().simulate('click');
    expect(createUnknownErrorToast).toBeCalled();
  });
});

describe('RoleView base on Multitenancy', () => {
  const mockRoleIndexPermission = [
    {
      index_patterns: ['*'],
      dls: '',
      fls: [],
      masked_fields: [],
      allowed_actions: [],
    },
  ];

  const mockRoleTenantPermission = {
    tenant_patterns: ['dummy'],
    permissionType: TenantPermissionType.Read,
  };

  beforeEach(() => {
    (transformRoleIndexPermissions as jest.Mock).mockResolvedValue(mockRoleIndexPermission);
    (transformRoleTenantPermissions as jest.Mock).mockResolvedValue(mockRoleTenantPermission);
  });

  const testScenarios = [
    {
      description: 'When multitenancy is enabled in both config and dashboards',
      configEnabled: true,
      dashboardsEnabled: true,
      shouldRenderTenantsPanel: true,
    },
    {
      description: 'When multitenancy is disabled in config and enabled in dashboards',
      configEnabled: false,
      dashboardsEnabled: true,
      shouldRenderTenantsPanel: false,
    },
    {
      description: 'When multitenancy is disabled in both config and dashboards',
      configEnabled: false,
      dashboardsEnabled: false,
      shouldRenderTenantsPanel: false,
    },
    {
      description: 'When multitenancy is enabled in config and disabled in dashboards',
      configEnabled: true,
      dashboardsEnabled: false,
      shouldRenderTenantsPanel: false,
    },
  ] as const;

  it.each(testScenarios)(
    '$description → should render TenantsPanel: $shouldRenderTenantsPanel',
    async function ({ configEnabled, dashboardsEnabled, shouldRenderTenantsPanel }) {
      // arrange
      const mockConfig = { multitenancy: { enabled: configEnabled } };
      const mockDashboardsInfo = { multitenancy_enabled: dashboardsEnabled };
      (getDashboardsInfoSafe as jest.Mock).mockResolvedValue(mockDashboardsInfo);

      let wrapper;
      await act(async () => {
        wrapper = mount(
          <RoleView
            roleName={sampleRole}
            prevAction=""
            coreStart={mockCoreStart}
            depsStart={mockDepsStart as any}
            params={{}}
            config={mockConfig}
          />
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      wrapper.update();
      expect(wrapper.find(TenantsPanel).exists()).toBe(shouldRenderTenantsPanel);
    }
  );

  it('should handle error when fetching dashboards info', async () => {
    (getDashboardsInfoSafe as jest.Mock).mockRejectedValue(new Error());

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementationOnce(() => {});

    let wrapper;
    await act(async () => {
      wrapper = mount(
        <RoleView
          roleName={sampleRole}
          prevAction=""
          coreStart={mockCoreStart}
          depsStart={mockDepsStart as any}
          params={{}}
          config={{} as any}
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    wrapper.update();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

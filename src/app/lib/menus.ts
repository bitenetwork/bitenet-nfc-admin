export type MenuEntity = {
  id: number;
  menuType: MenuType;
  icon: string;
  name: string;
  path?: string;
  children?: MenuEntity[];
};

export enum MenuType {
  GROUP = "GROUP",
  PAGE = "PAGE",
}

export const menus: MenuEntity[] = [
  {
    id: 1,
    menuType: MenuType.PAGE,
    icon: "DashboardOutlined",
    name: "Dashboard",
    path: "dashboard",
  },
  {
    id: 2,
    menuType: MenuType.GROUP,
    icon: "CompassOutlined",
    name: "Restaurant",
    children: [
      {
        id: 20,
        menuType: MenuType.PAGE,
        icon: "LineChartOutlined",
        name: "Dashboard",
        path: "restaurant/dashboard",
      },
      {
        id: 21,
        menuType: MenuType.PAGE,
        icon: "CrownOutlined",
        name: "Brand",
        path: "restaurant/brand",
      },
      {
        id: 22,
        menuType: MenuType.PAGE,
        icon: "BankOutlined",
        name: "Restaurant",
        path: "restaurant/restaurant",
      },
      {
        id: 23,
        menuType: MenuType.PAGE,
        icon: "CarOutlined",
        name: "Restaurant User",
        path: "restaurant/restaurant-user",
      },
      {
        id: 24,
        menuType: MenuType.PAGE,
        icon: "BarcodeOutlined",
        name: "Restaurant NFC",
        path: "restaurant/restaurant-nfc",
      },
      {
        id: 25,
        menuType: MenuType.PAGE,
        icon: "MoneyCollectOutlined",
        name: "Recharge",
        path: "account/recharge",
      },
      {
        id: 26,
        menuType: MenuType.PAGE,
        icon: "DollarOutlined",
        name: "$BITE",
        path: "account/points",
      },
      {
        id: 27,
        menuType: MenuType.PAGE,
        icon: "BranchesOutlined",
        name: "Cuisine Type",
        path: "restaurant/cuisine-type",
      },
    ],
  },
  {
    id: 3,
    menuType: MenuType.GROUP,
    icon: "SolutionOutlined",
    name: "Membership",
    children: [
      {
        id: 31,
        menuType: MenuType.PAGE,
        icon: "UserOutlined",
        name: "Member",
        path: "membership/member",
      },
      {
        id: 32,
        menuType: MenuType.PAGE,
        icon: "SendOutlined",
        name: "Notification",
        path: "membership/notification",
      },
      {
        id: 33,
        menuType: MenuType.PAGE,
        icon: "MessageOutlined",
        name: "SMS Record",
        path: "sms-push-record",
      },
    ],
  },
  {
    id: 4,
    menuType: MenuType.GROUP,
    icon: "ToolOutlined",
    name: "System",
    children: [
      {
        id: 41,
        menuType: MenuType.PAGE,
        icon: "RobotOutlined",
        name: "Admin User",
        path: "system/sys-user",
      },
      {
        id: 42,
        menuType: MenuType.PAGE,
        icon: "SettingOutlined",
        name: "Global Config",
        path: "system/global-config",
      },
    ],
  },
];

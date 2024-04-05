"use client";
import React, { useState } from "react";
import { PoweroffOutlined } from "@ant-design/icons";
import * as icons from "@ant-design/icons";
import { Button, Flex, Layout, Menu, Result, Tooltip, theme } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuEntity, menus, MenuType } from "~/app/lib/menus";
import { useIsClient } from "@uidotdev/usehooks";

const { Header, Content, Footer, Sider } = Layout;
const basePath = process.env.NODE_ENV === "production" ? "/api" : "";

export default function ConsoleLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  const isClient = useIsClient();
  if (!isClient) {
    return <></>;
  }
  const token = localStorage.getItem("NFC_TOKEN");
  return token ? <MainPage children={children} /> : <Page403 />;
}

function MainPage({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const router = useRouter();
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div className="demo-logo-vertical">Bitenet Admin</div>
        <DynamicMenu data={menus} basePath={basePath} />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <Flex
            style={{ height: "100%", paddingRight: "20px" }}
            justify="flex-end"
            align="center"
          >
            <Tooltip title="Logout">
              <Button
                shape="circle"
                icon={<PoweroffOutlined />}
                danger
                onClick={() => {
                  localStorage.removeItem("NFC_TOKEN");
                  router.push(
                    (process.env.NODE_ENV === "production" ? "/api" : "") +
                      "/login",
                  );
                }}
              ></Button>
            </Tooltip>
          </Flex>
        </Header>
        <Content style={{ margin: "0 16px" }}>{children}</Content>
        <Footer style={{ textAlign: "center" }}>Bitenet Admin ©2024</Footer>
      </Layout>
    </Layout>
  );
}

function Page403() {
  const router = useRouter();
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header></Header>
      <Content style={{ height: "100%" }}>
        <Flex
          vertical
          style={{ height: "100%" }}
          justify="center"
          align="center"
        >
          <Result
            status="403"
            title="403"
            subTitle="Sorry, you are not authorized to access this page."
            extra={
              <Button
                type="primary"
                onClick={() => {
                  router.push(
                    (process.env.NODE_ENV === "production" ? "/api" : "") +
                      "/login",
                  );
                }}
              >
                Go Login
              </Button>
            }
          />
        </Flex>
      </Content>
      <Footer style={{ textAlign: "center" }}>Bitenet Admin ©2024</Footer>
    </Layout>
  );
}

function DynamicMenu({
  data,
  basePath,
}: {
  data: MenuEntity[];
  basePath: string;
}) {
  return (
    <Menu theme="dark" defaultSelectedKeys={["1"]} mode="inline">
      {data.map(({ id, menuType, icon, name, path, children }) => {
        if (menuType === MenuType.GROUP) {
          return (
            <Menu.SubMenu
              key={id}
              icon={<Icon type={icon} />}
              title={name}
              children={
                children &&
                children.map((child) => {
                  return (
                    <Menu.Item key={child.id} icon={<Icon type={child.icon} />}>
                      <Link href={`${basePath}/${child.path}`}>
                        {child.name}
                      </Link>
                    </Menu.Item>
                  );
                })
              }
            ></Menu.SubMenu>
          );
        } else {
          return (
            <Menu.Item key={id} icon={<Icon type={icon} />}>
              <Link href={`${basePath}/${path}`}>{name}</Link>
            </Menu.Item>
          );
        }
      })}
    </Menu>
  );
}

function Icon({ type }: { type: string }) {
  const antIcon: { [key: string]: any } = icons;
  const IconComponent = antIcon[type];
  return <IconComponent />;
}

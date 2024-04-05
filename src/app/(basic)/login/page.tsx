"use client";
import React from "react";
import { Form, Input, Button } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

type LoginForm = {
  username: string;
  password: string;
};

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { mutateAsync: auth, isLoading } = api.sysUser.auth.useMutation();
  const onFinish = (loginForm: LoginForm) => {
    auth(loginForm).then((response) => {
      localStorage.setItem("NFC_TOKEN", response.token);
      router.push(
        (process.env.NODE_ENV === "production" ? "/api" : "") + "/dashboard",
      );
      return response;
    });
  };

  // 页面样式
  const pageStyle = {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2d3a4b", // 蓝色背景
  };

  // 表单样式
  const formStyle = {
    width: "300px",
    padding: "20px",
    boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
    borderRadius: "5px",
    backgroundColor: "#fff", // 表单背景色为白色
  };

  return (
    <div style={pageStyle}>
      <Form<LoginForm>
        name="normal_login"
        style={formStyle}
        initialValues={{ remember: true }}
        onFinish={onFinish}
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: "Please input your Username!" }]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="Username"
            disabled={isLoading}
          />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[{ required: true, message: "Please input your Password!" }]}
        >
          <Input
            prefix={<LockOutlined />}
            type="password"
            placeholder="Password"
            disabled={isLoading}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={isLoading}>
            Log in
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default LoginPage;

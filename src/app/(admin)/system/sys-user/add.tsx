import React from "react";
import { Button, Col, Drawer, Form, Input, Row, Space } from "antd";
import { type CreateSysUserInput } from "~/trpc/types";
import { api } from "~/trpc/react";
import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";

interface Prop {
  open: boolean;
  onClose: () => void;
}

export default function AddSysUser({ open, onClose }: Prop) {
  const [form] = Form.useForm();

  const { mutateAsync: createSysUser, isLoading } =
    api.sysUser.createSysUser.useMutation();

  const onFinish = (inputs: CreateSysUserInput) => {
    createSysUser(inputs)
      .then(onClose)
      .then(() => form.resetFields());
  };

  return (
    <>
      <Drawer
        title="New account"
        width={360}
        onClose={onClose}
        open={open}
        styles={{
          body: {
            paddingBottom: 80,
          },
        }}
        extra={
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => form.submit()}
              type="primary"
              disabled={isLoading}
            >
              Submit
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="username"
                label="Username"
                rules={[{ required: true, message: "Please enter username" }]}
              >
                <Input placeholder="Please enter username" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: "Please enter password" }]}
              >
                <Input.Password
                  placeholder="Please enter password"
                  iconRender={(visible) =>
                    visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                rules={[
                  { required: true, message: "Please enter password confirm" },
                ]}
              >
                <Input.Password
                  placeholder="Please enter password confirm"
                  iconRender={(visible) =>
                    visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter name" }]}
              >
                <Input placeholder="Please enter name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="Please enter phone" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="mail" label="Email">
                <Input placeholder="Please enter Email" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remark" label="Remark">
                <Input.TextArea rows={4} placeholder="Please enter remark" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

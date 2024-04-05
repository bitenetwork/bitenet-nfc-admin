import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Space,
  Switch,
} from "antd";
import { type UpdateSysUserInput } from "~/trpc/types";
import { api } from "~/trpc/react";
import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";

interface Prop {
  id?: number;
  open: boolean;
  onClose: () => void;
}

export default function EditSysUser({ id, open, onClose }: Prop) {
  const [form] = Form.useForm();
  const [modifyPassword, setModifyPassword] = useState<boolean>(false);

  const { mutateAsync: updateSysUser, isLoading } =
    api.sysUser.updateSysUser.useMutation();

  const onFinish = (data: UpdateSysUserInput) => {
    if (id) {
      updateSysUser({ id, data })
        .then(onClose)
        .then(() => form.resetFields());
    }
  };

  const utils = api.useUtils();
  useEffect(() => {
    setModifyPassword(false);
    if (id) {
      utils.sysUser.findSysUserById
        .fetch({ id })
        .then((data) => form.setFieldsValue(data));
    }
  }, [id, open]);

  return (
    <>
      <Drawer
        title="Edit account"
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
                <Input placeholder="Please enter username" disabled />
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
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="enabled" label="Enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Card
            title="Modify Password"
            extra={
              <Switch
                checked={modifyPassword}
                onChange={(input) => setModifyPassword(input)}
              />
            }
            style={{ width: 300 }}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    {
                      required: modifyPassword,
                      message: "Please enter password",
                    },
                  ]}
                >
                  <Input.Password
                    placeholder="Please enter password"
                    disabled={!modifyPassword}
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
                    {
                      required: modifyPassword,
                      message: "Please enter password confirm",
                    },
                  ]}
                >
                  <Input.Password
                    placeholder="Please enter password confirm"
                    disabled={!modifyPassword}
                    iconRender={(visible) =>
                      visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Form>
      </Drawer>
    </>
  );
}

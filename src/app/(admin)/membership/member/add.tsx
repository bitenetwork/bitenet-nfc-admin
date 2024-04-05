import React from "react";
import { Button, Col, Drawer, Form, Input, Row, Space } from "antd";
import { api } from "~/trpc/react";
import { CreateMemberInputs } from "~/trpc/admin/membership/type";

interface Prop {
  open: boolean;
  onClose: () => void;
}

export default function AddMember({ open, onClose }: Prop) {
  const [form] = Form.useForm();

  const { mutateAsync: createMember, isLoading } =
    api.member.createMember.useMutation();

  const onFinish = (inputs: CreateMemberInputs) => {
    createMember(inputs)
      .then(onClose)
      .then(() => form.resetFields());
  };

  return (
    <>
      <Drawer
        title="New Member"
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
              <Form.Item name="phoneAreaCode" label="Phone Area Code">
                <Input placeholder="Please enter phone area code" />
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
              <Form.Item
                name="account"
                label="Account"
                rules={[{ required: true, message: "Please enter account" }]}
              >
                <Input placeholder="Please enter account" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="nickname"
                label="Nickname"
                rules={[{ required: true, message: "Please enter nickname" }]}
              >
                <Input placeholder="Please enter nickname" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

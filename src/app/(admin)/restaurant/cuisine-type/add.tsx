import React from "react";
import { Button, Col, Drawer, Form, Input, Row, Space } from "antd";
import { api } from "~/trpc/react";
import { CuisineTypeCreateInputs } from "~/trpc/admin/restaurant/types";

interface Prop {
  open: boolean;
  onClose: () => void;
}

export default function AddCuisineType({ open, onClose }: Prop) {
  const [form] = Form.useForm();

  const { mutateAsync: createCuisineType, isLoading } =
    api.cuisineType.createCuisineType.useMutation();

  const onFinish = (inputs: CuisineTypeCreateInputs) => {
    createCuisineType(inputs)
      .then(onClose)
      .then(() => form.resetFields());
  };

  return (
    <>
      <Drawer
        title="New Cuisine Type"
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
                name="cuisineTypeName"
                label="Cuisine Type Name(CN)"
                rules={[
                  {
                    required: true,
                    message: "Please enter Cuisine Type Name(CN)",
                  },
                ]}
              >
                <Input placeholder="Please enter Cuisine Type Name(CN)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="cuisineTypeNameEn"
                label="Cuisine Type Name(EN)"
                rules={[
                  {
                    required: true,
                    message: "Please enter Cuisine Type Name(EN)",
                  },
                ]}
              >
                <Input placeholder="Please enter Cuisine Type Name(EN)" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

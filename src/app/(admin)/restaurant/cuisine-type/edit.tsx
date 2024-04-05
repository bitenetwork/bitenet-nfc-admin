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
import { api } from "~/trpc/react";
import { CuisineTypeUpdateInputs } from "~/trpc/admin/restaurant/types";

interface Prop {
  id?: number;
  open: boolean;
  onClose: () => void;
}

export default function EditCuisineType({ id, open, onClose }: Prop) {
  const [form] = Form.useForm();

  const { mutateAsync: updateCuisineType, isLoading } =
    api.cuisineType.updateCuisineType.useMutation();

  const onFinish = (data: CuisineTypeUpdateInputs) => {
    if (id) {
      updateCuisineType({ id, data })
        .then(onClose)
        .then(() => form.resetFields());
    }
  };

  const utils = api.useUtils();
  useEffect(() => {
    if (id) {
      utils.cuisineType.findCuisineType
        .fetch({ id })
        .then((data) => form.setFieldsValue(data));
    }
  }, [id, open]);

  return (
    <>
      <Drawer
        title="Edit Cuisine Type"
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

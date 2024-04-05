import React, { useState } from "react";
import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Space,
  Select,
  DatePicker,
  Upload,
  message,
  InputNumber,
} from "antd";
import type { UploadChangeParam } from "antd/es/upload";
import type { RcFile, UploadFile, UploadProps } from "antd/es/upload/interface";
import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { type CreateBrandInputs } from "~/trpc/admin/restaurant/types";
import { api } from "~/trpc/react";
import { getUploadUrl } from "~/trpc/shared";
import { BrandLevelType } from "@prisma/client";

interface Prop {
  open: boolean;
  onClose: () => void;
}

export default function AddBrand({ open, onClose }: Prop) {
  const { Option } = Select;
  const [form] = Form.useForm();

  const UPLOAD_URL = getUploadUrl();

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();

  const { mutateAsync: createBrand, isLoading } =
    api.brand.createBrand.useMutation();

  const onFinish = (inputs: CreateBrandInputs) => {
    if (inputs.levelType !== "EXPIRED" && !inputs.expiredDate) {
      message.error("Please select expired date");
      return;
    }
    createBrand(inputs)
      .then(onClose)
      .then(() => form.resetFields());
  };

  const beforeUpload = (file: RcFile) => {
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
    if (!isJpgOrPng) {
      message.error("You can only upload JPG/PNG file!");
    }
    const isLt2M = file.size / 1024 / 1024 < 5;
    if (!isLt2M) {
      message.error("Image must smaller than 5MB!");
    }
    return isJpgOrPng && isLt2M;
  };

  const handleChange: UploadProps["onChange"] = (
    info: UploadChangeParam<UploadFile>,
  ) => {
    if (info.file.status === "uploading") {
      setLoading(true);
      return;
    }
    if (info.file.status === "done") {
      const fileUrl = info.file.response.fileUrl;
      setLoading(false);
      setImageUrl(fileUrl);
      form.setFieldsValue({ logo: fileUrl });
    }
  };

  const uploadButton = (
    <button style={{ border: 0, background: "none" }} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </button>
  );

  const levelOptions = Object.keys(BrandLevelType).map((key) => ({
    value: key,
    label: key,
  }));

  return (
    <>
      <Drawer
        title="Create New Brand"
        width={720}
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
            <Col span={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter brand name" }]}
              >
                <Input placeholder="Please enter brand name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="en_name"
                label="English Name"
                rules={[
                  {
                    required: true,
                    message: "Please enter brand english name",
                  },
                ]}
              >
                <Input placeholder="Please enter brand english name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="levelType"
                label="Level Type"
                rules={[
                  { required: true, message: "Please select level type" },
                ]}
              >
                <Select placeholder="Please select level type">
                  {levelOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiredDate" label="Expired Date">
                <DatePicker
                  placeholder="Please select expiration date"
                  format="YYYY-MM-DD"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contacts" label="Contacts">
                <Input placeholder="Please enter contacts" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactsWay" label="Contacts Way">
                <Input placeholder="Please enter contacts way" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sort" label="Sort">
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  precision={0}
                  placeholder="Please enter sort,in descending order of size"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logo" label="Logo">
                <Upload
                  name="file"
                  listType="picture-card"
                  className="avatar-uploader"
                  showUploadList={false}
                  action={UPLOAD_URL}
                  beforeUpload={beforeUpload}
                  onChange={handleChange}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt="avatar" />
                  ) : (
                    uploadButton
                  )}
                </Upload>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="Description">
                <Input.TextArea
                  rows={4}
                  placeholder="Please enter description"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="en_description" label="English Description">
                <Input.TextArea
                  rows={4}
                  placeholder="Please enter english description"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

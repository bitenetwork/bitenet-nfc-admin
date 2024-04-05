import React, { useState, useEffect } from "react";
import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Space,
  Select,
  Radio,
  Upload,
  message,
  RadioChangeEvent,
  Alert,
} from "antd";
import { type CreateRestaurantUserInputs } from "~/trpc/admin/restaurant/types";
import { api } from "~/trpc/react";
import type { UploadChangeParam } from "antd/es/upload";
import type { RcFile, UploadFile, UploadProps } from "antd/es/upload/interface";
import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { getUploadUrl } from "~/trpc/shared";

interface Prop {
  open: boolean;
  onClose: () => void;
}

export default function AddRestaurantUser({ open, onClose }: Prop) {
  const { Option } = Select;
  const [form] = Form.useForm();
  const UPLOAD_URL = getUploadUrl();

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();

  const { mutateAsync: createRestaurantUser, isLoading } =
    api.restaurantUser.createRestaurantUser.useMutation();

  const onFinish = (inputs: CreateRestaurantUserInputs) => {
    createRestaurantUser(inputs)
      .then(onClose)
      .then(() => form.resetFields());
  };

  const [radioValue, setRadioValue] = useState(true);
  const [inputVisible, setInputVisible] = useState(false);

  useEffect(() => {
    if (radioValue) {
      setInputVisible(false);
    } else {
      setInputVisible(true);
    }
  }, [radioValue]);

  const onRadioChange = (e: RadioChangeEvent) => {
    setRadioValue(e.target.value);
  };

  const [options, setOptions] = useState<
    { value: number; label: string; brandId: number }[]
  >([]);
  const { data } = api.restaurant.listRestaurant.useQuery({});
  useEffect(() => {
    if (data) {
      setOptions(
        data.map((item) => ({
          value: item.id,
          label: item.name,
          brandId: item.brandId,
        })),
      );
    }
  }, [data]);

  const handleSelectChange = (value: string | number) => {
    const selectedOption = options.find((option) => option.value === value);
    if (selectedOption) {
      form.setFieldsValue({
        brandId: Number(selectedOption.brandId),
      });
    }
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
      form.setFieldsValue({ avatar: fileUrl });
    }
  };

  const uploadButton = (
    <button style={{ border: 0, background: "none" }} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8, width: "100px" }}>Please select an image</div>
    </button>
  );

  return (
    <>
      <Drawer
        title="Create New Restaurant User"
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
        <Alert
          message="The default password for newly created restaurant users is 123456."
          type="info"
          showIcon
          style={{ marginBottom: "16px" }}
        />
        <Form
          layout="vertical"
          form={form}
          onFinish={onFinish}
          initialValues={{ isEnabled: true }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="userName"
                label="User name"
                rules={[{ required: true, message: "Please enter user name" }]}
              >
                <Input placeholder="Please enter user name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phoneAreaCode"
                label="Phone Area Code"
                rules={[
                  { required: true, message: "Please enter phone area code" },
                ]}
              >
                <Input placeholder="Please enter phone area code" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone"
                rules={[{ required: true, message: "Please enter phone" }]}
              >
                <Input placeholder="Please enter phone" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="account"
                label="Account"
                rules={[{ required: true, message: "Please enter account" }]}
              >
                <Input placeholder="Please enter account" />
              </Form.Item>
            </Col>
          </Row>
          {/* <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: "Please enter password" }]}
              >
                <Input placeholder="Please enter password" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                rules={[
                  { required: true, message: "Please enter password confirm" },
                ]}
              >
                <Input placeholder="Please enter password confirm" />
              </Form.Item>
            </Col>
          </Row> */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="restaurantId"
                label="Restaurant"
                rules={[
                  { required: true, message: "Please select restaurant" },
                ]}
              >
                <Select
                  showSearch
                  placeholder="Please select restaurant"
                  optionFilterProp="children"
                  filterOption={(
                    input: string,
                    option?: { children: string },
                  ) =>
                    (option?.children ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={handleSelectChange}
                >
                  {options.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nickname" label="Nickname">
                <Input placeholder="Please enter nickname" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gender" label="Gender">
                <Select placeholder="Please select gender">
                  <Option key="MALE" value="MALE">
                    MALE
                  </Option>
                  <Option key="FEMALE" value="FEMALE">
                    FEMALE
                  </Option>
                  <Option key="UNKNOW" value="UNKNOWN">
                    UNKNOWN
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="avatar" label="Avatar">
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
            {/* <Col span={12}>
              <Form.Item name="isBrandMain" label="Is Brand Main">
                <Radio.Group>
                  <Radio value={true}>Yes</Radio>
                  <Radio value={false}>No</Radio>
                </Radio.Group>
              </Form.Item>
            </Col> */}
            <Col span={12}>
              <Form.Item name="isEnabled" label="Is Enabled">
                <Radio.Group onChange={onRadioChange}>
                  <Radio value={true}>Enabled</Radio>
                  <Radio value={false}>Disabled</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            {inputVisible && (
              <Col span={24}>
                <Form.Item name="disabledReason" label="Disabled Reason">
                  <Input.TextArea
                    rows={4}
                    placeholder="Please enter disabled Reason"
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
          <Form.Item name="brandId" noStyle>
            <Input type="hidden" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}

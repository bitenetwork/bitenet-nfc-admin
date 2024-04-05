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
  Upload,
  message,
  InputNumber,
  Radio,
} from "antd";
import { type CreateRestaurantInputs } from "~/trpc/admin/restaurant/types";
import type { UploadChangeParam } from "antd/es/upload";
import type { RcFile, UploadFile, UploadProps } from "antd/es/upload/interface";
import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { getUploadUrl } from "~/trpc/shared";
import { api } from "~/trpc/react";

interface Prop {
  id?: number;
  open: boolean;
  onClose: () => void;
}

export default function EditRestaurant({ id, open, onClose }: Prop) {
  const UPLOAD_URL = getUploadUrl();
  const { Option } = Select;
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();

  const { mutateAsync: updateRestaurant, isLoading } =
    api.restaurant.updateRestaurant.useMutation();

  const onFinish = (data: CreateRestaurantInputs) => {
    if (id) {
      updateRestaurant({ id, data })
        .then(onClose)
        .then(() => form.resetFields());
    }
  };

  const utils = api.useUtils();
  useEffect(() => {
    if (id) {
      utils.restaurant.findRestaurantById.fetch({ id }).then((data) => {
        form.setFieldsValue(data);
        setImageUrl(data?.cover || "");
      });
    }
  }, [id, open]);

  const [brandOptions, setBrandOptions] = useState<
    { value: number; label: string }[]
  >([]);
  const { data: brandData } = api.brand.listBrand.useQuery({});
  useEffect(() => {
    if (brandData) {
      setBrandOptions(
        brandData.map((item) => ({ value: item.id, label: item.name })),
      );
    }
  }, [brandData]);

  const [regionOptions, setRegionOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const { data: regionData } =
    api.restaurantRegion.listRestaurantRegion.useQuery({});
  useEffect(() => {
    if (regionData) {
      setRegionOptions(
        regionData.map((item) => ({ value: item.code, label: item.name })),
      );
    }
  }, [regionData]);

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
      form.setFieldsValue({ cover: fileUrl });
    }
  };

  const uploadButton = (
    <button style={{ border: 0, background: "none" }} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </button>
  );

  const { data: cuisineTypeList } = api.cuisineType.listCuisineType.useQuery();

  return (
    <>
      <Drawer
        title="Edit Restaurant"
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
        <Form
          layout="vertical"
          form={form}
          onFinish={onFinish}
          initialValues={{ isMainStore: false }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[
                  { required: true, message: "Please enter restaurant name" },
                ]}
              >
                <Input placeholder="Please enter restaurant name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="en_name"
                label="English Name"
                rules={[
                  {
                    required: true,
                    message: "Please enter restaurant english name",
                  },
                ]}
              >
                <Input placeholder="Please enter restaurant english name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="Code">
                <Input disabled={true} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="indexCode" label="Index Code">
                <Input disabled={true} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="brandId"
                label="Brand"
                rules={[{ required: true, message: "Please select brand" }]}
              >
                <Select
                  disabled={true}
                  showSearch
                  placeholder="Please select brand"
                  filterOption={(
                    input: string,
                    brandOptions?: { children: string },
                  ) =>
                    (brandOptions?.children ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {brandOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="regionCode"
                label="Region"
                rules={[{ required: true, message: "Please select region" }]}
              >
                <Select
                  showSearch
                  placeholder="Please select region"
                  filterOption={(
                    input: string,
                    regionData?: { children: string },
                  ) =>
                    (regionData?.children ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {regionOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="address"
                label="Address"
                rules={[
                  {
                    required: true,
                    message: "Please enter address",
                  },
                ]}
              >
                <Input placeholder="Please enter address" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="en_address"
                label="En_Address"
                rules={[
                  {
                    required: true,
                    message: "Please enter english address",
                  },
                ]}
              >
                <Input placeholder="Please enter english address" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="minimumCharge"
                label="Customer's Minimum Spending"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  precision={2}
                  placeholder="Please enter customer's minimum spending"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contacts"
                label="Contacts"
                rules={[
                  {
                    required: true,
                    message: "Please enter contacts",
                  },
                ]}
              >
                <Input placeholder="Please enter contacts" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contactsWay"
                label="Contacts Way"
                rules={[
                  {
                    required: true,
                    message: "Please enter contacts way",
                  },
                ]}
              >
                <Input placeholder="Please enter contacts way" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cover"
                label="Cover"
                rules={[
                  {
                    required: true,
                    message: "Please upload cover",
                  },
                ]}
              >
                <Upload
                  name="file"
                  listType="picture-card"
                  className="avatar-uploader"
                  showUploadList={false}
                  action={UPLOAD_URL}
                  beforeUpload={beforeUpload}
                  onChange={handleChange}
                >
                  {imageUrl ? <img src={imageUrl} alt="cover" /> : uploadButton}
                </Upload>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="lat" label="Lat">
                <Input style={{ width: "100%" }} disabled={true} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lng" label="Lng">
                <Input style={{ width: "100%" }} disabled={true} />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col span={12}>
              <Form.Item name="isMainStore" label="Is Main Store">
                <Radio.Group>
                  <Radio value={true}>Yes</Radio>
                  <Radio value={false}>No</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cuisineTypeId"
                label="Cuisine Type"
                rules={[
                  { required: true, message: "Please select Cuisine Type" },
                ]}
              >
                <Select
                  options={cuisineTypeList?.map(
                    ({ id, cuisineTypeName, cuisineTypeNameEn }) => ({
                      value: id,
                      label: (
                        <span>
                          {cuisineTypeNameEn}({cuisineTypeName})
                        </span>
                      ),
                    }),
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row></Row>
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

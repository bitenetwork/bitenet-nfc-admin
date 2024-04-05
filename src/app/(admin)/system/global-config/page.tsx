"use client";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Upload,
  UploadProps,
  message,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { getUploadUrl } from "~/trpc/shared";
import { RcFile, UploadListType } from "antd/es/upload/interface";

export default function GlobalConfig() {
  const [form] = Form.useForm();

  const { mutateAsync: updateGlobalConfig, isLoading } =
    api.globalConfig.updateGlobalConfig.useMutation();

  const onFinish = (data: any) => {
    updateGlobalConfig(data).then(() => message.success("Submit Success"));
  };

  const utils = api.useUtils();
  useEffect(() => {
    utils.globalConfig.findGlobalConfig.fetch().then((data) => {
      form.setFieldsValue(data);
      if (data?.nftBackgourndUrl) {
        setImageUrl(data?.nftBackgourndUrl);
        setListType("picture");
      }
    });
  }, []);

  const uploadUrl = getUploadUrl();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();
  const [listType, setListType] = useState<UploadListType>("picture-card");

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

  const handleChange: UploadProps["onChange"] = (info) => {
    if (info.file.status === "uploading") {
      setLoading(true);
      return;
    }
    if (info.file.status === "done") {
      const fileUrl = info.file.response.fileUrl;
      setLoading(false);
      setImageUrl(fileUrl);
      form.setFieldsValue({ nftBackgourndUrl: fileUrl });
      setListType("picture");
    }
  };

  const uploadButton = (
    <button style={{ border: 0, background: "none" }} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </button>
  );

  return (
    <>
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card
          style={{ width: "30%" }}
          title="Global Config"
          extra={
            <Space>
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
                <Form.Item name="id" noStyle>
                  <Input type="hidden" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="pointsName"
                  label="Points Name"
                  rules={[
                    { required: true, message: "Please enter Points Name" },
                  ]}
                >
                  <Input placeholder="Please enter Points Name" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="bonusPointsRangeStart"
                  label="Bonus Points Range Start"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Bonus Points Range Start",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Points Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="bonusPointsRangeEnd"
                  label="Bonus Points Range End"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Bonus Points Range End",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Points Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="resturantSignInCommission"
                  label="Resturant Sign In Commission(%)"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Resturant Sign In Commission",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Resturant Sign In Commission Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="appSignInBonus"
                  label="App Sign In Bouns"
                  rules={[
                    {
                      required: true,
                      message: "Please enter App Sign In Bouns",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Points Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="inviteBonus"
                  label="Member Invite Bouns"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Member Invite Bouns",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Member Invite Bouns" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="pushFeeSms"
                  label="Push Fee SMS"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Push Fee SMS",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Fee Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="pushFeeApp"
                  label="Push Fee APP"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Push Fee APP",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Fee Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="luckyDrawCost"
                  label="Lucky Draw Cost"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Lucky Draw Cost",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Lucky Draw Cost Number" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="signInterval"
                  label="Sign Interval Minutes"
                  rules={[
                    {
                      required: true,
                      message: "Please enter Sign Interval Minutes",
                    },
                  ]}
                >
                  <InputNumber placeholder="Please enter Sign Interval Minutes" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item name="smsExample" label="SMS Example">
                  <TextArea placeholder="Please enter SMS Example" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item name="nftBackgourndUrl" label="NFT Background">
                  <Upload
                    name="file"
                    listType={listType}
                    showUploadList={false}
                    action={uploadUrl}
                    beforeUpload={beforeUpload}
                    onChange={handleChange}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="avatar"
                        style={{ width: "100%" }}
                      />
                    ) : (
                      uploadButton
                    )}
                  </Upload>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      </Space>
    </>
  );
}

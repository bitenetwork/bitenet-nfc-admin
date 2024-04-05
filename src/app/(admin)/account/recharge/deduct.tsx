import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { useEffect } from "react";
import { DeductRechargeInputs } from "~/trpc/admin/account/types";
import { api } from "~/trpc/react";

type Prop = {
  brandId?: number;
  open: boolean;
  onClose: () => void;
};

export default function DeductRecharge({ brandId, open, onClose }: Prop) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({ brandId });
  }, [brandId, open]);

  const { mutateAsync: deductRecharge, isLoading } =
    api.restaurantWalletPreRecharge.deductRecharge.useMutation();

  const onFinish = (inputs: DeductRechargeInputs) => {
    deductRecharge(inputs)
      .then(onClose)
      .then(() => form.resetFields());
  };

  const handleClose = () => {
    onClose();
    form.resetFields();
  };

  return (
    <>
      <Drawer
        title="Do Deduct"
        width={360}
        onClose={handleClose}
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
          hideRequiredMark
          form={form}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="brandId" noStyle>
                <Input type="hidden" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="amount"
                label="Amount"
                rules={[{ required: true, message: "Please enter amount" }]}
              >
                <InputNumber
                  placeholder="Please enter amount"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="remark"
                label="Remark (Chiness)"
                rules={[
                  { required: true, message: "Please enter Remark (Chiness)" },
                ]}
              >
                <TextArea placeholder="Please enter remark (Chiness)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="remarkEn"
                label="Remark (English)"
                rules={[
                  { required: true, message: "Please enter Remark (English)" },
                ]}
              >
                <TextArea placeholder="Please enter remark (English)" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

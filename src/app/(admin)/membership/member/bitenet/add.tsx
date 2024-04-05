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
import { AddMemberRechargeInputs } from "~/trpc/admin/membership/type";
import { api } from "~/trpc/react";

type Prop = {
  memberId?: number;
  open: boolean;
  onClose: () => void;
};

export default function AddRecharge({ memberId, open, onClose }: Prop) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({ memberId });
  }, [memberId, open]);

  const { mutateAsync: addRecharge, isLoading } =
    api.member.addRecharge.useMutation();

  const onFinish = (inputs: AddMemberRechargeInputs) => {
    addRecharge(inputs)
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
        title="Do Recharge"
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
              <Form.Item name="memberId" noStyle>
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
                  { required: true, message: "Please enter chiness remark" },
                ]}
              >
                <TextArea placeholder="Please enter chiness remark" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="remarkEn"
                label="Remark (English)"
                rules={[
                  { required: true, message: "Please enter english remark" },
                ]}
              >
                <TextArea placeholder="Please enter english remark" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

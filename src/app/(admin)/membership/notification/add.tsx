import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Col,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Space,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "~/trpc/react";
import MemberPage, { useMemberPage } from "./member";
import {
  MemberDispatchContext,
  MemberIdActionTypes,
  MemberIdContext,
} from "./MemberIdContext";

interface Prop {
  id?: number;
  open: boolean;
  onClose: () => void;
}

export default function AddNotification({ id, open, onClose }: Prop) {
  const [locked, setLocked] = useState(false);
  const [form] = Form.useForm();
  form.setFieldsValue({ inSiteMessage: true });

  const memberIds = useContext(MemberIdContext);
  const memberIdDispatch = useContext(MemberDispatchContext);
  const [openModal, setOpenModal] = useState(false);
  const selectedMember = useMemberPage({ memberIds: [0] });
  const memberList = useMemberPage();

  const { mutateAsync: updateNotification, isLoading } = id
    ? api.notitfication.updateNotification.useMutation()
    : api.notitfication.createNotification.useMutation();

  const doClose = () => {
    memberIdDispatch({ type: MemberIdActionTypes.CLEAN, memberId: 0 });
    selectedMember.setQueryOption(() => ({
      page: 1,
      pageSize: 10,
      memberIds: [0],
    }));
    memberList.setQueryOption(() => ({ page: 1, pageSize: 10 }));
    form.resetFields();
    onClose();
  };

  const onFinish = (inputs: any) => {
    if (!inputs.inSiteMessage && !inputs.appPush && !inputs.smsPush) {
      return message.error(
        "Should chose at least one in 'In Site Message', 'APP Push','SMS Push'",
      );
    }
    if (!memberIds || memberIds.length === 0) {
      return message.error("Select at least one member to receive the push");
    }
    if (id) {
      updateNotification({ ...inputs, memberIds, id }).then(doClose);
    } else {
      updateNotification({ ...inputs, memberIds }).then(doClose);
    }
  };

  const utils = api.useUtils();
  useEffect(() => {
    if (id) {
      utils.notitfication.findNotification.fetch({ id }).then((data) => {
        memberIdDispatch({
          type: MemberIdActionTypes.CLEAN,
          memberId: 0,
        });
        for (const memberId of data?.memberIds || []) {
          memberIdDispatch({
            type: MemberIdActionTypes.ADD,
            memberId,
          });
        }
        form.setFieldsValue(data);
        selectedMember.setQueryOption({
          ...selectedMember.queryOption,
          memberIds: data?.memberIds || [],
        });
        setLocked(data?.status !== "DRAFT");
      });
    }
  }, [id, open]);

  return (
    <>
      <Drawer
        title={id ? "Edit Notification" : "New Notification"}
        width={1200}
        onClose={doClose}
        open={open}
        styles={{
          body: {
            paddingBottom: 80,
          },
        }}
        extra={
          <Space>
            <Button onClick={doClose}>Cancel</Button>
            <Button
              onClick={() => form.submit()}
              type="primary"
              disabled={isLoading || locked}
            >
              Submit
            </Button>
          </Space>
        }
      >
        <Space
          direction="vertical"
          size="middle"
          style={{ display: "flex", paddingTop: "10px" }}
        >
          <Form
            disabled={locked}
            layout="vertical"
            form={form}
            onFinish={onFinish}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="title"
                  label="Title"
                  rules={[
                    {
                      required: true,
                      message: "Please enter title",
                    },
                  ]}
                >
                  <Input placeholder="Please enter title" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="context"
                  label="Context"
                  rules={[
                    {
                      required: true,
                      message: "Please enter context",
                    },
                  ]}
                >
                  <Input placeholder="Please enter context" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="remark"
                  label="Remark"
                  rules={[
                    {
                      required: true,
                      message: "Please enter remark",
                    },
                  ]}
                >
                  <Input placeholder="Please enter remark" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={4}>
                <Form.Item
                  name="inSiteMessage"
                  label="In Site Message"
                  valuePropName="checked"
                >
                  <Checkbox />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item
                  name="appPush"
                  label="APP Push"
                  valuePropName="checked"
                >
                  <Checkbox />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item
                  name="smsPush"
                  label="SMS Push"
                  valuePropName="checked"
                >
                  <Checkbox />
                </Form.Item>
              </Col>
              <Col span={12}></Col>
            </Row>
          </Form>
          <Button
            disabled={locked}
            type="primary"
            onClick={() => setOpenModal(true)}
            icon={<PlusOutlined />}
          >
            Add Member
          </Button>
          <MemberPage
            showAction={!locked}
            filter={false}
            editable={false}
            queryOption={selectedMember.queryOption}
            setQueryOption={selectedMember.setQueryOption}
          />
          <Modal
            title="Select Member"
            centered
            open={openModal}
            onOk={() => {
              selectedMember.setQueryOption({
                ...selectedMember.queryOption,
                memberIds,
              });
              setOpenModal(false);
            }}
            onCancel={() => setOpenModal(false)}
            width={1600}
          >
            <MemberPage
              showAction={true}
              filter={true}
              editable={true}
              queryOption={memberList.queryOption}
              setQueryOption={memberList.setQueryOption}
            />
          </Modal>
        </Space>
      </Drawer>
    </>
  );
}

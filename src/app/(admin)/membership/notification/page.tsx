"use client";
import {
  Button,
  Card,
  Flex,
  Form,
  FormProps,
  Input,
  Popconfirm,
  Space,
  Table,
  TablePaginationConfig,
  TableProps,
  Tag,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
} from "@ant-design/icons";
import Column from "antd/es/table/Column";
import { useState } from "react";
import {
  PageMemberNotificationInputs,
  PageMemberNotificationOutputs,
  PageMemberNotificationResult,
} from "~/trpc/admin/membership/type";
import { api } from "~/trpc/react";
import { formateDatetime } from "~/app/lib/utils";
import AddNotification from "./add";
import { MemberIdProvider } from "./MemberIdContext";

export default function NotificationPage() {
  const [queryOption, setQueryOption] = useState<PageMemberNotificationInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.notitfication.pageNotification.useQuery(queryOption);

  const onSearch = (inputs: PageMemberNotificationInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
  };

  const onReset = () => {
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
  };

  const onChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const [openAdd, setOpenAdd] = useState(false);
  const handleAddClose = () => {
    setOpenAdd(false);
    refetch();
  };

  const [notitficationId, setNotitficationId] = useState<number | undefined>();
  const [openEdit, setOpenEdit] = useState(false);
  const handleEditClose = () => {
    setOpenEdit(false);
    setNotitficationId(undefined);
    refetch();
  };
  const editNotification = (id: number) => () => {
    setNotitficationId(id);
    setOpenEdit(true);
  };

  const { mutateAsync: doDeleteNotifycation } =
    api.notitfication.deleteNotification.useMutation();
  const confirmDeleteNotification = (id: number) => () => {
    doDeleteNotifycation({ id }).then(() => refetch());
  };

  const { mutateAsync: doSendNotificaiton } =
    api.notitfication.sendNotification.useMutation();
  const sendNotification = (id: number) => () => {
    doSendNotificaiton({ id }).then(() => refetch());
  };

  return (
    <>
      <MemberIdProvider>
        <AddNotification open={openAdd} onClose={handleAddClose} />
      </MemberIdProvider>
      <MemberIdProvider>
        <AddNotification
          id={notitficationId}
          open={openEdit}
          onClose={handleEditClose}
        />
      </MemberIdProvider>
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <DataFilter
          onSearch={onSearch}
          onReset={onReset}
          onNew={() => setOpenAdd(true)}
        />
        <DataTable
          onChange={onChange}
          data={data}
          isLoading={isLoading}
          queryOption={queryOption}
          onEdit={editNotification}
          onDelete={confirmDeleteNotification}
          onSend={sendNotification}
        />
      </Space>
    </>
  );
}

function DataFilter({
  onSearch,
  onReset,
  onNew,
}: {
  onSearch: FormProps["onFinish"];
  onReset: () => void;
  onNew: () => void;
}) {
  const [form] = Form.useForm<PageMemberNotificationInputs>();

  return (
    <Card
      style={{ width: "100%" }}
      title="Notification"
      extra={
        <Button type="primary" onClick={onNew} icon={<PlusOutlined />}>
          New Notification
        </Button>
      }
    >
      <Form
        form={form}
        layout="inline"
        style={{ maxWidth: "none" }}
        onFinish={onSearch}
      >
        <Flex wrap="wrap" gap="small">
          <Form.Item<PageMemberNotificationInputs> label="Title" name="title">
            <Input placeholder="Title" style={{ width: "230px" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Search
            </Button>
          </Form.Item>
          <Form.Item>
            <Button
              type="default"
              htmlType="button"
              onClick={() => {
                form.resetFields();
                if (onReset) {
                  onReset();
                }
              }}
            >
              Reset
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </Card>
  );
}

function DataTable({
  queryOption,
  isLoading,
  data,
  onEdit,
  onChange,
  onDelete,
  onSend,
}: {
  queryOption: PageMemberNotificationInputs;
  isLoading: boolean;
  data?: PageMemberNotificationResult;
  onChange: TableProps<PageMemberNotificationOutputs>["onChange"];
  onEdit: (id: number) => () => void;
  onDelete: (id: number) => () => void;
  onSend: (id: number) => () => void;
}) {
  return (
    <Table<PageMemberNotificationOutputs>
      dataSource={data?.record ?? []}
      loading={isLoading}
      rowKey={({ id }) => id}
      onChange={onChange}
      scroll={{ y: 800 }}
      pagination={{
        current: queryOption.page,
        position: ["bottomCenter"],
        pageSize: queryOption.pageSize,
        total: data?.totalCount ?? 0,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} items`,
      }}
    >
      <Column width="60px" title="ID" dataIndex="id" />
      <Column title="Title" dataIndex="title" />
      <Column title="Context" dataIndex="context" />
      <Column title="Remark" dataIndex="remark" />
      <Column<PageMemberNotificationOutputs>
        title="In Site Message"
        render={(_, { inSiteMessage }) => (
          <>{inSiteMessage ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>}</>
        )}
      />
      <Column<PageMemberNotificationOutputs>
        title="App Push"
        render={(_, { appPush }) => (
          <>{appPush ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>}</>
        )}
      />
      <Column<PageMemberNotificationOutputs>
        title="SMS Push"
        render={(_, { smsPush }) => (
          <>{smsPush ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>}</>
        )}
      />
      <Column title="Status" dataIndex="status" />
      <Column title="Receiver Count" dataIndex="receiverCount" />
      <Column<PageMemberNotificationOutputs>
        title="Create At"
        render={(_, { createAt }) => formateDatetime(createAt)}
      />
      <Column<PageMemberNotificationOutputs>
        title="Update At"
        render={(_, { updateAt }) => formateDatetime(updateAt)}
      />
      <Column<PageMemberNotificationOutputs>
        width="360px"
        title="Action"
        dataIndex="id"
        render={(_, { id, status }) => (
          <>
            <Flex wrap="wrap" gap="small">
              <Button type="link" icon={<EditOutlined />} onClick={onEdit(id)}>
                Edit
              </Button>
              <Popconfirm
                title="Delete the Noftification"
                description="Are you sure to delete this noftification?"
                okText="Yes"
                cancelText="No"
                onConfirm={onDelete(id)}
              >
                <Button
                  disabled={status !== "DRAFT"}
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                >
                  Delete
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Send the Noftification"
                description="Are you sure to send this noftification?"
                okText="Yes"
                cancelText="No"
                onConfirm={onSend(id)}
              >
                <Button
                  disabled={status !== "DRAFT"}
                  type="link"
                  icon={<SendOutlined />}
                >
                  Publish
                </Button>
              </Popconfirm>
            </Flex>
          </>
        )}
      />
    </Table>
  );
}

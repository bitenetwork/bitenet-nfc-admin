"use client";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import {
  type QuerySysUserInputs,
  type QuerySysUserOutputs,
} from "~/trpc/types";
import {
  Flex,
  Card,
  Button,
  Form,
  Input,
  Space,
  Table,
  type TablePaginationConfig,
  Tag,
  Popconfirm,
} from "antd";
import moment from "moment";
import AddSysUser from "./add";
import EditSysUser from "./edit";

const { Column } = Table;

const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

export default function SysUserPage() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] = useState<QuerySysUserInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.sysUser.querySysUser.useQuery(queryOption);

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: QuerySysUserInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
    refetch();
  };

  const onReset = () => {
    form.resetFields();
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
    refetch();
  };

  const mutation = api.sysUser.deleteSysUser.useMutation();
  const confirmDeleteSysUser = (id: number) => () => {
    mutation.mutateAsync({ id }).then(() => refetch());
  };

  const [openAdd, setOpenAdd] = useState(false);
  const handleAddClose = () => {
    setOpenAdd(false);
    refetch();
  };

  const [openEdit, setOpenEdit] = useState(false);
  const [id, setId] = useState<number>();
  const handleEditClose = () => {
    setOpenEdit(false);
    refetch();
  };

  return (
    <>
      <AddSysUser open={openAdd} onClose={handleAddClose} />
      <EditSysUser id={id} open={openEdit} onClose={handleEditClose} />
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card
          style={{ width: "100%" }}
          title="Admin"
          extra={
            <Button
              type="primary"
              onClick={() => setOpenAdd(true)}
              icon={<PlusOutlined />}
            >
              New account
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
              <Form.Item<QuerySysUserInputs> label="Name" name="name">
                <Input placeholder="Name" style={{ width: "230px" }} />
              </Form.Item>
              <Form.Item<QuerySysUserInputs> label="Username" name="username">
                <Input placeholder="Username" style={{ width: "230px" }} />
              </Form.Item>
              <Form.Item<QuerySysUserInputs> label="Phone" name="phone">
                <Input placeholder="Phone" style={{ width: "230px" }} />
              </Form.Item>
              <Form.Item<QuerySysUserInputs> label="Email" name="mail">
                <Input placeholder="Email" style={{ width: "230px" }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Search
                </Button>
              </Form.Item>
              <Form.Item>
                <Button type="default" htmlType="button" onClick={onReset}>
                  Reset
                </Button>
              </Form.Item>
            </Flex>
          </Form>
        </Card>
        <Table<QuerySysUserOutputs>
          dataSource={data?.record ?? []}
          loading={isLoading}
          rowKey={(record) => `${record.id}`}
          onChange={onPageChange}
          scroll={{ y: 800 }}
          pagination={{
            current: queryOption.page,
            position: ["bottomCenter"],
            pageSize: queryOption.pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
        >
          <Column<QuerySysUserOutputs> width="80px" title="ID" dataIndex="id" />
          <Column<QuerySysUserOutputs> title="Name" dataIndex="name" />
          <Column<QuerySysUserOutputs> title="Username" dataIndex="username" />
          <Column<QuerySysUserOutputs> title="Phone" dataIndex="phone" />
          <Column<QuerySysUserOutputs> title="Email" dataIndex="mail" />
          <Column<QuerySysUserOutputs>
            width="100px"
            title="Enabled"
            dataIndex="enabled"
            render={(_, { enabled }) =>
              enabled ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>
            }
          />
          <Column<QuerySysUserOutputs>
            title="Create At"
            dataIndex="createAt"
            render={formateDatetime}
          />
          <Column<QuerySysUserOutputs>
            title="Update At"
            dataIndex="updateAt"
            render={formateDatetime}
          />
          <Column<QuerySysUserOutputs>
            width="220px"
            title="Action"
            dataIndex="id"
            render={(_, { id }) => (
              <Flex wrap="wrap" gap="small">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setId(id);
                    setOpenEdit(true);
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title="Delete the account"
                  description="Are you sure to delete this account?"
                  okText="Yes"
                  cancelText="No"
                  onConfirm={confirmDeleteSysUser(id)}
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </Flex>
            )}
          />
        </Table>
      </Space>
    </>
  );
}

"use client";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import {
  type QueryBrandInputs,
  type QueryBrandOutputs,
} from "~/trpc/admin/restaurant/types";
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
import AddBrand from "./add";
import EditBrand from "./edit";

const { Column } = Table;

const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

const formateDate = (date: Date) => (date ? moment(date).format("Y-M-D") : "");

export default function BrandPage() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] = useState<QueryBrandInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.brand.queryBrand.useQuery(queryOption);

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: QueryBrandInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
    refetch();
  };

  const onReset = () => {
    form.resetFields();
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
    refetch();
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

  const mutation = api.brand.deleteBrand.useMutation();
  const confirmDeleteBrand = (id: number) => () => {
    mutation.mutateAsync({ id }).then(() => refetch());
  };

  return (
    <>
      <AddBrand open={openAdd} onClose={handleAddClose} />
      <EditBrand id={id} open={openEdit} onClose={handleEditClose} />
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card
          style={{ width: "100%" }}
          title="Brand"
          extra={
            <Button
              type="primary"
              onClick={() => setOpenAdd(true)}
              icon={<PlusOutlined />}
            >
              New Brand
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
              <Form.Item<QueryBrandInputs> label="Name" name="name">
                <Input
                  placeholder="Please enter name"
                  style={{ width: "230px" }}
                />
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
        <Table<QueryBrandOutputs>
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
          <Column<QueryBrandOutputs> width="80px" title="ID" dataIndex="id" />
          <Column<QueryBrandOutputs> title="Name" dataIndex="name" />
          <Column<QueryBrandOutputs> title="EN_Name" dataIndex="en_name" />
          <Column<QueryBrandOutputs> title="Type" dataIndex="levelType" />
          <Column<QueryBrandOutputs> title="Contacts" dataIndex="contacts" />
          <Column<QueryBrandOutputs>
            title="Contacts Way"
            dataIndex="contactsWay"
          />
          <Column<QueryBrandOutputs>
            title="Logo"
            dataIndex="logo"
            render={(logo) => (
              <img
                src={logo}
                alt={`Logo`}
                style={{ width: "50px", height: "50px" }}
              />
            )}
          />
          <Column<QueryBrandOutputs>
            title="Expired Date"
            dataIndex="expiredDate"
            render={formateDate}
          />
          <Column<QueryBrandOutputs>
            title="Create At"
            dataIndex="createAt"
            render={formateDatetime}
          />
          <Column<QueryBrandOutputs>
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
                  title="Delete the brand"
                  description="Are you sure to delete this brand?"
                  okText="Yes"
                  cancelText="No"
                  onConfirm={confirmDeleteBrand(id)}
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

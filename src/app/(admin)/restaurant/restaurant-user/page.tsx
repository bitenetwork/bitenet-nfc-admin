"use client";
import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import {
  type QueryRestaurantUserInputs,
  type QueryRestaurantUserOutputs,
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
  Select,
} from "antd";
import moment from "moment";
import AddRestaurantUser from "./add";
import EditRestaurantUser from "./edit";

const { Column } = Table;
const { Option } = Select;

const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

export default function RestaurantUserPage() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] = useState<QueryRestaurantUserInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.restaurantUser.queryRestaurantUser.useQuery(queryOption);

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: QueryRestaurantUserInputs) => {
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

  const mutation = api.restaurantUser.deleteRestaurantUser.useMutation();
  const confirmDeleteRestaurantUser = (id: number) => () => {
    mutation.mutateAsync({ id }).then(() => refetch());
  };

  const [options, setOptions] = useState<{ value: number; label: string }[]>(
    [],
  );
  const { data: restaurantData } = api.restaurant.listRestaurant.useQuery({});
  useEffect(() => {
    if (restaurantData) {
      setOptions(
        restaurantData.map((item) => ({
          value: item.id,
          label: item.name,
        })),
      );
    }
  }, [restaurantData]);

  return (
    <>
      <AddRestaurantUser open={openAdd} onClose={handleAddClose} />
      <EditRestaurantUser id={id} open={openEdit} onClose={handleEditClose} />
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card
          style={{ width: "100%" }}
          title="Restaurant User"
          extra={
            <Button
              type="primary"
              onClick={() => setOpenAdd(true)}
              icon={<PlusOutlined />}
            >
              New Restaurant User
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
              <Form.Item<QueryRestaurantUserInputs>
                label="Account"
                name="account"
              >
                <Input placeholder="Enter account" style={{ width: "200px" }} />
              </Form.Item>
              <Form.Item<QueryRestaurantUserInputs>
                label="User Name"
                name="userName"
              >
                <Input
                  placeholder="Enter user name"
                  style={{ width: "200px" }}
                />
              </Form.Item>
              <Form.Item<QueryRestaurantUserInputs> label="Phone" name="phone">
                <Input placeholder="Enter phone" style={{ width: "200px" }} />
              </Form.Item>
              <Form.Item<QueryRestaurantUserInputs>
                name="restaurantId"
                label="Restaurant"
              >
                <Select
                  style={{ width: "200px" }}
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
                >
                  {options.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
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
        <Table<QueryRestaurantUserOutputs>
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
          <Column<QueryRestaurantUserOutputs>
            width="80px"
            title="ID"
            dataIndex="id"
          />
          <Column<QueryRestaurantUserOutputs>
            title="User Name"
            dataIndex="userName"
          />
          <Column<QueryRestaurantUserOutputs>
            title="Phone"
            dataIndex="completePhone"
            width="150px"
            render={(text, record: QueryRestaurantUserOutputs) => {
              return `${record.phoneAreaCode} - ${record.phone}`;
            }}
          />
          <Column<QueryRestaurantUserOutputs>
            title="Account"
            dataIndex="account"
          />
          <Column<QueryRestaurantUserOutputs>
            title="Nickname"
            dataIndex="nickname"
          />
          <Column<QueryRestaurantUserOutputs>
            title="Avatar"
            width="150px"
            dataIndex="avatar"
            render={(avatar) => (
              <img
                src={avatar}
                alt={`avatar`}
                style={{ width: "100px", height: "100px" }}
              />
            )}
          />
          <Column<QueryRestaurantUserOutputs>
            width="100px"
            title="Is Brand Main"
            dataIndex="isBrandMain"
            render={(_, { isBrandMain }) =>
              isBrandMain ? (
                <Tag color="green">Yes</Tag>
              ) : (
                <Tag color="red">No</Tag>
              )
            }
          />
          <Column<QueryRestaurantUserOutputs>
            width="100px"
            title="Is Enabled"
            dataIndex="isEnabled"
            render={(_, { isEnabled }) =>
              isEnabled ? (
                <Tag color="green">Yes</Tag>
              ) : (
                <Tag color="red">No</Tag>
              )
            }
          />
          <Column<QueryRestaurantUserOutputs>
            title="Create At"
            dataIndex="createAt"
            render={formateDatetime}
          />
          <Column<QueryRestaurantUserOutputs>
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
                  title="Delete the restaurant user"
                  description="Are you sure to delete this restaurant user?"
                  okText="Yes"
                  cancelText="No"
                  onConfirm={confirmDeleteRestaurantUser(id)}
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

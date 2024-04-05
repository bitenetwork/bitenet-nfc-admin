"use client";
import React, { useState, useEffect } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { api } from "~/trpc/react";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import {
  type QueryRestaurantInputs,
  type QueryRestaurantOutputs,
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
  message,
} from "antd";
import moment from "moment";
import AddRestaurant from "./add";
import EditRestaurant from "./edit";

const { Column } = Table;
const { Option } = Select;

const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

export default function RestaurantPage() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] = useState<QueryRestaurantInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.restaurant.queryRestaurant.useQuery(queryOption);

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: QueryRestaurantInputs) => {
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

  const mutation = api.restaurant.deleteRestaurant.useMutation();
  const confirmDeleteRestaurant = (id: number) => () => {
    mutation.mutateAsync({ id }).then(() => refetch());
  };

  const [options, setOptions] = useState<{ value: number; label: string }[]>(
    [],
  );

  const { data: brandData } = api.brand.listBrand.useQuery({});
  useEffect(() => {
    if (brandData) {
      setOptions(
        brandData.map((item) => ({ value: item.id, label: item.name })),
      );
    }
  }, [brandData]);

  const generateNFCUrl = (code: string) =>
    `https://app.bitenet.io/restaurant/sign/${encodeURIComponent(code)}`;

  const onCopySuccess = () => {
    message.success("Copied NFC URL to clipboard!", 2); // 显示2秒后自动消失
  };

  return (
    <>
      <AddRestaurant open={openAdd} onClose={handleAddClose} />
      <EditRestaurant id={id} open={openEdit} onClose={handleEditClose} />
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card
          style={{ width: "100%" }}
          title="Restaurant"
          extra={
            <Button
              type="primary"
              onClick={() => setOpenAdd(true)}
              icon={<PlusOutlined />}
            >
              New Restaurant
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
              <Form.Item<QueryRestaurantInputs> label="Name" name="name">
                <Input
                  placeholder="Please enter name"
                  style={{ width: "230px" }}
                />
              </Form.Item>
              <Form.Item<QueryRestaurantInputs> name="brandId" label="Brand">
                <Select
                  placeholder="Please select brand"
                  style={{ width: "230px" }}
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
        <Table<QueryRestaurantOutputs>
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
          <Column<QueryRestaurantOutputs>
            width="80px"
            title="ID"
            dataIndex="id"
          />
          <Column<QueryRestaurantOutputs> title="Name" dataIndex="name" />
          <Column<QueryRestaurantOutputs> title="En_Name" dataIndex="en_name" />
          <Column<QueryRestaurantOutputs> title="Code" dataIndex="code" />
          <Column<QueryRestaurantOutputs>
            title="Index Code"
            dataIndex="indexCode"
          />
          <Column<QueryRestaurantOutputs>
            title="Brand Name"
            dataIndex="brandName"
          />
          <Column<QueryRestaurantOutputs> title="Address" dataIndex="address" />
          <Column<QueryRestaurantOutputs>
            title="En_Address"
            dataIndex="en_address"
          />
          <Column<QueryRestaurantOutputs>
            title="Cover"
            width="150px"
            dataIndex="cover"
            render={(cover) => (
              <img
                src={cover}
                alt={`cover`}
                style={{ width: "100px", height: "100px" }}
              />
            )}
          />
          <Column<QueryRestaurantOutputs>
            title="Contacts"
            dataIndex="contacts"
          />
          <Column<QueryRestaurantOutputs>
            title="Contacts Way"
            dataIndex="contactsWay"
          />
          <Column<QueryRestaurantOutputs> title="Lat" dataIndex="lat" />
          <Column<QueryRestaurantOutputs> title="Lng" dataIndex="lng" />
          <Column<QueryRestaurantOutputs>
            title="Is Main Store"
            dataIndex="isMainStore"
            render={(_, { isMainStore }) =>
              isMainStore ? (
                <Tag color="green">Yes</Tag>
              ) : (
                <Tag color="red">No</Tag>
              )
            }
          />
          <Column<QueryRestaurantOutputs>
            title="Cuisine Type"
            render={(_, { cuisineType }) =>
              cuisineType ? (
                <span>
                  {cuisineType.cuisineTypeNameEn}({cuisineType.cuisineTypeName})
                </span>
              ) : (
                <span>-</span>
              )
            }
          />
          <Column<QueryRestaurantOutputs>
            title="Create At"
            dataIndex="createAt"
            render={formateDatetime}
          />
          <Column<QueryRestaurantOutputs>
            width="120px"
            title="Action"
            dataIndex="id"
            render={(_, { id, code }) => (
              <Flex wrap="wrap" gap="small">
                {/* 添加CopyToClipboard组件 */}
                <CopyToClipboard
                  text={generateNFCUrl(code)}
                  onCopy={onCopySuccess}
                >
                  <Button type="link" icon={<EditOutlined />}>
                    Copy NFC Url
                  </Button>
                </CopyToClipboard>
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
                  title="Delete the restaurant"
                  description="Are you sure to delete this restaurant?"
                  okText="Yes"
                  cancelText="No"
                  onConfirm={confirmDeleteRestaurant(id)}
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

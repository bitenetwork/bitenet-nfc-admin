"use client";
import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { PlusOutlined } from "@ant-design/icons";
import {
  type QueryRestaurantNFCInputs,
  type QueryRestaurantNFCOutputs,
} from "~/trpc/admin/restaurant/types";
import {
  Flex,
  Card,
  Button,
  Form,
  Space,
  Table,
  type TablePaginationConfig,
  Select,
} from "antd";
import moment from "moment";

const { Column } = Table;
const { Option } = Select;

const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

export default function RestaurantNFCPage() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] = useState<QueryRestaurantNFCInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.restaurantNFC.queryRestaurantNFC.useQuery(queryOption);

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: QueryRestaurantNFCInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
    refetch();
  };

  const onReset = () => {
    form.resetFields();
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
    refetch();
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
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card style={{ width: "100%" }} title="RestaurantNFC">
          <Form
            form={form}
            layout="inline"
            style={{ maxWidth: "none" }}
            onFinish={onSearch}
          >
            <Flex wrap="wrap" gap="small">
              <Form.Item<QueryRestaurantNFCInputs>
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
        <Table<QueryRestaurantNFCOutputs>
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
          <Column<QueryRestaurantNFCOutputs>
            width="80px"
            title="ID"
            dataIndex="id"
          />
          <Column<QueryRestaurantNFCOutputs>
            title="Restaurant Name"
            dataIndex="restaurantName"
          />
          <Column<QueryRestaurantNFCOutputs>
            title="Photo"
            width="150px"
            dataIndex="photo"
            render={(photo) => (
              <img
                src={photo}
                alt={`photo`}
                style={{ width: "100px", height: "100px" }}
              />
            )}
          />
          <Column<QueryRestaurantNFCOutputs>
            title="Description"
            dataIndex="description"
          />
          <Column<QueryRestaurantNFCOutputs>
            title="En_Description"
            dataIndex="en_description"
          />
          <Column<QueryRestaurantNFCOutputs>
            title="Address"
            dataIndex="address"
          />
          <Column<QueryRestaurantNFCOutputs>
            title="Create At"
            dataIndex="createAt"
            render={formateDatetime}
          />
        </Table>
      </Space>
    </>
  );
}

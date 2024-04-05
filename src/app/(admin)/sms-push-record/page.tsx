"use client";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Table,
  TablePaginationConfig,
} from "antd";
import Column from "antd/es/table/Column";
import { useState } from "react";
import { formateDatetime } from "~/app/lib/utils";
import {
  PageSmsPushRecordInputs,
  PageSmsPushRecordOutputs,
} from "~/trpc/admin/sns-push-record/types";
import { api } from "~/trpc/react";

export default function SmsPushRecord() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] = useState<PageSmsPushRecordInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.smsPushRecord.pageSmsPushRecord.useQuery(queryOption);

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: PageSmsPushRecordInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
    refetch();
  };

  const onReset = () => {
    form.resetFields();
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
    refetch();
  };

  const { data: restaurantData } = api.restaurant.listRestaurant.useQuery({});

  return (
    <>
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card style={{ width: "100%" }} title="SMS Record">
          <Form
            form={form}
            layout="inline"
            style={{ maxWidth: "none" }}
            onFinish={onSearch}
          >
            <Form.Item name="restaurantId" label="Restaurant">
              <Select
                style={{ width: "200px" }}
                showSearch
                placeholder="Please select restaurant"
                optionFilterProp="children"
                filterOption={(
                  input: string,
                  option?: { children: string[] },
                ) =>
                  option?.children
                    ?.join("")
                    ?.toLowerCase()
                    .includes(input.toLowerCase()) || false
                }
              >
                {restaurantData?.map(({ id, name, en_name }) => (
                  <Select.Option key={id} value={id}>
                    {en_name}({name})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Flex wrap="wrap" gap="small">
              <Form.Item label="Phone Area Code" name="phoneAreaCode">
                <Input
                  placeholder="Phone Area Code"
                  style={{ width: "230px" }}
                />
              </Form.Item>
              <Form.Item label="Phone" name="phone">
                <Input placeholder="Phone" style={{ width: "230px" }} />
              </Form.Item>
              <Form.Item label="Context" name="context">
                <Input placeholder="Context" style={{ width: "230px" }} />
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
        <Table<PageSmsPushRecordOutputs>
          dataSource={data?.record ?? []}
          loading={isLoading}
          rowKey={(record) => `${record.smsPushRecord.id}`}
          onChange={onPageChange}
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
          <Column<PageSmsPushRecordOutputs>
            title="ID"
            render={(_, { smsPushRecord }) => smsPushRecord.id}
          />
          <Column<PageSmsPushRecordOutputs>
            title="Brand"
            render={(_, { brand }) => `${brand?.en_name}(${brand?.name})`}
          />
          <Column<PageSmsPushRecordOutputs>
            title="Restaurant"
            render={(_, { restaurant }) =>
              `${restaurant?.en_name}(${restaurant?.name})`
            }
          />
          <Column<PageSmsPushRecordOutputs>
            title="Member"
            render={(_, { member }) => member?.nickname}
          />
          <Column<PageSmsPushRecordOutputs>
            width="10%"
            title="Phone number"
            render={(_, { smsPushRecord: { phoneAreaCode, phone } }) =>
              `+${phoneAreaCode}-${phone}`
            }
          />
          <Column<PageSmsPushRecordOutputs>
            title="Push At"
            render={(_, { smsPushRecord }) =>
              formateDatetime(smsPushRecord.pushTime)
            }
          />
          <Column<PageSmsPushRecordOutputs>
            width="50%"
            title="Context"
            render={(_, { smsPushRecord }) => smsPushRecord.context}
          />
        </Table>
      </Space>
    </>
  );
}

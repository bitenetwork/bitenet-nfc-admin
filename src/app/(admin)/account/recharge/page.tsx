"use client";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Space,
  Table,
  TablePaginationConfig,
} from "antd";
import {
  RiseOutlined,
  FallOutlined,
  TransactionOutlined,
} from "@ant-design/icons";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import {
  type PageRestaurantWalletPreRechargeBalanceInputs,
  type PageRestaurantWalletPreRechargeBalanceOutputs,
} from "~/trpc/admin/account/types";
import Column from "antd/es/table/Column";
import moment from "moment";
import AddRecharge from "./add";
import DeductRecharge from "./deduct";
import RechargeDetail from "./detail";

const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

export default function Recharge() {
  const [form] = Form.useForm();
  const [queryOption, setQueryOption] =
    useState<PageRestaurantWalletPreRechargeBalanceInputs>({
      page: 1,
      pageSize: 10,
    });

  const { data, isLoading, refetch } =
    api.restaurantWalletPreRecharge.pageRestaurantWalletPreRechargeBalance.useQuery(
      queryOption,
    );

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const onSearch = (inputs: PageRestaurantWalletPreRechargeBalanceInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
    refetch();
  };

  const onReset = () => {
    form.resetFields();
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
    refetch();
  };

  const [brandId, setBrandId] = useState<number>();

  const [openAdd, setOpenAdd] = useState(false);
  const handleAddClose = () => {
    setOpenAdd(false);
    refetch();
  };

  const [openDeduct, setOpenDeduct] = useState(false);
  const handleDeductClose = () => {
    setOpenDeduct(false);
    refetch();
  };

  const [openRechargeDetail, setOpenRechargeDetail] = useState(false);
  const handleRechargeDetailClose = () => {
    setOpenRechargeDetail(false);
    refetch();
  };

  return (
    <>
      <RechargeDetail
        brandId={brandId}
        open={openRechargeDetail}
        onClose={handleRechargeDetailClose}
      />
      <AddRecharge
        brandId={brandId}
        open={openAdd}
        onClose={handleAddClose}
      ></AddRecharge>
      <DeductRecharge
        brandId={brandId}
        open={openDeduct}
        onClose={handleDeductClose}
      ></DeductRecharge>
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card style={{ width: "100%" }} title="Recharge">
          <Form
            form={form}
            layout="inline"
            style={{ maxWidth: "none" }}
            onFinish={onSearch}
          >
            <Flex wrap="wrap" gap="small">
              <Form.Item<PageRestaurantWalletPreRechargeBalanceInputs>
                label="Brand Name"
                name="name"
              >
                <Input placeholder="Name" style={{ width: "230px" }} />
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
        <Table<PageRestaurantWalletPreRechargeBalanceOutputs>
          dataSource={data?.record ?? []}
          loading={isLoading}
          rowKey={(record) => `${record.id}`}
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
          <Column width="5%" title="ID" dataIndex="id" />
          <Column width="10%" title="Brand Name" dataIndex="name" />
          <Column<PageRestaurantWalletPreRechargeBalanceOutputs>
            width="10%"
            title="Contacts"
            render={(_, { contactsWay, contacts }) =>
              `${contacts} ${contactsWay}`
            }
          />
          <Column<PageRestaurantWalletPreRechargeBalanceOutputs>
            title="Restaurant"
            render={(_, { restaurant }) =>
              restaurant?.map((x) => x.name).join(",")
            }
          />
          <Column
            width="10%"
            title="Create At"
            dataIndex="createAt"
            render={formateDatetime}
          />
          <Column
            width="10%"
            title="Update At"
            dataIndex="updateAt"
            render={formateDatetime}
          />
          <Column<PageRestaurantWalletPreRechargeBalanceOutputs>
            width="10%"
            title="Balance"
            dataIndex="balance"
          />
          <Column<PageRestaurantWalletPreRechargeBalanceOutputs>
            width="360px"
            title="Action"
            dataIndex="id"
            render={(_, { id }) => (
              <Flex wrap="wrap" gap="small">
                <Button
                  type="link"
                  icon={<RiseOutlined />}
                  onClick={() => {
                    setBrandId(id);
                    setOpenAdd(true);
                  }}
                >
                  Recharge
                </Button>
                <Button
                  type="link"
                  icon={<FallOutlined />}
                  onClick={() => {
                    setBrandId(id);
                    setOpenDeduct(true);
                  }}
                  danger
                >
                  Deduct
                </Button>
                <Button
                  type="link"
                  icon={<TransactionOutlined />}
                  onClick={() => {
                    setBrandId(id);
                    setOpenRechargeDetail(true);
                  }}
                >
                  Detail
                </Button>
              </Flex>
            )}
          />
        </Table>
      </Space>
    </>
  );
}

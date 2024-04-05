"use client";
import {
  Avatar,
  Card,
  Space,
  Table,
  TablePaginationConfig,
  TableProps,
} from "antd";
import { UserOutlined } from "@ant-design/icons";
import Column from "antd/es/table/Column";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { formateDatetime } from "~/app/lib/utils";
import {
  RestaurantMemberPageMamberInputs,
  RestaurantMemberPageMamberOutputs,
  RestaurantMemberPageMamberResult,
} from "~/trpc/admin/restaurant/types";

export function RestaurantMemberPage({
  brandId,
}: {
  brandId: number | undefined;
}) {
  const [queryOption, setQueryOption] =
    useState<RestaurantMemberPageMamberInputs>({
      brandId,
      page: 1,
      pageSize: 10,
    });

  const { data, isLoading } =
    api.restaurantMember.pageMember.useQuery(queryOption);

  const onChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  useEffect(() => {
    if (brandId) {
      setQueryOption({
        ...queryOption,
        brandId,
      });
    }
  }, [brandId]);

  return (
    <>
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <Card style={{ width: "100%" }} title="Recent customer/check-in">
          <DataTable
            onChange={onChange}
            data={data}
            isLoading={isLoading}
            queryOption={queryOption}
          />
        </Card>
      </Space>
    </>
  );
}

function DataTable({
  queryOption,
  isLoading,
  data,
  onChange,
}: {
  queryOption: RestaurantMemberPageMamberInputs;
  isLoading: boolean;
  data?: RestaurantMemberPageMamberResult;
  onChange: TableProps<RestaurantMemberPageMamberOutputs>["onChange"];
}) {
  return (
    <Table<RestaurantMemberPageMamberOutputs>
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
      <Column<RestaurantMemberPageMamberOutputs>
        title="Nickname"
        render={(_, { nickname, avatar }) => (
          <Space>
            {avatar ? (
              <Avatar size="small" src={avatar} />
            ) : (
              <Avatar size="small" icon={<UserOutlined />} />
            )}
            {nickname}
          </Space>
        )}
      />
      <Column<RestaurantMemberPageMamberOutputs>
        title="Mobile phone number"
        render={(_, { phoneAreaCode, phone }) => {
          if (phoneAreaCode && phone) {
            return `+${phoneAreaCode}-${phone}`;
          }
        }}
      />
      <Column title="Number of visits" dataIndex="accessTimes" />
      <Column<RestaurantMemberPageMamberOutputs>
        title="Access Date"
        render={(_, { accessDate }) =>
          accessDate && formateDatetime(accessDate)
        }
      />
    </Table>
  );
}

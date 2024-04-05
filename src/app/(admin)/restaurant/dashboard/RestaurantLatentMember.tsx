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
  RestaurantLatentMemberPageMamberInputs,
  RestaurantLatentMemberPageMamberOutputs,
  RestaurantLatentMemberPageMamberResult,
} from "~/trpc/admin/restaurant/types";
import _ from "lodash";

export function RestaurantLatentMemberPage({
  brandId,
}: {
  brandId: number | undefined;
}) {
  const [queryOption, setQueryOption] =
    useState<RestaurantLatentMemberPageMamberInputs>({
      brandId,
      page: 1,
      pageSize: 10,
    });

  const { data, isLoading } =
    api.restaurantMember.pageRestaurantLatentMember.useQuery(queryOption);

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
        <Card style={{ width: "100%" }} title="Potential Customers">
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
  queryOption: RestaurantLatentMemberPageMamberInputs;
  isLoading: boolean;
  data?: RestaurantLatentMemberPageMamberResult;
  onChange: TableProps<RestaurantLatentMemberPageMamberOutputs>["onChange"];
}) {
  const { data: cuisineType } = api.cuisineType.listCuisineType.useQuery();
  const cuisineTypeMap = Object.fromEntries(
    cuisineType?.map((x) => [x.id, x.cuisineTypeNameEn]) ?? [],
  );

  const { data: region } = api.restaurantRegion.listRestaurantRegion.useQuery(
    {},
  );
  const regionMap = Object.fromEntries(
    region?.map((x) => [x.code, x.en_name]) ?? [],
  );

  return (
    <Table<RestaurantLatentMemberPageMamberOutputs>
      dataSource={data?.record ?? []}
      loading={isLoading}
      rowKey={({ latentSignIn: { id } }) => id}
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
      <Column<RestaurantLatentMemberPageMamberOutputs>
        title="Nickname"
        render={(_, { member }) => (
          <Space>
            {member?.avatar ? (
              <Avatar size="small" src={member.avatar} />
            ) : (
              <Avatar size="small" icon={<UserOutlined />} />
            )}
            {member?.nickname}
          </Space>
        )}
      />
      <Column<RestaurantLatentMemberPageMamberOutputs>
        title="Mobile phone number"
        render={(_, { member }) => {
          if (member?.phoneAreaCode && member?.phone) {
            return `+${member.phoneAreaCode}-${member.phone}`;
          }
        }}
      />
      <Column<RestaurantLatentMemberPageMamberOutputs>
        title="Last punch-in time"
        render={(_, { latentSignIn }) =>
          latentSignIn && formateDatetime(latentSignIn.signInTime)
        }
      />
      <Column<RestaurantLatentMemberPageMamberOutputs>
        title="Previous region"
        render={(_, { latentRestaurant }) =>
          regionMap[latentRestaurant?.regionCode ?? ""]
        }
      />
      <Column<RestaurantLatentMemberPageMamberOutputs>
        title="Previous restaurant"
        render={(_, { latentRestaurant }) => latentRestaurant?.en_name}
      />
      <Column<RestaurantLatentMemberPageMamberOutputs>
        title="Previous cuisine"
        render={(_, { latentRestaurant }) =>
          cuisineTypeMap[latentRestaurant?.cuisineTypeId ?? ""]
        }
      />
    </Table>
  );
}

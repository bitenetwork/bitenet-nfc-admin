"use client";
import { Col, Row, Space } from "antd";
import { useState } from "react";
import { api } from "~/trpc/react";
import { DataFilter } from "./DataFilter";
import { Summary } from "./Summary";
import { CheckInAnalysis } from "./CheckInAnalysis";
import { RestaurantMemberPage } from "./RestaurantMember";
import { RestaurantLatentMemberPage } from "./RestaurantLatentMember";

export default function RestaurantDashboard() {
  const [brandId, setBrandId] = useState<number>();
  const { data: brands, isLoading: brandsLoading } =
    api.brand.listBrand.useQuery({});

  const { data, isLoading } = api.statistics.getStatisticsSummary.useQuery({
    brandId,
  });

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{ display: "flex", paddingTop: "10px" }}
    >
      <DataFilter
        brands={brands}
        onSearch={({ brandId }) => {
          setBrandId(brandId);
        }}
        loading={brandsLoading}
      ></DataFilter>
      <Summary
        data={data}
        brand={brands ? brands[0] : undefined}
        lodign={isLoading}
      ></Summary>
      <CheckInAnalysis brandId={brandId}></CheckInAnalysis>
      <Row gutter={16}>
        <Col span={12}>
          <RestaurantLatentMemberPage
            brandId={brandId}
          ></RestaurantLatentMemberPage>
        </Col>
        <Col span={12}>
          <RestaurantMemberPage brandId={brandId}></RestaurantMemberPage>
        </Col>
      </Row>
    </Space>
  );
}

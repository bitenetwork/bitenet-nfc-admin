"use client";
import { Card, Col, Row, Statistic } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import {
  GetStatisticsSummaryOutputs,
  QueryBrandOutputs,
} from "~/trpc/admin/restaurant/types";
import { formateDate } from "~/app/lib/utils";

export function Summary({
  data,
  lodign,
  brand,
}: {
  data: GetStatisticsSummaryOutputs | undefined;
  brand: QueryBrandOutputs | undefined;
  lodign: boolean;
}) {
  const {
    totalSnap,
    snapPercentage,
    totalSignInCount,
    weekSignInCount,
    signInCountPercentage,
    balance,
  } = data ?? {};
  const { levelType, expiredDate } = brand ?? {};
  return (
    <>
      <Row gutter={16}>
        <Col span={5}>
          <Card bordered={false} style={{ height: 150 }}>
            <Statistic
              loading={lodign}
              title="Total $BITE"
              value={totalSnap}
              precision={2}
              prefix="$BITE"
            />
            <Statistic
              loading={lodign}
              value={Number(snapPercentage) * 100}
              precision={2}
              valueStyle={{
                color: Number(snapPercentage) >= 0 ? "#3f8600" : "#cf1322",
              }}
              prefix={
                Number(snapPercentage) >= 0 ? (
                  <ArrowUpOutlined />
                ) : (
                  <ArrowDownOutlined />
                )
              }
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered={false} style={{ height: 150 }}>
            <Statistic
              loading={lodign}
              title="Total Check in"
              value={totalSignInCount}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered={false} style={{ height: 150 }}>
            <Statistic
              loading={lodign}
              title="Check in - past 7 days"
              value={weekSignInCount}
            />
            <Statistic
              loading={lodign}
              value={Number(signInCountPercentage) * 100}
              precision={2}
              valueStyle={{
                color:
                  Number(signInCountPercentage) >= 0 ? "#3f8600" : "#cf1322",
              }}
              prefix={
                Number(signInCountPercentage) >= 0 ? (
                  <ArrowUpOutlined />
                ) : (
                  <ArrowDownOutlined />
                )
              }
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered={false} style={{ height: 150 }}>
            <Statistic
              loading={lodign}
              title="Cash Balance"
              value={balance}
              precision={2}
              prefix="$HKD"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered={false} style={{ height: 150 }}>
            <Statistic loading={lodign} title="Membership" value={levelType} />
            <Statistic
              loading={lodign}
              value={formateDate(expiredDate ?? new Date())}
              valueStyle={{ color: "#000000e0", fontSize: 14 }}
              prefix={"Expires"}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

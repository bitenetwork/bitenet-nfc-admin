"use client";
import {
  Space,
  Layout,
  Statistic,
  Card,
  Row,
  Col,
  Spin,
  Select,
  Form,
  Flex,
  DatePicker,
} from "antd";
import React, { useEffect, useState } from "react";
import { type StatisticsOutputs } from "~/trpc/admin/dashboard/types";
import { api } from "~/trpc/react";
import dynamic from "next/dynamic";
import moment from "moment";
import dayjs from "dayjs";

// 使用 dynamic 函数导入 Line 组件，设置 ssr 为 false 禁用服务器端渲染
const Line = dynamic(
  () => import("@ant-design/charts").then((mod) => mod.Line),
  { ssr: false },
);

const { Header, Content, Footer, Sider } = Layout;

export default function Dashboard() {
  const [statisticsData, setStatisticsData] = useState<StatisticsOutputs>({
    restaurantCount: 0,
    dailyNewRestaurants: 0,
    memberCount: 0,
    dailyNewMembers: 0,
  });

  const queryResult =
    api.statistics.getStatisticsCountData.useQuery<StatisticsOutputs>({});
  useEffect(() => {
    if (queryResult.isSuccess && queryResult.data) {
      setStatisticsData(queryResult.data);
    }
  }, [queryResult.isSuccess, queryResult.data]);

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{ display: "flex", paddingTop: "10px" }}
    >
      <Card style={{ width: "100%" }} title="Statistics">
        <Content style={{ margin: "0 16px", padding: "24px" }}>
          {/* 使用Row和Col布局 */}
          <Row gutter={24}>
            <Col span={12}>
              {/* 统计卡片部分 */}
              <Card bordered={false} style={{ marginBottom: "16px" }}>
                <Statistic
                  title={
                    <span style={{ fontWeight: "bold", color: "black" }}>
                      Restaurant Total
                    </span>
                  }
                  value={statisticsData.restaurantCount}
                />
              </Card>
              <Card bordered={false}>
                <Statistic
                  title={
                    <span style={{ fontWeight: "bold", color: "black" }}>
                      Daily New Restaurant Count
                    </span>
                  }
                  value={statisticsData.dailyNewRestaurants}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card bordered={false} style={{ marginBottom: "16px" }}>
                <Statistic
                  title={
                    <span style={{ fontWeight: "bold", color: "black" }}>
                      Member Total
                    </span>
                  }
                  value={statisticsData.memberCount}
                />
              </Card>
              <Card bordered={false}>
                <Statistic
                  title={
                    <span style={{ fontWeight: "bold", color: "black" }}>
                      Daily New Member Count
                    </span>
                  }
                  value={statisticsData.dailyNewMembers}
                />
              </Card>
            </Col>
          </Row>
        </Content>
      </Card>
      <WeeklySignInMemberCountLine />
      <MonthSignInMemberCountLine />
    </Space>
  );
}

function WeeklySignInMemberCountLine() {
  type QueryParam = {
    yearStart: number;
    monthStart: number;
    yearEnd: number;
    monthEnd: number;
  };
  const [queryParam, setQueryParam] = useState<QueryParam>({
    yearStart: dayjs().startOf("year").toDate().getFullYear(),
    monthStart: dayjs().startOf("year").toDate().getMonth() + 1,
    yearEnd: new Date().getFullYear(),
    monthEnd: new Date().getMonth() + 1,
  });
  const { data, isLoading } =
    api.statistics.getWeeklySignInMemberCountList.useQuery(queryParam);

  const config = {
    data:
      data?.map(({ year, month, week, count }) => ({
        tag: `Week ${week}, ${getMonthName(month - 1)}/${year}`,
        count,
      })) ?? [],
    xField: "tag",
    yField: "count",
  };

  const [form] = Form.useForm();
  const onFinish = (values: any) => {
    const statisticalStartDate = values.statisticalDate[0].toDate();
    const statisticalEndDate = values.statisticalDate[1].toDate();
    setQueryParam({
      yearStart: statisticalStartDate.getFullYear(),
      monthStart: statisticalStartDate.getMonth() + 1,
      yearEnd: statisticalEndDate.getFullYear(),
      monthEnd: statisticalEndDate.getMonth() + 1,
    });
  };
  return (
    <Card
      style={{ width: "100%" }}
      title="Weeky SignIn Member Count"
      extra={
        <Form
          form={form}
          layout="inline"
          style={{ maxWidth: "none" }}
          onFinish={onFinish}
        >
          <Flex wrap="wrap" gap="small">
            <Form.Item label="Date" name="statisticalDate">
              <DatePicker.RangePicker
                picker="month"
                onChange={() => {
                  form.submit();
                }}
                defaultValue={[dayjs().startOf("year"), dayjs()]}
              />
            </Form.Item>
          </Flex>
        </Form>
      }
    >
      <Content style={{ padding: "0 50px" }}>
        <Row>
          <Col span={24}></Col>
        </Row>
        <Row>
          <Col span={24}>
            <Line {...config} />
          </Col>
        </Row>
      </Content>
    </Card>
  );
}

function MonthSignInMemberCountLine() {
  type QueryParam = {
    yearStart: number;
    monthStart: number;
    yearEnd: number;
    monthEnd: number;
  };
  const [queryParam, setQueryParam] = useState<QueryParam>({
    yearStart: dayjs().startOf("year").toDate().getFullYear(),
    monthStart: dayjs().startOf("year").toDate().getMonth() + 1,
    yearEnd: new Date().getFullYear(),
    monthEnd: new Date().getMonth() + 1,
  });
  const { data, isLoading } =
    api.statistics.getMonthSignInMemberCountList.useQuery(queryParam);

  const config = {
    data:
      data?.map(({ year, month, count }) => ({
        tag: `${getMonthName(month - 1)}, ${year}`,
        count,
      })) ?? [],
    xField: "tag",
    yField: "count",
  };

  const [form] = Form.useForm();
  const onFinish = (values: any) => {
    const statisticalStartDate = values.statisticalDate[0].toDate();
    const statisticalEndDate = values.statisticalDate[1].toDate();
    setQueryParam({
      yearStart: statisticalStartDate.getFullYear(),
      monthStart: statisticalStartDate.getMonth() + 1,
      yearEnd: statisticalEndDate.getFullYear(),
      monthEnd: statisticalEndDate.getMonth() + 1,
    });
  };
  return (
    <Card
      style={{ width: "100%" }}
      title="Monthly SignIn Member Count"
      extra={
        <Form
          form={form}
          layout="inline"
          style={{ maxWidth: "none" }}
          onFinish={onFinish}
        >
          <Flex wrap="wrap" gap="small">
            <Form.Item label="Date" name="statisticalDate">
              <DatePicker.RangePicker
                picker="month"
                onChange={() => {
                  form.submit();
                }}
                defaultValue={[dayjs().startOf("year"), dayjs()]}
              />
            </Form.Item>
          </Flex>
        </Form>
      }
    >
      <Content style={{ padding: "0 50px" }}>
        <Row>
          <Col span={24}></Col>
        </Row>
        <Row>
          <Col span={24}>
            <Line {...config} />
          </Col>
        </Row>
      </Content>
    </Card>
  );
}

function getMonthName(monthIndex: number) {
  return moment().month(monthIndex).format("MMMM");
}

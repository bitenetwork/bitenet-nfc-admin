"use client";
import { Card, Col, DatePicker, Flex, Form, Row } from "antd";
import { useEffect, useState } from "react";
import { GetDailySignInLineChartInputs } from "~/trpc/admin/restaurant/types";
import { api } from "~/trpc/react";
import { Content } from "antd/es/layout/layout";
import dayjs from "dayjs";
import dynamic from "next/dynamic";

// 使用 dynamic 函数导入 Line 组件，设置 ssr 为 false 禁用服务器端渲染
const Line = dynamic(
  () => import("@ant-design/charts").then((mod) => mod.Line),
  { ssr: false },
);

export function CheckInAnalysis({ brandId }: { brandId: number | undefined }) {
  const [queryParam, setQueryParam] = useState<GetDailySignInLineChartInputs>({
    page: 1,
    pageSize: 31,
    brandId,
    startDate: dayjs().startOf("month").toDate(),
    endDate: dayjs().endOf("month").toDate(),
  });
  const { data } = api.statistics.getDailySignInLineChart.useQuery(queryParam);
  const config = {
    data:
      data?.record.map(({ date, recordCount }) => ({
        tag: date,
        count: recordCount,
      })) ?? [],
    xField: "tag",
    yField: "count",
  };
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    const statisticalStartDate = values.statisticalDate[0].toDate();
    const statisticalEndDate = values.statisticalDate[1].toDate();
    setQueryParam({
      ...queryParam,
      startDate: statisticalStartDate,
      endDate: statisticalEndDate,
    });
  };

  useEffect(() => {
    if (brandId) {
      setQueryParam({
        ...queryParam,
        brandId,
      });
    }
  }, [brandId]);

  return (
    <Card
      style={{ width: "100%" }}
      title="Check-in Analysis"
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
                onChange={() => {
                  form.submit();
                }}
                defaultValue={[
                  dayjs().startOf("month"),
                  dayjs().endOf("month"),
                ]}
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

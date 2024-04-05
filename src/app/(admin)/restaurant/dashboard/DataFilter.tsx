"use client";
import { Card, Flex, Form, FormProps, Select } from "antd";
import { useEffect } from "react";
import { QueryBrandOutputs } from "~/trpc/admin/restaurant/types";

export function DataFilter({
  brands,
  onSearch,
  loading,
}: {
  brands: QueryBrandOutputs[] | undefined;
  onSearch: FormProps["onFinish"];
  loading: boolean;
}) {
  const [form] = Form.useForm<{ brandId: number }>();
  useEffect(() => {
    if (brands) {
      const brand = brands[0];
      if (brand) {
        form.setFieldValue("brandId", brand.id);
        form.submit();
      }
    }
  }, [brands]);
  return (
    <Card style={{ width: "100%" }} title="Dashboard">
      <Form
        form={form}
        layout="inline"
        style={{ maxWidth: "none" }}
        onFinish={onSearch}
      >
        <Flex wrap="wrap" gap="small">
          <Form.Item name="brandId" label="Brand">
            <Select
              loading={loading}
              style={{ width: "200px" }}
              showSearch
              placeholder="Please select brand"
              optionFilterProp="children"
              filterOption={(input: string, option?: { children: string[] }) =>
                option?.children
                  ?.join("")
                  ?.toLowerCase()
                  .includes(input.toLowerCase()) || false
              }
              onChange={form.submit}
            >
              {brands?.map(({ id, name, en_name }) => (
                <Select.Option key={id} value={id}>
                  {en_name}({name})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Flex>
      </Form>
    </Card>
  );
}

import React, { useEffect, useState } from "react";
import {
  Button,
  ButtonProps,
  Card,
  Col,
  DatePicker,
  Drawer,
  Flex,
  Form,
  FormInstance,
  FormProps,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  TablePaginationConfig,
  TableProps,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "~/trpc/react";
import {
  PageSignInRecordInputs,
  PageSignInRecordOutputs,
  PageSignInRecordResult,
  UpdateMemberInputs,
} from "~/trpc/admin/membership/type";
import { formateDatetime } from "~/app/lib/utils";
import dayjs from "dayjs";

interface Prop {
  id?: number;
  open: boolean;
  onClose: () => void;
}

export default function EditMember({ id, open, onClose }: Prop) {
  const [form] = Form.useForm();

  const { mutateAsync: updateMember, isLoading } =
    api.member.updateMember.useMutation();

  const onFinish = (data: UpdateMemberInputs) => {
    if (id) {
      updateMember({ id, data })
        .then(onClose)
        .then(() => form.resetFields());
    }
  };

  const utils = api.useUtils();
  useEffect(() => {
    if (id) {
      utils.member.findMember
        .fetch({ id })
        .then((data) => form.setFieldsValue(data));
    }
  }, [id, open]);

  return (
    <>
      <Drawer
        title="Edit Member"
        width={1000}
        onClose={onClose}
        open={open}
        styles={{
          body: {
            paddingBottom: 80,
          },
        }}
        extra={
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => form.submit()}
              type="primary"
              disabled={isLoading}
            >
              Submit
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="account"
                label="Account"
                rules={[{ required: true, message: "Please enter account" }]}
              >
                <Input placeholder="Please enter account" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nickname"
                label="Nickname"
                rules={[{ required: true, message: "Please enter nickname" }]}
              >
                <Input placeholder="Please enter nickname" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phoneAreaCode" label="Phone Area Code">
                <Input placeholder="Please enter phone area code" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="Please enter phone" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {id && <SignInRecordMain memberId={id} />}
      </Drawer>
    </>
  );
}

function SignInRecordMain({ memberId }: { memberId: number }) {
  const [form] = Form.useForm<PageSignInRecordInputs>();
  const [queryOption, setQueryOption] = useState<PageSignInRecordInputs>({
    memberId,
    page: 1,
    pageSize: 10,
  });
  const { data, isLoading, refetch } =
    api.nfcSignInRouter.pageSignIn.useQuery(queryOption);
  const onChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
    refetch();
  };
  const onSearch = (inputs: PageSignInRecordInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
    refetch();
  };

  const onReset = () => {
    setQueryOption(() => ({ memberId, page: 1, pageSize: 10 }));
    refetch();
  };

  useEffect(() => {
    setQueryOption((prev) => ({ ...prev, memberId }));
    refetch();
  }, [memberId]);

  const { data: restaurantData } = api.restaurant.listRestaurant.useQuery({});
  const { mutate: signIn } = api.member.signIn.useMutation();
  const [signInRecordForm] = Form.useForm();
  const onSignInRecordFormFinish = (values: any) => {
    const restaurant = restaurantData?.filter(
      (x) => x.id == values.restaurantId,
    )[0];
    if (restaurant) {
      signIn({
        memberId,
        code: restaurant.code,
        signInTime: values.signInTime.toDate(),
      });
      onReset();
    }
  };
  const onNew = () => {
    Modal.confirm({
      title: "New SignInRecord",
      content: (
        <>
          <Space
            direction="vertical"
            size="middle"
            style={{ display: "flex", paddingTop: "10px" }}
          >
            <Form
              layout="vertical"
              form={signInRecordForm}
              onFinish={onSignInRecordFormFinish}
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="restaurantId" label="Restaurant">
                    <Select
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
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="signInTime" label="Sign In Time">
                    <DatePicker showTime needConfirm={false} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Space>
        </>
      ),
      onOk: () => {
        signInRecordForm.submit();
      },
      afterClose: () => {
        signInRecordForm.resetFields();
      },
    });
  };

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{ display: "flex", paddingTop: "10px" }}
    >
      <SignInRecordFilter
        form={form}
        onSearch={onSearch}
        onReset={onReset}
        onNew={onNew}
      />
      <SignInRecordTable
        queryOption={queryOption}
        data={data}
        isLoading={isLoading}
        onChange={onChange}
      />
    </Space>
  );
}

function SignInRecordFilter({
  form,
  onSearch,
  onReset,
  onNew,
}: {
  form: FormInstance<PageSignInRecordInputs>;
  onSearch: FormProps["onFinish"];
  onReset: ButtonProps["onClick"];
  onNew: ButtonProps["onClick"];
}) {
  const { data: restaurantData } = api.restaurant.listRestaurant.useQuery({});
  return (
    <Card
      style={{ width: "100%" }}
      title="Sign In Record"
      extra={
        <Button type="primary" onClick={onNew} icon={<PlusOutlined />}>
          New
        </Button>
      }
    >
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
            filterOption={(input: string, option?: { children: string[] }) =>
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
  );
}

function SignInRecordTable({
  queryOption,
  isLoading,
  data,
  onChange,
}: {
  queryOption: PageSignInRecordInputs;
  isLoading: boolean;
  data?: PageSignInRecordResult;
  onChange: TableProps<PageSignInRecordOutputs>["onChange"];
}) {
  return (
    <>
      <Table
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
        <Table.Column title="ID" dataIndex="id" width={80} />
        <Table.Column<PageSignInRecordOutputs>
          title="Restaurant"
          render={(_, { restaurant }) => {
            return restaurant?.name;
          }}
        />
        <Table.Column<PageSignInRecordOutputs>
          title="Sign In Time"
          width={200}
          render={(_, { signInTime }) => formateDatetime(signInTime)}
        />
        <Table.Column<PageSignInRecordOutputs>
          title="Level"
          width={100}
          render={(_, { currentLevelCode }) => formateLevel(currentLevelCode)}
        />
        <Table.Column<PageSignInRecordOutputs>
          title="Bonus"
          render={(_, { bonus, originBouns, bonusMultiple }) =>
            `${bonus} = ${originBouns} x ${bonusMultiple}`
          }
        />
      </Table>
    </>
  );
}

function formateLevel(level: string) {
  switch (level) {
    case "LV_GENERAL":
      return "GENERAL";
    case "LV_RED":
      return "RED";
    case "LV_GOLD":
      return "GOLD";
  }
}

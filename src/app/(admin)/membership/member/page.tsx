"use client";
import {
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Form,
  FormProps,
  Input,
  Modal,
  Row,
  Space,
  Table,
  TablePaginationConfig,
  TableProps,
  Tag,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  UserOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import Column from "antd/es/table/Column";
import { useState } from "react";
import {
  PageMemberInputs,
  PageMemberOutputs,
  PageMemberResult,
} from "~/trpc/admin/membership/type";
import { api } from "~/trpc/react";
import { formateDatetime } from "~/app/lib/utils";
import AddMember from "./add";
import EditMember from "./edit";
import RechargeDetail from "./bitenet/detail";

export default function MemberPage() {
  const [queryOption, setQueryOption] = useState<PageMemberInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.member.pageMember.useQuery(queryOption);

  const onSearch = (inputs: PageMemberInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
  };

  const onReset = () => {
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
  };

  const onChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  const [openAdd, setOpenAdd] = useState(false);
  const handleAddClose = () => {
    setOpenAdd(false);
    refetch();
  };

  const [openEdit, setOpenEdit] = useState(false);
  const [id, setId] = useState<number>();
  const handleEditClose = () => {
    setOpenEdit(false);
    refetch();
  };
  const editMember = (id: number) => () => {
    setId(id);
    setOpenEdit(true);
  };

  const [memberId, setMemberId] = useState<number>();
  const [openRechargeDetail, setOpenRechargeDetail] = useState(false);
  const handleRechargeDetailClose = () => {
    setOpenRechargeDetail(false);
    refetch();
  };
  const showBalance = (id: number) => () => {
    setMemberId(id);
    setOpenRechargeDetail(true);
  };

  const [freezeMemberForm] = Form.useForm();
  const { mutateAsync: doFreezeMember } = api.member.freezeMember.useMutation();
  const freezeMember = (id: number) => () => {
    const onFreezeMemberFormFinish = (values: any) => {
      doFreezeMember({ id, data: { ...values } }).then(() => refetch());
    };
    Modal.confirm({
      title: "Freeze Member",
      content: (
        <>
          <Space
            direction="vertical"
            size="middle"
            style={{ display: "flex", paddingTop: "10px" }}
          >
            <Form
              layout="vertical"
              form={freezeMemberForm}
              onFinish={onFreezeMemberFormFinish}
            >
              <Row gutter={24}>
                <Col span={24}>
                  <Form.Item label="Reason" name="freezeReason">
                    <Input placeholder="please input reason" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Space>
        </>
      ),
      onOk: () => {
        freezeMemberForm.submit();
      },
    });
  };

  const { mutateAsync: doUnfreezeMember } =
    api.member.unfreezeMember.useMutation();
  const unfreezeMember = (id: number) => () => {
    Modal.confirm({
      title: "Unfreeze Member",
      content: "Are you sure you want to unfreeze this member",
      onOk: () => {
        doUnfreezeMember({ id }).then(() => refetch());
      },
    });
  };

  return (
    <>
      <RechargeDetail
        memberId={memberId}
        open={openRechargeDetail}
        onClose={handleRechargeDetailClose}
      />
      <AddMember open={openAdd} onClose={handleAddClose} />
      <EditMember id={id} open={openEdit} onClose={handleEditClose} />
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        <DataFilter
          onSearch={onSearch}
          onReset={onReset}
          onNew={() => setOpenAdd(true)}
        />
        <DataTable
          onChange={onChange}
          data={data}
          isLoading={isLoading}
          queryOption={queryOption}
          onEdit={editMember}
          onFreeze={freezeMember}
          onUnfreeze={unfreezeMember}
          onBalance={showBalance}
        />
      </Space>
    </>
  );
}

function DataFilter({
  onSearch,
  onReset,
  onNew,
}: {
  onSearch: FormProps["onFinish"];
  onReset: () => void;
  onNew: () => void;
}) {
  const [form] = Form.useForm<PageMemberInputs>();

  return (
    <Card
      style={{ width: "100%" }}
      title="Member"
      extra={
        <Button type="primary" onClick={onNew} icon={<PlusOutlined />}>
          New Member
        </Button>
      }
    >
      <Form
        form={form}
        layout="inline"
        style={{ maxWidth: "none" }}
        onFinish={onSearch}
      >
        <Flex wrap="wrap" gap="small">
          <Form.Item<PageMemberInputs> label="Account" name="account">
            <Input placeholder="Account" style={{ width: "230px" }} />
          </Form.Item>
          <Form.Item<PageMemberInputs>
            label="Phone Area Code"
            name="phoneAreaCode"
          >
            <Input placeholder="Phone Area Code" style={{ width: "230px" }} />
          </Form.Item>
          <Form.Item<PageMemberInputs> label="Phone" name="phone">
            <Input placeholder="Phone" style={{ width: "230px" }} />
          </Form.Item>
          <Form.Item<PageMemberInputs> label="Nickname" name="nickname">
            <Input placeholder="Nickname" style={{ width: "230px" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Search
            </Button>
          </Form.Item>
          <Form.Item>
            <Button
              type="default"
              htmlType="button"
              onClick={() => {
                form.resetFields();
                if (onReset) {
                  onReset();
                }
              }}
            >
              Reset
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </Card>
  );
}

function DataTable({
  queryOption,
  isLoading,
  data,
  onEdit,
  onFreeze,
  onUnfreeze,
  onChange,
  onBalance,
}: {
  queryOption: PageMemberInputs;
  isLoading: boolean;
  data?: PageMemberResult;
  onChange: TableProps<PageMemberOutputs>["onChange"];
  onEdit: (id: number) => () => void;
  onFreeze: (id: number) => () => void;
  onUnfreeze: (id: number) => () => void;
  onBalance: (id: number) => () => void;
}) {
  return (
    <Table<PageMemberOutputs>
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
      <Column width="60px" title="ID" dataIndex="id" />
      <Column<PageMemberOutputs>
        title="Member"
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
      <Column title="Account" dataIndex="account" />
      <Column<PageMemberOutputs>
        title="Phone"
        dataIndex="name"
        render={(_, { phoneAreaCode, phone }) => {
          if (phoneAreaCode && phone) {
            return `+${phoneAreaCode}-${phone}`;
          }
        }}
      />
      <Column<PageMemberOutputs>
        title="$BITE Balance"
        dataIndex="balance"
        render={(_, { id, balance }) => (
          <Button type="link" icon={<SearchOutlined />} onClick={onBalance(id)}>
            {balance}
          </Button>
        )}
      />
      <Column<PageMemberOutputs>
        title="Freeze"
        render={(_, { freeze, freezeReason }) => (
          <Tooltip title={freezeReason}>
            <Tag color={freeze ? "red" : "green"}>{freeze ? "Yes" : "No"}</Tag>
          </Tooltip>
        )}
      />
      <Column<PageMemberOutputs>
        title="App Sign In"
        render={(_, { appSignIn }) => (
          <Tag color={appSignIn ? "green" : "blue"}>
            {appSignIn ? "Yes" : "No"}
          </Tag>
        )}
      />
      <Column<PageMemberOutputs>
        title="Last Sign In"
        render={(_, { lastRestaurant }) =>
          lastRestaurant && (
            <Col>
              <Row>
                {lastRestaurant.accessDate &&
                  formateDatetime(lastRestaurant.accessDate)}
              </Row>
              <Row>{lastRestaurant.restaurant}</Row>
            </Col>
          )
        }
      />
      <Column<PageMemberOutputs>
        title="Last Access"
        render={(_, { lastAccessTime }) =>
          lastAccessTime && formateDatetime(lastAccessTime)
        }
      />
      <Column<PageMemberOutputs>
        title="Create At"
        render={(_, { createAt }) => formateDatetime(createAt)}
      />
      <Column<PageMemberOutputs>
        title="Update At"
        render={(_, { updateAt }) => formateDatetime(updateAt)}
      />
      <Column<PageMemberOutputs>
        width="320px"
        title="Action"
        dataIndex="id"
        render={(_, { id, freeze }) => (
          <>
            <Flex wrap="wrap" gap="small">
              <Button type="link" icon={<EditOutlined />} onClick={onEdit(id)}>
                Edit
              </Button>
              {freeze ? (
                <Button
                  type="link"
                  icon={<UnlockOutlined />}
                  onClick={onUnfreeze(id)}
                >
                  Unfreeze
                </Button>
              ) : (
                <Button
                  danger
                  type="link"
                  icon={<LockOutlined />}
                  onClick={onFreeze(id)}
                >
                  Freeze
                </Button>
              )}
            </Flex>
          </>
        )}
      />
    </Table>
  );
}

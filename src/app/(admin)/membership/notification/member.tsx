"use client";
import {
  Avatar,
  Button,
  Card,
  Flex,
  Form,
  FormProps,
  Input,
  Space,
  Table,
  TablePaginationConfig,
  TableProps,
  Tag,
  Tooltip,
} from "antd";
import { UserOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import Column from "antd/es/table/Column";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  PageMemberInputs,
  PageMemberOutputs,
  PageMemberResult,
} from "~/trpc/admin/membership/type";
import { api } from "~/trpc/react";
import { formateDatetime } from "~/app/lib/utils";
import _ from "lodash";
import {
  MemberDispatchContext,
  MemberIdContext,
  MemberIdActionTypes,
} from "./MemberIdContext";

interface Props {
  filter: boolean;
  showAction: boolean;
  editable: boolean;
  queryOption: PageMemberInputs;
  setQueryOption: Dispatch<SetStateAction<PageMemberInputs>>;
}

export const useMemberPage = (options: PageMemberInputs = {}) => {
  const [queryOption, setQueryOption] = useState<PageMemberInputs>({
    page: 1,
    pageSize: 10,
    ...options,
  });
  return { queryOption, setQueryOption };
};

export default function MemberPage({
  filter,
  showAction,
  editable,
  queryOption,
  setQueryOption,
}: Props) {
  const { data, isLoading } = api.member.pageMember.useQuery(queryOption);

  const onSearch = (inputs: PageMemberInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
  };

  const onReset = () => {
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
  };

  const doRefresh = (memberIds: number[]) => {
    setQueryOption((prev) => ({ ...prev, memberIds }));
  };

  const onChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  return (
    <>
      <Space
        direction="vertical"
        size="middle"
        style={{ display: "flex", paddingTop: "10px" }}
      >
        {filter && <DataFilter onSearch={onSearch} onReset={onReset} />}
        <DataTable
          showAction={showAction}
          editable={editable}
          onChange={onChange}
          data={data}
          isLoading={isLoading}
          queryOption={queryOption}
          doRefresh={doRefresh}
        />
      </Space>
    </>
  );
}

function DataFilter({
  onSearch,
  onReset,
}: {
  onSearch: FormProps["onFinish"];
  onReset: () => void;
}) {
  const [form] = Form.useForm<PageMemberInputs>();

  return (
    <Card style={{ width: "100%" }} title="Member">
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
  showAction,
  editable,
  queryOption,
  isLoading,
  data,
  onChange,
  doRefresh,
}: {
  showAction: boolean;
  editable: boolean;
  queryOption: PageMemberInputs;
  isLoading: boolean;
  data?: PageMemberResult;
  onChange: TableProps<PageMemberOutputs>["onChange"];
  doRefresh: (memberIds: number[]) => void;
}) {
  const memberIds = useContext(MemberIdContext);
  const memberIdDispatch = useContext(MemberDispatchContext);
  const onAddMemberId = (id: number) => {
    memberIdDispatch({
      type: MemberIdActionTypes.ADD,
      memberId: id,
    });
  };
  const onRemoveMemberId = (id: number) => {
    memberIdDispatch({
      type: MemberIdActionTypes.REMOVE,
      memberId: id,
    });
  };

  if (!editable) {
    useEffect(() => {
      doRefresh(memberIds);
    }, [memberIds]);
  }

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
      <Column<PageMemberOutputs> title="$BITE Balance" dataIndex="balance" />
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
        title="Create At"
        render={(_, { createAt }) => formateDatetime(createAt)}
      />
      <Column<PageMemberOutputs>
        title="Update At"
        render={(_, { updateAt }) => formateDatetime(updateAt)}
      />
      (
      {showAction && (
        <Column<PageMemberOutputs>
          width="320px"
          title="Action"
          dataIndex="id"
          render={(value, { id, freeze }) => (
            <>
              <Flex wrap="wrap" gap="small">
                {memberIds.includes(id) ? (
                  <Button
                    danger
                    type="link"
                    icon={<DeleteOutlined />}
                    onClick={() => onRemoveMemberId(id)}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => onAddMemberId(id)}
                  >
                    Add
                  </Button>
                )}
              </Flex>
            </>
          )}
        />
      )}
      )
    </Table>
  );
}

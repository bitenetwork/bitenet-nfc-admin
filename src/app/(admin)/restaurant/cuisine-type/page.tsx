"use client";
import {
  Avatar,
  Button,
  ButtonProps,
  Card,
  Flex,
  Form,
  FormProps,
  Input,
  Popconfirm,
  Space,
  Table,
  TablePaginationConfig,
  TableProps,
  Tag,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import Column from "antd/es/table/Column";
import { useState } from "react";
import { formateDatetime } from "~/app/lib/utils";
import {
  CuisineTypePageInputs,
  CuisineTypePageOutputs,
  CuisineTypePageResult,
} from "~/trpc/admin/restaurant/types";
import { api } from "~/trpc/react";
import AddCuisineType from "./add";
import EditCuisineType from "./edit";

export default function CuisineTypePage() {
  const [queryOption, setQueryOption] = useState<CuisineTypePageInputs>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.cuisineType.pageCuisineType.useQuery(queryOption);

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
  const editCuisineType = (id: number) => () => {
    setId(id);
    setOpenEdit(true);
  };

  const mutation = api.cuisineType.deleteCuisineType.useMutation();
  const confirmDeleteCuisineType = (id: number) => () => {
    mutation.mutateAsync({ id }).then(() => refetch());
  };

  const onSearch = (inputs: CuisineTypePageInputs) => {
    setQueryOption((prev) => ({ ...prev, ...inputs }));
  };

  const onReset = () => {
    setQueryOption(() => ({ page: 1, pageSize: 10 }));
  };

  const onChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  return (
    <>
      <AddCuisineType open={openAdd} onClose={handleAddClose} />
      <EditCuisineType id={id} open={openEdit} onClose={handleEditClose} />
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
          onEdit={editCuisineType}
          onDelete={confirmDeleteCuisineType}
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
  const [form] = Form.useForm<CuisineTypePageInputs>();

  return (
    <Card
      style={{ width: "100%" }}
      title="Cuisine Type"
      extra={
        <Button type="primary" onClick={onNew} icon={<PlusOutlined />}>
          New Cuisine Type
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
          <Form.Item<CuisineTypePageInputs>
            label="Cuisine Type Name(CN)"
            name="cuisineTypeName"
          >
            <Input
              placeholder="Cuisine Type Name(CN)"
              style={{ width: "230px" }}
            />
          </Form.Item>
          <Form.Item<CuisineTypePageInputs>
            label="Cuisine Type Name(EN)"
            name="cuisineTypeNameEn"
          >
            <Input
              placeholder="Cuisine Type Name(EN)"
              style={{ width: "230px" }}
            />
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
  onChange,
  onEdit,
  onDelete,
}: {
  queryOption: CuisineTypePageInputs;
  isLoading: boolean;
  data?: CuisineTypePageResult;
  onChange: TableProps<CuisineTypePageOutputs>["onChange"];
  onEdit: (id: number) => () => void;
  onDelete: (id: number) => () => void;
}) {
  return (
    <>
      <Table<CuisineTypePageOutputs>
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
        <Column title="Cuisine Type Name (CN)" dataIndex="cuisineTypeName" />
        <Column title="Cuisine Type Name (EN)" dataIndex="cuisineTypeNameEn" />
        <Column<CuisineTypePageOutputs>
          title="Create At"
          render={(_, { createAt }) => formateDatetime(createAt)}
        />
        <Column<CuisineTypePageOutputs>
          title="Update At"
          render={(_, { updateAt }) => formateDatetime(updateAt)}
        />
        <Column<CuisineTypePageOutputs>
          width="220px"
          title="Action"
          dataIndex="id"
          render={(_, { id }) => (
            <Flex wrap="wrap" gap="small">
              <Button type="link" icon={<EditOutlined />} onClick={onEdit(id)}>
                Edit
              </Button>
              <Popconfirm
                title="Delete the Cuisine Type"
                description="Are you sure to delete this Cuisine Type?"
                okText="Yes"
                cancelText="No"
                onConfirm={onDelete(id)}
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            </Flex>
          )}
        />
      </Table>
    </>
  );
}

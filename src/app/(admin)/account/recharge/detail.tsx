import {
  Card,
  Empty,
  Modal,
  Space,
  Table,
  TablePaginationConfig,
  Tag,
} from "antd";
import Column from "antd/es/table/Column";
import { useEffect, useState } from "react";
import {
  PageTransationInputs,
  PageTransationOutputs,
} from "~/trpc/admin/account/types";
import { api } from "~/trpc/react";
import { formateDatetime } from "~/app/lib/utils";

type Prop = {
  brandId?: number;
  open: boolean;
  onClose: () => void;
};
export default function RechargeDetail({ brandId, open, onClose }: Prop) {
  if (!brandId) {
    return (
      <Modal
        title="Modal 1000px width"
        centered
        open={open}
        onCancel={onClose}
        width={1000}
      >
        <Empty />
      </Modal>
    );
  }

  const [queryOption, setQueryOption] = useState<PageTransationInputs>({
    brandId,
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading, refetch } =
    api.restaurantWalletPreRecharge.pageTransation.useQuery(queryOption);

  const { data: balance, refetch: refetchBalance } =
    api.restaurantWalletPreRecharge.getBalance.useQuery({ brandId });

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  useEffect(() => {
    if (brandId) {
      setQueryOption(() => ({ brandId, page: 1, pageSize: 10 }));
      refetch();
      refetchBalance();
    }
  }, [brandId, open]);

  return (
    <>
      <Modal
        title={`Balance: ${balance}`}
        centered
        open={open}
        onOk={onClose}
        onCancel={onClose}
        width={1400}
        footer={(_, { OkBtn }) => (
          <>
            <OkBtn />
          </>
        )}
      >
        <Space
          direction="vertical"
          size="middle"
          style={{ display: "flex", paddingTop: "10px" }}
        >
          <Table<PageTransationOutputs>
            dataSource={data?.record ?? []}
            loading={isLoading}
            rowKey={(record) => `${record.id}`}
            onChange={onPageChange}
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
            <Column width="80px" title="ID" dataIndex="id" />
            <Column title="Subject" dataIndex="subject" />
            <Column<PageTransationOutputs>
              title="Direction"
              render={(_, { transationDirection }) =>
                transationDirection === "DEBIT" ? (
                  <Tag color="green">{transationDirection}</Tag>
                ) : (
                  <Tag color="red">{transationDirection}</Tag>
                )
              }
            />
            <Column title="Amount" dataIndex="amount" />
            <Column title="Remark (Chiness)" dataIndex="remark" />
            <Column title="Remark (English)" dataIndex="remarkEn" />
            <Column
              title="Create At"
              dataIndex="createAt"
              render={formateDatetime}
            />
            <Column
              title="Update At"
              dataIndex="updateAt"
              render={formateDatetime}
            />
          </Table>
        </Space>
      </Modal>
    </>
  );
}

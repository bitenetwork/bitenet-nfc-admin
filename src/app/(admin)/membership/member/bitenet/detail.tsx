import {
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Table,
  TablePaginationConfig,
  Tag,
} from "antd";
import { RiseOutlined, FallOutlined } from "@ant-design/icons";
import Column from "antd/es/table/Column";
import { useEffect, useState } from "react";
import { PagePointsTransationOutputs } from "~/trpc/admin/account/types";
import { api } from "~/trpc/react";
import { formateDatetime } from "~/app/lib/utils";
import { PageMemberWalletPointsTransationInputs } from "~/trpc/admin/membership/type";
import AddRecharge from "./add";
import DeductRecharge from "./deduct";

type Prop = {
  memberId?: number;
  open: boolean;
  onClose: () => void;
};
export default function RechargeDetail({ memberId, open, onClose }: Prop) {
  if (!memberId) {
    return (
      <Modal title="" centered open={open} onCancel={onClose} width={1400}>
        <Empty />
      </Modal>
    );
  }

  const [queryOption, setQueryOption] =
    useState<PageMemberWalletPointsTransationInputs>({
      memberId,
      page: 1,
      pageSize: 10,
    });

  const { data, isLoading, refetch } =
    api.memberWalletPoints.pageTransation.useQuery(queryOption);

  const { data: balance, refetch: refetchBalance } =
    api.memberWalletPoints.getBalance.useQuery({ memberId });

  const onPageChange = ({ current: page, pageSize }: TablePaginationConfig) => {
    setQueryOption((prev) => ({ ...prev, page, pageSize }));
  };

  useEffect(() => {
    if (memberId) {
      setQueryOption(() => ({ memberId, page: 1, pageSize: 10 }));
      refetch();
      refetchBalance();
    }
  }, [memberId, open]);

  const [openAdd, setOpenAdd] = useState(false);
  const handleAddClose = () => {
    setOpenAdd(false);
    refetch();
    refetchBalance();
  };

  const [openDeduct, setOpenDeduct] = useState(false);
  const handleDeductClose = () => {
    setOpenDeduct(false);
    refetch();
    refetchBalance();
  };

  return (
    <>
      <AddRecharge
        memberId={memberId}
        open={openAdd}
        onClose={handleAddClose}
      />
      <DeductRecharge
        memberId={memberId}
        open={openDeduct}
        onClose={handleDeductClose}
      />
      <Modal
        title={`Balance: ${balance}`}
        centered
        open={open}
        onOk={onClose}
        onCancel={onClose}
        width={1400}
        footer={(_, { OkBtn }) => (
          <>
            <Button icon={<RiseOutlined />} onClick={() => setOpenAdd(true)}>
              Recharge
            </Button>
            <Button
              icon={<FallOutlined />}
              onClick={() => setOpenDeduct(true)}
              danger
            >
              Deduct
            </Button>
            <OkBtn />
          </>
        )}
      >
        <Space
          direction="vertical"
          size="middle"
          style={{ display: "flex", paddingTop: "10px" }}
        >
          <Table<PagePointsTransationOutputs>
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
            <Column<PagePointsTransationOutputs>
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

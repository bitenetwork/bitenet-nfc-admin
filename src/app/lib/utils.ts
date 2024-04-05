import moment from "moment";

export const formateDatetime = (date: Date) =>
  date ? moment(date).format("Y-M-D HH:mm:ss") : "";

export const formateDate = (date: Date) =>
  date ? moment(date).format("D/M/Y") : "";

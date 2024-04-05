import { PutObjectCommand } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import { s3Client } from "~/server/sdk/s3";
import { v4 as uuid } from "uuid";
import { env } from "~/env.mjs";
import { db } from "~/server/db";
import _ from "lodash";
import { ResourceFile } from "@prisma/client";
import moment from "moment";

const handler = async (request: NextRequest) => {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { code: "1", error: "File blob is required." },
        { status: 400 },
      );
    }

    const fileInfo = await saveFileInfo(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadImageToS3(buffer, fileInfo);

    return NextResponse.json({ fileInfo, fileUrl: getFileUrl(fileInfo) });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({ code: "1", message: "Error uploading image" });
  }
};

async function saveFileInfo(file: File) {
  return await db.resourceFile.create({
    data: {
      uuid: uuid(),
      fileName: file.name,
      fileExtension: getFileExtension(file.name),
      fileSize: file.size,
      contentType: file.type,
    },
  });
}

function getFilePath(resourceFile: ResourceFile): string {
  const dateTimeFormatter = "YYYYMMDD";
  const date = moment(resourceFile.createAt).format(dateTimeFormatter);
  const fileExtension = resourceFile.fileExtension;
  const filePathComponents = ["NFC", date, String(resourceFile.uuid)].join("/");

  if (_.isString(fileExtension) && !_.isEmpty(_.trim(fileExtension))) {
    return filePathComponents + "." + fileExtension;
  }

  return filePathComponents;
}

function getFileUrl(resourceFile: ResourceFile) {
  return env.AWS_S3_DOMAIN + "/" + getFilePath(resourceFile);
}

function getFileExtension(fileName: string | null) {
  if (_.isNil(fileName) || _.isEmpty(_.trim(fileName))) {
    return undefined;
  }

  const indexOfDot = _.lastIndexOf(fileName, ".");
  if (indexOfDot === -1) {
    return undefined;
  }

  return fileName.substring(indexOfDot + 1);
}

async function uploadImageToS3(file: Buffer, resourceFile: ResourceFile) {
  const params = {
    Bucket: env.AWS_S3_BUCKET,
    Key: getFilePath(resourceFile),
    Body: file,
    ContentType: resourceFile.contentType, // Change the content type accordingly
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);
}

export { handler as POST };

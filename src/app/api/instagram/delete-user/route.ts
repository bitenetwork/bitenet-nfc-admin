import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "~/env.mjs";
import { db } from "~/server/db";

const handler = async (request: NextRequest) => {
  const signedRequest = (await request.formData())
    .get("signed_request")
    ?.toString();

  if (!signedRequest) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [encodedSig, payload] = signedRequest.split(".");

  if (!payload || !encodedSig) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 解码数据
  const sig = Buffer.from(encodedSig, "base64").toString("hex");
  const { user_id: userId } = JSON.parse(
    Buffer.from(payload, "base64").toString("utf-8"),
  );

  // 验证签名
  const expectedSig = crypto
    .createHmac("sha256", env.INSTAGRAM_CLIENT_SECRET)
    .update(payload)
    .digest("hex");
  if (sig !== expectedSig) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const memberAuth = await db.memberAuth.findUnique({
    where: {
      appType_appId_userId: {
        appType: "INSTAGRAM",
        appId: env.INSTAGRAM_CLIENT_ID,
        userId: String(userId),
      },
    },
  });
  if (!memberAuth) {
    return NextResponse.json({ code: "0", message: "ok" }, { status: 200 });
  }

  const existed = await db.member.findUnique({
    where: { id: memberAuth.memberId },
  });
  if (!existed) {
    return NextResponse.json({ code: "0", message: "ok" }, { status: 200 });
  }
  await db.memberAuth.delete({ where: { id: memberAuth.id } });
  await db.member.delete({ where: { id: memberAuth.memberId } });

  return NextResponse.json({ code: "0", message: "ok" }, { status: 200 });
};

export { handler as POST };

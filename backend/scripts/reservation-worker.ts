import "./load-env";
import { reconcilePayments } from "../src/services/payment.service";
import { processEmails } from "../src/services/email.service";
import { transaction, expireReservations } from "../src/repositories/shop.repo";
import { getPrisma } from "../src/lib/prisma";
import { processPushNotifications } from "../src/services/notification.service";

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
  });
async function main() {
  console.log("Gốm Cho Em: giữ hàng, đối soát VNPay, gửi email và thông báo FCM (10 giây).");
  while (!stopping) {
    try {
      await transaction(expireReservations);
      await reconcilePayments();
      await processEmails();
      await processPushNotifications();
    } catch (e) {
      console.error("Reservation cleanup failed", e);
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  await getPrisma().$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

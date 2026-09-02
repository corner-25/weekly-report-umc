import { sendBirthdayEmails } from '../lib/birthday-email';
import { prisma } from '../lib/prisma';

sendBirthdayEmails()
  .then((result) => {
    console.log(JSON.stringify(result));
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
